"use client";

import { useState, useTransition } from "react";
import { Search, Phone } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AvailableNumber } from "@/lib/twilio";
import { searchNumbersAction, purchaseAndAssignAction } from "@/app/super-admin/phone-numbers/actions";

export interface WorkspaceOption {
  id: string;
  name: string;
}

export function PhoneNumberProvisioner({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>(workspaces[0]?.id ?? "");
  const [isSearching, startSearch] = useTransition();
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);
  const [isPurchasing, startPurchase] = useTransition();

  function handleSearch() {
    startSearch(async () => {
      const result = await searchNumbersAction(areaCode);
      if (result.error) {
        toast.error(result.error);
        setResults(null);
        return;
      }
      if (result.message) toast.message(result.message);
      setResults(result.numbers ?? []);
    });
  }

  function handlePurchase(number: AvailableNumber) {
    if (!workspaceId) {
      toast.error("Choose a workspace to assign the number to first.");
      return;
    }
    setPurchasingNumber(number.phoneNumber);
    startPurchase(async () => {
      const result = await purchaseAndAssignAction(number.phoneNumber, workspaceId, number.friendlyName);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Number purchased and assigned.");
        setResults((prev) => prev?.filter((n) => n.phoneNumber !== number.phoneNumber) ?? null);
      }
      setPurchasingNumber(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Buy a new number</CardTitle>
        <CardDescription>
          Searches and purchases on the platform&apos;s own Twilio account (Settings → APIs), then assigns the
          number straight to a user&apos;s workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Area code</Label>
            <Input
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="415"
              className="w-24"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Assign to workspace</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={isSearching || areaCode.length !== 3}>
            <Search /> {isSearching ? "Searching…" : "Search"}
          </Button>
        </div>

        {results && results.length > 0 && (
          <ul className="divide-y rounded-md border">
            {results.map((number) => (
              <li key={number.phoneNumber} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium">{number.phoneNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[number.locality, number.region].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPurchasing && purchasingNumber === number.phoneNumber}
                  onClick={() => handlePurchase(number)}
                >
                  {isPurchasing && purchasingNumber === number.phoneNumber ? "Purchasing…" : "Buy & assign"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {results && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No numbers found for that area code.</p>
        )}
      </CardContent>
    </Card>
  );
}
