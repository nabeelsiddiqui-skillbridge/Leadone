"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmbedSnippet({ publicKey, appUrl }: { publicKey: string; appUrl: string }) {
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="${appUrl}/widget.js" data-widget-key="${publicKey}" async></script>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked (permissions, insecure context) — the snippet is still
      // fully visible/selectable in the code block below, so this is a soft failure.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
        <code>{snippet}</code>
      </pre>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="self-start">
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy snippet"}
      </Button>
    </div>
  );
}
