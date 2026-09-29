"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = value.trim();
    router.push(term ? `/contacts?q=${encodeURIComponent(term)}` : "/contacts");
  }

  return (
    <form onSubmit={handleSubmit} className="hidden w-full max-w-sm sm:block">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search leads…"
          className="h-9 w-full rounded-lg border border-transparent bg-muted pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-input focus:bg-background"
        />
      </div>
    </form>
  );
}
