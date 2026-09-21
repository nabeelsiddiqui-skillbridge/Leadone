"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import {
  bulkImportContactsAction,
  type BulkImportResult,
  type ContactImportRow,
} from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IMPORT_TARGET_FIELDS, type ImportTargetField } from "@/components/contacts/constants";

type Step = "upload" | "map" | "preview" | "done";

type RawRow = Record<string, string>;

const GUESS_SYNONYMS: Record<Exclude<ImportTargetField, "custom" | "ignore">, string[]> = {
  first_name: ["firstname", "first", "fname", "givenname"],
  last_name: ["lastname", "last", "lname", "surname", "familyname"],
  company: ["company", "companyname", "organization", "org", "business"],
  phone: ["phone", "phonenumber", "mobile", "cell", "telephone", "tel"],
  email: ["email", "emailaddress", "e-mail"],
  website: ["website", "url", "site", "domain"],
  job_title: ["jobtitle", "title", "position", "role"],
  timezone: ["timezone", "tz"],
  country: ["country"],
  industry: ["industry", "sector", "vertical"],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessMapping(headers: string[]): Record<string, ImportTargetField> {
  const mapping: Record<string, ImportTargetField> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const match = (Object.entries(GUESS_SYNONYMS) as [Exclude<ImportTargetField, "custom" | "ignore">, string[]][]).find(
      ([, synonyms]) => synonyms.includes(normalized)
    );
    mapping[header] = match ? match[0] : "custom";
  }
  return mapping;
}

function mapRows(
  data: RawRow[],
  headers: string[],
  mapping: Record<string, ImportTargetField>
): ContactImportRow[] {
  return data.map((raw) => {
    const row: ContactImportRow = {};
    const customFields: Record<string, string> = {};
    for (const header of headers) {
      const target = mapping[header];
      const value = (raw[header] ?? "").trim();
      if (!target || target === "ignore" || !value) continue;
      if (target === "custom") {
        customFields[header] = value;
      } else {
        (row as Record<string, string>)[target] = value;
      }
    }
    if (Object.keys(customFields).length > 0) {
      row.custom_fields = customFields;
    }
    return row;
  });
}

export function ImportContactsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportTargetField>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const hasPhoneMapped = useMemo(() => Object.values(mapping).includes("phone"), [mapping]);
  const previewRows = useMemo(() => mapRows(rows.slice(0, 5), headers, mapping), [rows, headers, mapping]);

  function reset() {
    setStep("upload");
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setImporting(false);
    setResult(null);
  }

  function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedHeaders = results.meta.fields ?? [];
        if (parsedHeaders.length === 0 || results.data.length === 0) {
          setParseError("Couldn't find any columns or rows in that file.");
          return;
        }
        setHeaders(parsedHeaders);
        setRows(results.data);
        setMapping(guessMapping(parsedHeaders));
        setStep("map");
      },
      error: (error) => {
        setParseError(error.message || "Failed to parse CSV file.");
      },
    });
  }

  async function handleImport() {
    setImporting(true);
    try {
      const mappedRows = mapRows(rows, headers, mapping);
      const summary = await bulkImportContactsAction(mappedRows);
      setResult(summary);
      setStep("done");
      if (summary.error) {
        toast.error(`Import stopped: ${summary.error}`);
      } else {
        toast.success(`Imported ${summary.imported} contact${summary.imported === 1 ? "" : "s"}${summary.skipped ? `, skipped ${summary.skipped}` : ""}.`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file of leads to add to this workspace."}
            {step === "map" && "Map each CSV column to a contact field."}
            {step === "preview" && "Review the first 5 rows before importing."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="grid gap-4">
            {parseError && (
              <Alert variant="destructive">
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="csv-file">CSV file</Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
              />
              <p className="text-xs text-muted-foreground">
                First row must contain column headers. Phone numbers are required for every contact you want
                imported.
              </p>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {fileName} · {rows.length} row{rows.length === 1 ? "" : "s"} · {headers.length} column
              {headers.length === 1 ? "" : "s"}
            </p>
            {!hasPhoneMapped && (
              <Alert variant="destructive">
                <AlertDescription>Map at least one column to Phone to continue.</AlertDescription>
              </Alert>
            )}
            <ScrollArea className="h-72 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV column</TableHead>
                    <TableHead>Maps to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] ?? "ignore"}
                          onValueChange={(value) =>
                            setMapping((prev) => ({ ...prev, [header]: value as ImportTargetField }))
                          }
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMPORT_TARGET_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "preview" && (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Showing {previewRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"}.
            </p>
            <ScrollArea className="max-h-72 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Custom fields</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell>{row.company || "—"}</TableCell>
                      <TableCell>{row.phone || <span className="text-destructive">missing</span>}</TableCell>
                      <TableCell>{row.email || "—"}</TableCell>
                      <TableCell>
                        {row.custom_fields ? Object.keys(row.custom_fields).length : 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "done" && result && (
          <div className="grid gap-2">
            <Alert variant={result.error ? "destructive" : "success"}>
              <AlertDescription>
                Imported {result.imported} contact{result.imported === 1 ? "" : "s"}. Skipped {result.skipped}
                {result.skipped ? " (missing phone number or duplicate in file)" : ""}.
                {result.error ? ` Error: ${result.error}` : ""}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === "map" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!hasPhoneMapped}>
                Next: Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("map")} disabled={importing}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing…" : `Import ${rows.length} contact${rows.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
