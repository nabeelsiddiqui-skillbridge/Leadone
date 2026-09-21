"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import type { ContactOption, WizardState } from "./types";

function contactLabel(contact: ContactOption) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  return name || contact.phone;
}

export function LeadsExistingTab({
  state,
  update,
  contacts,
  contactsCapped,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  contacts: ContactOption[];
  contactsCapped: boolean;
}) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const haystack = [contact.first_name, contact.last_name, contact.company, contact.phone, contact.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, search]);

  function toggle(contactId: string, checked: boolean) {
    if (checked) {
      update({ selectedContactIds: [...state.selectedContactIds, contactId] });
    } else {
      update({ selectedContactIds: state.selectedContactIds.filter((id) => id !== contactId) });
    }
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        title="No contacts yet"
        description="Import or add contacts first, or use the Upload CSV / Manual entry tabs to add leads directly to this campaign."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts by name, company, phone, or email"
          className="pl-8"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {state.selectedContactIds.length} selected
        {contactsCapped ? ` · showing the first ${contacts.length} contacts (search to narrow further)` : ""}
      </p>
      <ScrollArea className="h-72 rounded-md border">
        <div className="divide-y">
          {filtered.map((contact) => {
            const checked = state.selectedContactIds.includes(contact.id);
            return (
              <label
                key={contact.id}
                htmlFor={`contact-${contact.id}`}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  id={`contact-${contact.id}`}
                  checked={checked}
                  onCheckedChange={(value) => toggle(contact.id, value === true)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{contactLabel(contact)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[contact.company, contact.phone, contact.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts match your search.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
