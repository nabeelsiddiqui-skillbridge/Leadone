"use client";

import { useState, useTransition } from "react";
import { Search, Phone, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { searchWorkspaceNumbersAction, purchaseWorkspaceNumberAction } from "@/app/(app)/phone-numbers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AvailableNumber } from "@/lib/twilio";

export function BuyPhoneNumberDialog() {
  const [open, setOpen] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);
  const [isPurchasing, startPurchase] = useTransition();

  function handleSearch() {
    setError(null);
    startSearch(async () => {
      const result = await searchWorkspaceNumbersAction(areaCode);
      if (result.error) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.numbers ?? []);
    });
  }

  function handlePurchase(number: AvailableNumber) {
    setError(null);
    setPurchasingNumber(number.phoneNumber);
    startPurchase(async () => {
      const result = await purchaseWorkspaceNumberAction(number.phoneNumber, number.friendlyName);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(result.message ?? "Number purchased.");
        setResults((prev) => prev?.filter((n) => n.phoneNumber !== number.phoneNumber) ?? null);
        setOpen(false);
      }
      setPurchasingNumber(null);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setResults(null);
          setAreaCode("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShoppingCart /> Buy a number
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buy a phone number</DialogTitle>
          <DialogDescription>
            Searches and purchases on your workspace&apos;s own Twilio account (connected under Integrations) -
            the number is added here automatically once bought.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Area code</Label>
            <Input
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="415"
              className="w-24"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || areaCode.length !== 3}>
            <Search /> {isSearching ? "Searching…" : "Search"}
          </Button>
        </div>

        {results && results.length > 0 && (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
            {results.map((number) => (
              <li key={number.phoneNumber} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2">
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
                  {isPurchasing && purchasingNumber === number.phoneNumber ? "Purchasing…" : "Buy"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {results && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No numbers found for that area code.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
