"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadsExistingTab } from "./leads-existing-tab";
import { LeadsCsvTab } from "./leads-csv-tab";
import { LeadsManualTab } from "./leads-manual-tab";
import { totalLeadCount, type ContactOption, type WizardState } from "./types";

export function StepLeads({
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
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">
        {totalLeadCount(state)} lead{totalLeadCount(state) === 1 ? "" : "s"} staged for this campaign
      </p>
      <Tabs defaultValue="existing">
        <TabsList>
          <TabsTrigger value="existing">Select existing contacts</TabsTrigger>
          <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          <TabsTrigger value="manual">Manual entry</TabsTrigger>
        </TabsList>
        <TabsContent value="existing">
          <LeadsExistingTab state={state} update={update} contacts={contacts} contactsCapped={contactsCapped} />
        </TabsContent>
        <TabsContent value="csv">
          <LeadsCsvTab state={state} update={update} />
        </TabsContent>
        <TabsContent value="manual">
          <LeadsManualTab state={state} update={update} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
