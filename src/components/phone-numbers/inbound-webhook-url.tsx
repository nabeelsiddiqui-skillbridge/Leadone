"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function InboundWebhookUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked (permissions, insecure context) — the
      // URL is still fully visible/selectable in the code block below.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-md bg-muted px-2 py-1 text-xs break-all">{url}</code>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
