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
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/65 hover:bg-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
        )}
      />
      {item.label}
    </Link>
  );
}

export function AdminSidebarNav() {
  return (
    <nav className="scrollbar-thin flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {ADMIN_NAV_ITEMS.map((item) => (
        <AdminNavLink key={item.href} item={item} />
      ))}
    </nav>
  );
}
