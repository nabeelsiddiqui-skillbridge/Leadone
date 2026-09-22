"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ALL = "__all__";

export function AdminCallsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="no_answer">No answer</SelectItem>
          <SelectItem value="busy">Busy</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("failedOnly") ?? ALL}
        onValueChange={(v) => setParam("failedOnly", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Failed calls" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All calls</SelectItem>
          <SelectItem value="true">Failed calls only</SelectItem>
        </SelectContent>
      </Select>

      {searchParams.toString() && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
