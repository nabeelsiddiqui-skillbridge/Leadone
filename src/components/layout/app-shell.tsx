"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";

import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            L
          </span>
          <span className="font-semibold text-sidebar-foreground">LeadOne</span>
        </div>
        <SidebarNav />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle className="text-left">LeadOne</SheetTitle>
          </SheetHeader>
          <SidebarNav />
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
            <span className="truncate text-sm font-medium text-muted-foreground">
              {workspaceName}
            </span>
          </div>
          <UserMenu fullName={fullName} email={email} isSuperAdmin={isSuperAdmin} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
