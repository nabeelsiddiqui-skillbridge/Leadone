"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, type AdminNavItem } from "./nav-items";

function AdminNavLink({ item }: { item: AdminNavItem }) {
  const pathname = usePathname();
  const active =
    item.href === "/super-admin"
      ? pathname === "/super-admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function AdminSidebarNav() {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {ADMIN_NAV_ITEMS.map((item) => (
        <AdminNavLink key={item.href} item={item} />
      ))}
    </nav>
  );
}
