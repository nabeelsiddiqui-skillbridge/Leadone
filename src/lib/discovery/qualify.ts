import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { resolveCredential } from "@/lib/credentials";
import type { Database } from "@/lib/supabase/database.types";

const QUALIFICATION_MODEL = "claude-opus-5-5";

const QualificationSchema = z.object({
  fit_score: z.number().int().min(0).max(100).describe("0-100 fit against the target profile, based only on the evidence given."),
  confidence_level: z.enum(["low", "medium", "high"]).describe("How confident this score is, given how much verified evidence is available."),
  detected_signal_summary: z.string().describe("One short sentence naming the strongest signal(s) that made this company a candidate."),
  reason: z.string().describe("2-4 sentences of evidence-based reasoning for the score. Reference only facts given above; say so plainly if evidence is thin."),
  suggested_outreach_angle: z.string().describe("A specific, evidence-grounded opening angle for outreach. Never invent a fact not present in the evidence."),
});

export type QualificationResult = z.infer<typeof QualificationSchema>;

type ProfileForQualification = Pick<
  Database["public"]["Tables"]["discovery_profiles"]["Row"],
  "product_description" | "icp_description" | "target_industries" | "target_locations" | "company_size_min" | "company_size_max" | "keywords" | "exclusions"
>;
type CompanyForQualification = Pick<
  Database["public"]["Tables"]["discovered_companies"]["Row"],
  "name" | "website" | "industry" | "location" | "company_size"
>;
type SignalForQualification = Pick<
  Database["public"]["Tables"]["discovered_signals"]["Row"],
  "signal_type" | "description" | "evidence_url"
>;
type ContactForQualification = Pick<Database["public"]["Tables"]["discovered_contacts"]["Row"], "name" | "title">;

export interface QualificationInput {
  profile: ProfileForQualification;
  company: CompanyForQualification;
  signals: SignalForQualification[];
  contacts: ContactForQualification[];
}

export type QualificationOutcome =
  | { status: "qualified"; model: string; result: QualificationResult }
  | { status: "unavailable"; reason: string }
  | { status: "error"; reason: string };

function buildTargetProfileText(profile: ProfileForQualification): string {
  return [
    `Product/service being sold: ${profile.product_description}`,
    profile.icp_description ? `Ideal customer profile: ${profile.icp_description}` : null,
    profile.target_industries.length > 0 ? `Target industries: ${profile.target_industries.join(", ")}` : null,
    profile.target_locations.length > 0 ? `Target locations: ${profile.target_locations.join(", ")}` : null,
    profile.company_size_min != null || profile.company_size_max != null
      ? `Target company size: ${profile.company_size_min ?? "?"}-${profile.company_size_max ?? "?"} employees`
      : null,
    profile.keywords.length > 0 ? `Keywords indicating fit: ${profile.keywords.join(", ")}` : null,
    profile.exclusions.length > 0 ? `Exclude if any apply: ${profile.exclusions.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEvidenceText(company: CompanyForQualification, signals: SignalForQualification[], contacts: ContactForQualification[]): string {
  return [
    `Company: ${company.name}`,
    company.website ? `Website: ${company.website}` : "Website: unknown",
    company.industry ? `Industry: ${company.industry}` : "Industry: unknown",
    company.location ? `Location: ${company.location}` : "Location: unknown",
    company.company_size ? `Company size: ${company.company_size}` : "Company size: unknown",
    signals.length > 0
      ? `Observed signals:\n${signals.map((s) => `- [${s.signal_type}] ${s.description}${s.evidence_url ? ` (source: ${s.evidence_url})` : ""}`).join("\n")}`
      : "Observed signals: none recorded.",
    contacts.length > 0
      ? `Known contacts:\n${contacts.map((c) => `- ${c.name ?? "unnamed"}${c.title ? `, ${c.title}` : ""}`).join("\n")}`
      : "Known contacts: none recorded.",
  ].join("\n");
}

/**
 * Scores one discovered company against a workspace's target-customer
 * profile using Claude, grounded strictly in the evidence passed in. Never
 * fabricates contact info or buying intent - the prompt requires the model
 * to say so plainly when evidence is thin rather than guess, and the
 * structured-output schema has no field for anything not derivable from
 * evidence.
 *
 * Returns 'unavailable' (not an error) when no Anthropic API key is
 * configured, so callers can show "qualification unavailable" instead of a
 * fabricated score.
 */
export async function qualifyLead(workspaceId: string, input: QualificationInput): Promise<QualificationOutcome> {
  const apiKey = await resolveCredential(workspaceId, "anthropic", "api_key");
  if (!apiKey) {
    return {
      status: "unavailable",
      reason: "No Anthropic API key is configured. Add one in Super Admin → Settings → APIs to enable lead qualification.",
    };
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: QUALIFICATION_MODEL,
      max_tokens: 4096,
      output_config: {
        format: zodOutputFormat(QualificationSchema),
        effort: "low",
      },
      system:
        "You are a B2B sales qualification analyst. You are given a target customer profile and verified, sourced evidence about one company. Score how well this company fits the target profile using ONLY the evidence given - never invent facts, contact details, or buying intent that isn't stated. Mark anything not present in the evidence as unknown rather than guessing. If evidence is thin, reflect that with a lower confidence_level and say so plainly in `reason`. `suggested_outreach_angle` must reference only what's in the evidence above.",
      messages: [
        {
          role: "user",
          content: `Target customer profile:\n${buildTargetProfileText(input.profile)}\n\nCompany evidence:\n${buildEvidenceText(input.company, input.signals, input.contacts)}\n\nScore this company's fit (0-100) and explain your reasoning using only the evidence above.`,
        },
      ],
    });

    if (!response.parsed_output) {
      return { status: "error", reason: "Claude's response could not be parsed into the expected qualification format." };
    }

    return { status: "qualified", model: QUALIFICATION_MODEL, result: response.parsed_output };
  } catch (err) {
    return { status: "error", reason: err instanceof Error ? err.message : "Qualification request failed." };
  }
}
