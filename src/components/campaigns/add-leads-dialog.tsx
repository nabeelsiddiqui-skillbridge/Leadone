"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { addLeadsToCampaignAction } from "@/app/(app)/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import type { ContactOption } from "@/components/campaigns/wizard/types";

function contactLabel(contact: ContactOption) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  return name || contact.phone;
}

export function AddLeadsDialog({
  campaignId,
  availableContacts,
  contactsCapped,
}: {
  campaignId: string;
  availableContacts: ContactOption[];
  contactsCapped: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableContacts;
    return availableContacts.filter((contact) => {
      const haystack = [contact.first_name, contact.last_name, contact.company, contact.phone, contact.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [availableContacts, search]);

  function toggle(contactId: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, contactId] : prev.filter((id) => id !== contactId)));
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await addLeadsToCampaignAction(campaignId, selected);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added ${selected.length} lead${selected.length === 1 ? "" : "s"}.`);
      setSelected([]);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus /> Add leads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add leads to this calling list</DialogTitle>
          <DialogDescription>Pick contacts to queue up for this agent to call.</DialogDescription>
        </DialogHeader>

        {availableContacts.length === 0 ? (
          <EmptyState
            title="No contacts available"
            description="Every contact is already on this list, or you haven't added any contacts yet."
            actionHref="/contacts"
            actionLabel="Go to Contacts"
          />
        ) : (
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
              {selected.length} selected
              {contactsCapped ? ` · showing the first ${availableContacts.length} contacts (search to narrow further)` : ""}
            </p>
            <ScrollArea className="h-72 rounded-md border">
              <div className="divide-y">
                {filtered.map((contact) => {
                  const checked = selected.includes(contact.id);
                  return (
                    <label
                      key={contact.id}
                      htmlFor={`add-lead-${contact.id}`}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`add-lead-${contact.id}`}
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
        )}

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={pending || selected.length === 0}>
            {pending ? "Adding…" : `Add ${selected.length || ""} lead${selected.length === 1 ? "" : "s"}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
