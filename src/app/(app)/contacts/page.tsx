import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContactStatus } from "@/lib/supabase/database.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { AddContactDialog, type WorkspaceMemberOption } from "@/components/contacts/add-contact-dialog";
import { ImportContactsDialog } from "@/components/contacts/import-contacts-dialog";
import { ContactsFilters } from "@/components/contacts/contacts-filters";
import { ContactRowActions } from "@/components/contacts/contact-row-actions";
import { ContactStatusBadge } from "@/components/contacts/status-badge";

export const metadata: Metadata = { title: "Contacts" };

const PAGE_SIZE = 25;

/** Escapes characters that are meaningful in a PostgREST `.or()` filter list. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%,()]/g, "").trim();
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const params = await searchParams;

  const q = sanitizeSearchTerm(params.q ?? "");
  const status = params.status && params.status !== "all" ? (params.status as ContactStatus) : undefined;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let contactsQuery = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspace.id);

  if (status) {
    contactsQuery = contactsQuery.eq("status", status);
  }
  if (q) {
    contactsQuery = contactsQuery.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const [{ data: contacts, count, error }, { data: members }] = await Promise.all([
    contactsQuery.order("created_at", { ascending: false }).range(from, to),
    supabase
      .from("workspace_members")
      .select("user_id, profile:profiles(full_name)")
      .eq("workspace_id", workspace.id),
  ]);

  if (error) {
    throw new Error(`Failed to load contacts: ${error.message}`);
  }

  const contactIds = (contacts ?? []).map((c) => c.id);
  const { data: campaignLinks } = contactIds.length
    ? await supabase
        .from("campaign_contacts")
        .select("contact_id")
        .eq("workspace_id", workspace.id)
        .in("contact_id", contactIds)
    : { data: [] as { contact_id: string }[] };

  const campaignCounts = new Map<string, number>();
  for (const link of campaignLinks ?? []) {
    campaignCounts.set(link.contact_id, (campaignCounts.get(link.contact_id) ?? 0) + 1);
  }

  const ownerNames = new Map<string, string>();
  const ownerOptions: WorkspaceMemberOption[] = [];
  for (const m of members ?? []) {
    const profile = m.profile as unknown as { full_name: string | null } | null;
    const label = profile?.full_name || "Unnamed member";
    ownerNames.set(m.user_id, label);
    ownerOptions.push({ id: m.user_id, label });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    sp.set("page", String(targetPage));
    return `/contacts?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {total} lead{total === 1 ? "" : "s"} in {workspace.name}.
          </p>
        </div>
        <div className="flex gap-2">
          <ImportContactsDialog />
          <AddContactDialog owners={ownerOptions} />
        </div>
      </div>

      <ContactsFilters />

      {!contacts || contacts.length === 0 ? (
        <EmptyState
          title={q || status ? "No matching contacts" : "No contacts yet"}
          description={
            q || status
              ? "Try a different search term or clear the status filter."
              : "Add a contact manually or import a CSV of leads to get started."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Last Called</TableHead>
                <TableHead>Lead Score</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <Link href={`/contacts/${contact.id}`} className="hover:underline">
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>{contact.company || "—"}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>{contact.email || "—"}</TableCell>
                    <TableCell>
                      <ContactStatusBadge status={contact.status} />
                    </TableCell>
                    <TableCell>{campaignCounts.get(contact.id) ?? 0}</TableCell>
                    <TableCell>
                      {contact.last_called_at ? new Date(contact.last_called_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{contact.lead_score}</TableCell>
                    <TableCell>{contact.owner_id ? (ownerNames.get(contact.owner_id) ?? "—") : "Unassigned"}</TableCell>
                    <TableCell className="text-right">
                      <ContactRowActions contactId={contact.id} contactName={name === "—" ? contact.phone : name} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>Previous</Link>
              </Button>
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
