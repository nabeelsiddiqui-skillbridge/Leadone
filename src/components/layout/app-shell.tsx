"use client";

import { useState } from "react";
import { Menu, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { HeaderSearch } from "./header-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ${className}`}
    >
      <Phone className="size-3.5" strokeWidth={2.5} />
    </span>
  );
}

export function AppShell({
  children,
  workspaceName,
  fullName,
  email,
  isSuperAdmin,
}: {
  children: ReactNode;
  workspaceName: string;
  fullName: string | null;
  email: string | null;
  isSuperAdmin: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <LogoMark />
          <span className="font-semibold tracking-tight text-sidebar-foreground">LeadOne</span>
        </div>
        <SidebarNav />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle className="flex items-center gap-2 text-left">
              <LogoMark />
              LeadOne
            </SheetTitle>
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <span className="hidden shrink-0 truncate text-sm font-medium text-muted-foreground md:block">
            {workspaceName}
          </span>
          <div className="flex flex-1 justify-center">
            <HeaderSearch />
          </div>
          <UserMenu fullName={fullName} email={email} isSuperAdmin={isSuperAdmin} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
