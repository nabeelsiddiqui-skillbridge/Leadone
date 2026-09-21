"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ALL = "__all__";

export function CallsFilters({
  agents,
  campaigns,
}: {
  agents: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("agentId") ?? ALL} onValueChange={(v) => setParam("agentId", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All agents" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All agents</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("campaignId") ?? ALL} onValueChange={(v) => setParam("campaignId", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All campaigns" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All campaigns</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("outcome") ?? ALL} onValueChange={(v) => setParam("outcome", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All outcomes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All outcomes</SelectItem>
          <SelectItem value="qualified">Qualified</SelectItem>
          <SelectItem value="appointment_booked">Appointment booked</SelectItem>
          <SelectItem value="not_interested">Not interested</SelectItem>
          <SelectItem value="follow_up_needed">Follow up needed</SelectItem>
          <SelectItem value="voicemail">Voicemail</SelectItem>
          <SelectItem value="wrong_number">Wrong number</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("hasAppointment") ?? ALL}
        onValueChange={(v) => setParam("hasAppointment", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Appointment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any</SelectItem>
          <SelectItem value="true">Booked an appointment</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-40"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
      />
      <Input
        type="date"
        className="w-40"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
      />

      {searchParams.toString() && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
