import Link from "next/link";
import { Plus } from "lucide-react";

import { Card } from "@/components/ui/card";

export function CreateCustomAgentCard() {
  return (
    <Link href="/agents/new" className="group block h-full">
      <Card className="flex h-full min-h-56 flex-col items-center justify-center gap-3 border-dashed p-5 text-center transition-colors group-hover:border-primary group-hover:bg-primary/5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
          <Plus className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold text-foreground">Create custom agent</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a blank agent and configure every field yourself.
          </p>
        </div>
      </Card>
    </Link>
  );
}
