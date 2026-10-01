"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadCard } from "@/components/discover/lead-card";
import type { LeadCardData } from "@/components/discover/types";
import type { DiscoveredLeadStatus } from "@/lib/supabase/database.types";

const TABS: { value: DiscoveredLeadStatus | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "converted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function DiscoverLeadList({
  leads,
  agents,
}: {
  leads: LeadCardData[];
  agents: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<DiscoveredLeadStatus | "all">("new");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const byStatus = tab === "all" ? leads : leads.filter((l) => l.status === tab);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (l) =>
        l.company.name.toLowerCase().includes(q) ||
        (l.company.industry ?? "").toLowerCase().includes(q) ||
        (l.company.location ?? "").toLowerCase().includes(q)
    );
  }, [leads, tab, query]);

  // Highest-fit leads first within a tab, unscored ones last.
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1)),
    [filtered]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as DiscoveredLeadStatus | "all")}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {t.value !== "all" && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {leads.filter((l) => l.status === t.value).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search company, industry…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No leads here yet"
          description={
            tab === "new"
              ? "Upload a company list to run your first discovery job."
              : "Nothing in this view yet."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((lead) => (
            <LeadCard key={lead.id} lead={lead} agents={agents} />
          ))}
        </div>
      )}
    </div>
  );
}
