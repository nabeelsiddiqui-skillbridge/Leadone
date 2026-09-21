"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContactStatus, Database } from "@/lib/supabase/database.types";

export interface ContactActionState {
  error?: string;
  success?: boolean;
}

const INSERT_CHUNK_SIZE = 500;

function cleanString(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

/** Creates a single contact from the "Add contact" dialog form. */
export async function createContactAction(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const phone = cleanString(formData.get("phone"));
  if (!phone) {
    return { error: "Phone number is required." };
  }

  const leadScoreRaw = cleanString(formData.get("lead_score"));
  const leadScore = leadScoreRaw !== null ? Number(leadScoreRaw) : null;
  if (leadScoreRaw !== null && (Number.isNaN(leadScore) || leadScore! < 0 || leadScore! > 100)) {
    return { error: "Lead score must be a number between 0 and 100." };
  }

  const ownerId = cleanString(formData.get("owner_id"));
  const status = (cleanString(formData.get("status")) ?? "new") as ContactStatus;

  const insertRow: Database["public"]["Tables"]["contacts"]["Insert"] = {
    workspace_id: workspace.id,
    phone,
    first_name: cleanString(formData.get("first_name")),
    last_name: cleanString(formData.get("last_name")),
    company: cleanString(formData.get("company")),
    email: cleanString(formData.get("email")),
    website: cleanString(formData.get("website")),
    job_title: cleanString(formData.get("job_title")),
    timezone: cleanString(formData.get("timezone")),
    country: cleanString(formData.get("country")),
    industry: cleanString(formData.get("industry")),
    status,
    lead_score: leadScore ?? 0,
    owner_id: ownerId,
  };

  const { error } = await supabase.from("contacts").insert(insertRow);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contacts");
  return { success: true };
}

/** One row parsed from an uploaded CSV, after the user has mapped its columns. */
export interface ContactImportRow {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  job_title?: string | null;
  timezone?: string | null;
  country?: string | null;
  industry?: string | null;
  custom_fields?: Record<string, string>;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  error?: string;
}

/**
 * Bulk-inserts contacts parsed from a CSV. Called directly as an async
 * function from the client (not via a <form>), so `rows` arrives as a plain
 * serialized array rather than FormData. Rows missing a phone number, and
 * duplicate phone numbers within the batch (first occurrence wins), are
 * skipped rather than inserted. Does NOT dedupe against contacts already in
 * the database — see the module's README/report for that scope cut.
 */
export async function bulkImportContactsAction(rows: ContactImportRow[]): Promise<BulkImportResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const seenPhones = new Set<string>();
  const toInsert: Database["public"]["Tables"]["contacts"]["Insert"][] = [];
  let skipped = 0;

  for (const row of rows) {
    const phone = row.phone?.trim();
    if (!phone) {
      skipped += 1;
      continue;
    }
    const phoneKey = phone.toLowerCase();
    if (seenPhones.has(phoneKey)) {
      skipped += 1;
      continue;
    }
    seenPhones.add(phoneKey);

    toInsert.push({
      workspace_id: workspace.id,
      phone,
      first_name: row.first_name?.trim() || null,
      last_name: row.last_name?.trim() || null,
      company: row.company?.trim() || null,
      email: row.email?.trim() || null,
      website: row.website?.trim() || null,
      job_title: row.job_title?.trim() || null,
      timezone: row.timezone?.trim() || null,
      country: row.country?.trim() || null,
      industry: row.industry?.trim() || null,
      custom_fields: row.custom_fields && Object.keys(row.custom_fields).length > 0 ? row.custom_fields : {},
    });
  }

  let imported = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
    const { error, count } = await supabase.from("contacts").insert(chunk, { count: "exact" });
    if (error) {
      // Stop on the first failing chunk; report what succeeded so far plus
      // everything after it as skipped, and surface the error message.
      skipped += toInsert.length - i;
      revalidatePath("/contacts");
      return { imported, skipped, error: error.message };
    }
    imported += count ?? chunk.length;
  }

  revalidatePath("/contacts");
  return { imported, skipped };
}

/** Deletes a contact (row-action dropdown on the list page). */
export async function deleteContactAction(contactId: string): Promise<{ error?: string }> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("workspace_id", workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contacts");
  return {};
}

/** Adds a note to a contact's timeline from the profile page. */
export async function addContactNoteAction(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const user = await requireUser();
  const supabase = await createClient();

  const contactId = String(formData.get("contact_id") ?? "");
  const note = cleanString(formData.get("note"));

  if (!contactId) {
    return { error: "Missing contact." };
  }
  if (!note) {
    return { error: "Note cannot be empty." };
  }

  const { error } = await supabase.from("contact_notes").insert({
    workspace_id: workspace.id,
    contact_id: contactId,
    author_id: user.id,
    note,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { success: true };
}
