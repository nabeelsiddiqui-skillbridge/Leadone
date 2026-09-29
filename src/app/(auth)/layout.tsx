import Link from "next/link";
import { Phone } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 45%), radial-gradient(circle at 85% 80%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 50%)",
        }}
      />
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Phone className="size-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-semibold tracking-tight">LeadOne</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
