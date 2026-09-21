"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShieldCheck, ArrowLeft, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { AdminSidebarNav } from "./admin-sidebar-nav";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string | null, email: string | null) {
  const source = name || email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function BrandMark() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <span className="flex size-7 items-center justify-center rounded-md bg-warning text-warning-foreground">
        <ShieldCheck className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold text-sidebar-foreground">LeadOne Admin</span>
        <span className="text-[10px] font-medium tracking-wide text-warning uppercase">
          Platform console
        </span>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  fullName,
  email,
}: {
  children: ReactNode;
  fullName: string | null;
  email: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-t-2 border-sidebar-border border-t-warning bg-sidebar md:flex">
        <BrandMark />
        <AdminSidebarNav />
        <div className="border-t border-sidebar-border p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Back to app
          </Link>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle className="text-left">LeadOne Admin</SheetTitle>
          </SheetHeader>
          <AdminSidebarNav />
          <div className="border-t border-sidebar-border p-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Back to app
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <Badge variant="warning" className="hidden sm:inline-flex">
              Super Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="truncate text-sm font-medium">{fullName || "Admin"}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
            <Avatar className="size-8">
              <AvatarFallback>{initials(fullName, email)}</AvatarFallback>
            </Avatar>
            <form action={signOutAction}>
              <Button variant="ghost" size="icon" type="submit" title="Sign out">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
