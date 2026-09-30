"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/lib/supabase/database.types";

type DiscoveryProfileRow = Database["public"]["Tables"]["discovery_profiles"]["Row"];

export function ProfileSwitcher({
  profiles,
  activeProfileId,
}: {
  profiles: DiscoveryProfileRow[];
  activeProfileId: string;
}) {
  const router = useRouter();

  if (profiles.length <= 1) return null;

  return (
    <Select value={activeProfileId} onValueChange={(value) => router.push(`/discover?profile=${value}`)}>
      <SelectTrigger className="w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
