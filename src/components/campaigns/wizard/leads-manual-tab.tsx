"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { NewLeadDraft, WizardState } from "./types";

let tempIdCounter = 0;
function nextTempId() {
  tempIdCounter += 1;
  return `manual-${Date.now()}-${tempIdCounter}`;
}

function blankLead(): NewLeadDraft {
  return {
    tempId: nextTempId(),
    source: "manual",
    first_name: "",
    last_name: "",
    company: "",
    phone: "",
    email: "",
  };
}

export function LeadsManualTab({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  const manualLeads = state.newLeads.filter((lead) => lead.source === "manual");
  const otherLeads = state.newLeads.filter((lead) => lead.source !== "manual");
  const rows = manualLeads.length > 0 ? manualLeads : [blankLead()];

  function setRows(next: NewLeadDraft[]) {
    update({ newLeads: [...otherLeads, ...next] });
  }

  function updateRow(tempId: string, patch: Partial<NewLeadDraft>) {
    setRows(rows.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows([...rows, blankLead()]);
  }

  function removeRow(tempId: string) {
    const next = rows.filter((row) => row.tempId !== tempId);
    setRows(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Add a handful of leads by hand. Phone is required.</p>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.tempId} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-6">
            <div className="grid gap-1 sm:col-span-1">
              <Label className="text-xs">First name</Label>
              <Input
                value={row.first_name}
                onChange={(e) => updateRow(row.tempId, { first_name: e.target.value })}
              />
            </div>
            <div className="grid gap-1 sm:col-span-1">
              <Label className="text-xs">Last name</Label>
              <Input
                value={row.last_name}
                onChange={(e) => updateRow(row.tempId, { last_name: e.target.value })}
              />
            </div>
            <div className="grid gap-1 sm:col-span-1">
              <Label className="text-xs">Company</Label>
              <Input
                value={row.company}
                onChange={(e) => updateRow(row.tempId, { company: e.target.value })}
              />
            </div>
            <div className="grid gap-1 sm:col-span-1">
              <Label className="text-xs">Phone *</Label>
              <Input
                value={row.phone}
                onChange={(e) => updateRow(row.tempId, { phone: e.target.value })}
                placeholder="+1 555 555 0100"
              />
            </div>
            <div className="grid gap-1 sm:col-span-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(row.tempId, { email: e.target.value })}
              />
            </div>
            <div className="flex items-end sm:col-span-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.tempId)}
                aria-label="Remove row"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={addRow} className="self-start">
        <Plus className="size-4" />
        Add another lead
      </Button>
    </div>
  );
}
