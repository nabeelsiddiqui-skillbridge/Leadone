import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";
import { dedupKeyFor, normalizeDomain } from "@/lib/discovery/dedupe";
import { getDiscoverySourceConnector } from "@/lib/discovery/sources";
import { qualifyLead } from "@/lib/discovery/qualify";
import type { DiscoveredCompanyDraft } from "@/lib/discovery/types";

export interface RunDiscoveryJobResult {
  companiesFound: number;
  leadsCreated: number;
  error?: string;
}

/**
 * Runs one discovery_jobs row end to end: dispatch to the job's source
 * connector, upsert each returned company (deduped per workspace),
 * persist its signals/contacts, create a discovered_leads row for any
 * (company, profile) pair that doesn't already have one, and qualify each
 * new lead with Claude. Safe to call with either a session-scoped or
 * service-role client - every write is workspace_id-scoped either way, the
 * same convention src/lib/place-call.ts uses.
 */
export async function runDiscoveryJob(
  supabase: SupabaseClient<Database>,
  jobId: string,
  input?: Record<string, unknown>
): Promise<RunDiscoveryJobResult> {
  const { data: job } = await supabase.from("discovery_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return { companiesFound: 0, leadsCreated: 0, error: "Job not found." };

  const { data: profile } = await supabase
    .from("discovery_profiles")
    .select("*")
    .eq("id", job.discovery_profile_id)
    .maybeSingle();
  if (!profile) {
    await supabase
      .from("discovery_jobs")
      .update({ status: "failed", error_message: "Discovery profile not found.", finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return { companiesFound: 0, leadsCreated: 0, error: "Discovery profile not found." };
  }

  await supabase.from("discovery_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);

  const connector = getDiscoverySourceConnector(job.source_key);
  if (!connector) {
    const message = `Unknown source "${job.source_key}".`;
    await supabase
      .from("discovery_jobs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return { companiesFound: 0, leadsCreated: 0, error: message };
  }

  let drafts: DiscoveredCompanyDraft[];
  try {
    drafts = await connector.run({ workspaceId: job.workspace_id, profile, jobId, input });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery source failed.";
    await supabase
      .from("discovery_jobs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return { companiesFound: 0, leadsCreated: 0, error: message };
  }

  let companiesFound = 0;
  let leadsCreated = 0;

  for (const draft of drafts) {
    const dedupKey = dedupKeyFor(draft.name, draft.website);

    let companyId: string;
    const { data: existingCompany } = await supabase
      .from("discovered_companies")
      .select("id")
      .eq("workspace_id", job.workspace_id)
      .eq("dedup_key", dedupKey)
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("discovered_companies")
        .insert({
          workspace_id: job.workspace_id,
          discovery_profile_id: job.discovery_profile_id,
          name: draft.name,
          website: draft.website ?? null,
          domain: normalizeDomain(draft.website),
          industry: draft.industry ?? null,
          location: draft.location ?? null,
          company_size: draft.companySize ?? null,
          dedup_key: dedupKey,
          source_key: job.source_key,
          source_url: draft.sourceUrl ?? null,
          raw_data: (draft.rawData ?? {}) as Json,
        })
        .select("id")
        .single();

      if (insertError || !inserted) continue;
      companyId = inserted.id;
      companiesFound += 1;
    }

    // One lead per (company, profile) - a company already surfaced for this
    // profile (by this job or an earlier one) is not a new reviewable lead.
    // Checked before writing signals/contacts too, so re-running discovery
    // over the same data (e.g. re-uploading a CSV) doesn't pile up
    // duplicate evidence rows for a company that's already been through
    // review.
    const { data: existingLead } = await supabase
      .from("discovered_leads")
      .select("id")
      .eq("workspace_id", job.workspace_id)
      .eq("company_id", companyId)
      .eq("discovery_profile_id", job.discovery_profile_id)
      .maybeSingle();
    if (existingLead) continue;

    if (draft.signals.length > 0) {
      await supabase.from("discovered_signals").insert(
        draft.signals.map((signal) => ({
          workspace_id: job.workspace_id,
          company_id: companyId,
          signal_type: signal.signalType,
          description: signal.description,
          evidence_url: signal.evidenceUrl ?? null,
          source_key: job.source_key,
          observed_at: signal.observedAt ?? new Date().toISOString(),
        }))
      );
    }

    let primaryContactId: string | null = null;
    if (draft.contacts.length > 0) {
      const { data: insertedContacts } = await supabase
        .from("discovered_contacts")
        .insert(
          draft.contacts.map((contact) => ({
            workspace_id: job.workspace_id,
            company_id: companyId,
            name: contact.name ?? null,
            title: contact.title ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            source_url: contact.sourceUrl ?? null,
            verified: contact.verified ?? false,
            raw_data: (contact.rawData ?? {}) as Json,
          }))
        )
        .select("id");
      primaryContactId = insertedContacts?.[0]?.id ?? null;
    }

    const { data: signalRows } = await supabase
      .from("discovered_signals")
      .select("signal_type, description, evidence_url")
      .eq("company_id", companyId);
    const { data: contactRows } = await supabase
      .from("discovered_contacts")
      .select("name, title")
      .eq("company_id", companyId);
    const { data: companyRow } = await supabase
      .from("discovered_companies")
      .select("name, website, industry, location, company_size")
      .eq("id", companyId)
      .single();

    const qualification = companyRow
      ? await qualifyLead(job.workspace_id, {
          profile: {
            product_description: profile.product_description,
            icp_description: profile.icp_description,
            target_industries: profile.target_industries,
            target_locations: profile.target_locations,
            company_size_min: profile.company_size_min,
            company_size_max: profile.company_size_max,
            keywords: profile.keywords,
            exclusions: profile.exclusions,
          },
          company: companyRow,
          signals: signalRows ?? [],
          contacts: contactRows ?? [],
        })
      : null;

    const { error: leadInsertError } = await supabase.from("discovered_leads").insert({
      workspace_id: job.workspace_id,
      discovery_profile_id: job.discovery_profile_id,
      company_id: companyId,
      primary_contact_id: primaryContactId,
      job_id: jobId,
      fit_score: qualification?.status === "qualified" ? qualification.result.fit_score : null,
      confidence_level: qualification?.status === "qualified" ? qualification.result.confidence_level : null,
      detected_signal_summary: qualification?.status === "qualified" ? qualification.result.detected_signal_summary : null,
      reason: qualification?.status === "qualified" ? qualification.result.reason : null,
      suggested_outreach_angle: qualification?.status === "qualified" ? qualification.result.suggested_outreach_angle : null,
      qualification_status: qualification?.status ?? "unavailable",
      qualification_model: qualification?.status === "qualified" ? qualification.model : null,
      qualified_at: qualification?.status === "qualified" ? new Date().toISOString() : null,
    });

    if (!leadInsertError) leadsCreated += 1;
  }

  await supabase
    .from("discovery_jobs")
    .update({
      status: "completed",
      companies_found: companiesFound,
      leads_created: leadsCreated,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return { companiesFound, leadsCreated };
}
