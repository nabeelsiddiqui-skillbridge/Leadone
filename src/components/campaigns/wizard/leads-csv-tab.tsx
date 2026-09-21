"use client";

import * as React from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { NewLeadDraft, WizardState } from "./types";

const TARGET_FIELDS: { key: keyof MappableFields; label: string; required?: boolean }[] = [
  { key: "phone", label: "Phone", required: true },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
];

interface MappableFields {
  phone: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
}

const NONE = "__none__";

let tempIdCounter = 0;
function nextTempId() {
  tempIdCounter += 1;
  return `csv-${Date.now()}-${tempIdCounter}`;
}

export function LeadsCsvTab({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [mapping, setMapping] = React.useState<Partial<MappableFields>>({});

  const csvLeadsCount = state.newLeads.filter((lead) => lead.source === "csv").length;

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        setHeaders(fields);
        setRows(results.data);

        // Best-effort auto-mapping by common header names.
        const guess: Partial<MappableFields> = {};
        const lower = (s: string) => s.trim().toLowerCase();
        for (const field of fields) {
          const l = lower(field);
          if (!guess.phone && /phone|mobile|number/.test(l)) guess.phone = field;
          else if (!guess.first_name && /first.?name/.test(l)) guess.first_name = field;
          else if (!guess.last_name && /last.?name/.test(l)) guess.last_name = field;
          else if (!guess.company && /company|organization|org/.test(l)) guess.company = field;
          else if (!guess.email && /email/.test(l)) guess.email = field;
        }
        setMapping(guess);
      },
      error: (error) => {
        toast.error(`Could not parse CSV: ${error.message}`);
      },
    });
  }

  function addMappedLeads() {
    if (!mapping.phone) {
      toast.error("Map a Phone column before adding leads.");
      return;
    }
    const drafts: NewLeadDraft[] = [];
    for (const row of rows) {
      const phone = (mapping.phone ? row[mapping.phone] : "")?.trim();
      if (!phone) continue;
      drafts.push({
        tempId: nextTempId(),
        source: "csv",
        phone,
        first_name: (mapping.first_name ? row[mapping.first_name] : "")?.trim() ?? "",
        last_name: (mapping.last_name ? row[mapping.last_name] : "")?.trim() ?? "",
        company: (mapping.company ? row[mapping.company] : "")?.trim() ?? "",
        email: (mapping.email ? row[mapping.email] : "")?.trim() ?? "",
      });
    }
    if (drafts.length === 0) {
      toast.error("No rows had a value in the mapped Phone column.");
      return;
    }
    update({ newLeads: [...state.newLeads, ...drafts] });
    toast.success(`Added ${drafts.length} leads from ${fileName ?? "the CSV"}.`);
    setHeaders([]);
    setRows([]);
    setFileName(null);
    setMapping({});
  }

  function clearCsvLeads() {
    update({ newLeads: state.newLeads.filter((lead) => lead.source !== "csv") });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center hover:bg-muted/50">
        <UploadCloud className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">Click to upload a CSV file</span>
        <span className="text-xs text-muted-foreground">First row should be column headers</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>

      {headers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            Map columns from {fileName} ({rows.length} rows)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGET_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                <Select
                  value={mapping[field.key] ?? NONE}
                  onValueChange={(value) =>
                    setMapping((prev) => ({ ...prev, [field.key]: value === NONE ? undefined : value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Not mapped" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not mapped</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button type="button" onClick={addMappedLeads} className="self-start">
            Add {rows.length} leads to campaign
          </Button>
        </div>
      )}

      {csvLeadsCount > 0 && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{csvLeadsCount} leads added from CSV.</span>
            <Button type="button" variant="ghost" size="sm" onClick={clearCsvLeads}>
              Remove all
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
