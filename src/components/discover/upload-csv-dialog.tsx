"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { UploadCloud, Loader2 } from "lucide-react";

import { runCustomerCsvDiscoveryAction } from "@/app/(app)/discover/actions";
import type { CustomerCsvRow } from "@/lib/discovery/sources/customerCsv";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const FIELDS: { key: keyof CustomerCsvRow; label: string; required?: boolean }[] = [
  { key: "name", label: "Company name", required: true },
  { key: "website", label: "Website" },
  { key: "industry", label: "Industry" },
  { key: "location", label: "Location" },
  { key: "companySize", label: "Company size" },
  { key: "contactName", label: "Contact name" },
  { key: "contactTitle", label: "Contact title" },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "notes", label: "Notes" },
];

const NONE = "__none__";

export function UploadCsvDialog({ discoveryProfileId }: { discoveryProfileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<keyof CustomerCsvRow, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        setHeaders(fields);
        setRows(results.data);

        const guess: Partial<Record<keyof CustomerCsvRow, string>> = {};
        const lower = (s: string) => s.trim().toLowerCase();
        for (const field of fields) {
          const l = lower(field);
          if (!guess.name && /company|business|name|organi[sz]ation/.test(l)) guess.name = field;
          else if (!guess.website && /website|domain|url/.test(l)) guess.website = field;
          else if (!guess.industry && /industry|sector/.test(l)) guess.industry = field;
          else if (!guess.location && /location|city|state|country/.test(l)) guess.location = field;
          else if (!guess.companySize && /size|employees|headcount/.test(l)) guess.companySize = field;
          else if (!guess.contactName && /contact.?name/.test(l)) guess.contactName = field;
          else if (!guess.contactTitle && /title|role/.test(l)) guess.contactTitle = field;
          else if (!guess.contactEmail && /email/.test(l)) guess.contactEmail = field;
          else if (!guess.contactPhone && /phone|mobile/.test(l)) guess.contactPhone = field;
          else if (!guess.notes && /note/.test(l)) guess.notes = field;
        }
        setMapping(guess);
      },
      error: (error) => toast.error(`Could not parse CSV: ${error.message}`),
    });
  }

  async function handleImport() {
    if (!mapping.name) {
      toast.error("Map a Company name column first.");
      return;
    }
    const mappedRows: CustomerCsvRow[] = rows
      .map((row) => ({
        name: (mapping.name ? row[mapping.name] : "")?.trim() ?? "",
        website: mapping.website ? row[mapping.website]?.trim() : undefined,
        industry: mapping.industry ? row[mapping.industry]?.trim() : undefined,
        location: mapping.location ? row[mapping.location]?.trim() : undefined,
        companySize: mapping.companySize ? row[mapping.companySize]?.trim() : undefined,
        contactName: mapping.contactName ? row[mapping.contactName]?.trim() : undefined,
        contactTitle: mapping.contactTitle ? row[mapping.contactTitle]?.trim() : undefined,
        contactEmail: mapping.contactEmail ? row[mapping.contactEmail]?.trim() : undefined,
        contactPhone: mapping.contactPhone ? row[mapping.contactPhone]?.trim() : undefined,
        notes: mapping.notes ? row[mapping.notes]?.trim() : undefined,
      }))
      .filter((r) => r.name);

    if (mappedRows.length === 0) {
      toast.error("No rows had a value in the mapped Company name column.");
      return;
    }

    setSubmitting(true);
    const result = await runCustomerCsvDiscoveryAction(discoveryProfileId, mappedRows);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Found ${result.companiesFound ?? 0} new companies, created ${result.leadsCreated ?? 0} leads.`);
    setOpen(false);
    setHeaders([]);
    setRows([]);
    setFileName(null);
    setMapping({});
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UploadCloud /> Upload company list
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload your own company list</DialogTitle>
          <DialogDescription>
            A CSV of companies you already have permission to reach out to. No API key needed - this always works.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 ? (
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
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            <p className="text-sm font-medium">
              Map columns from {fileName} ({rows.length} rows)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <Label>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  <Select
                    value={mapping[field.key] ?? NONE}
                    onValueChange={(value) => setMapping((prev) => ({ ...prev, [field.key]: value === NONE ? undefined : value }))}
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
          </div>
        )}

        {headers.length > 0 && (
          <DialogFooter>
            <Button type="button" onClick={handleImport} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitting ? "Running discovery…" : `Import ${rows.length} companies`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
