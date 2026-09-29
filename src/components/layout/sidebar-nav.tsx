"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_ITEMS_SECONDARY, type NavItem } from "./nav-items";

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 text-[10px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase">
      {children}
    </p>
  );
}

export function SidebarNav() {
  return (
    <nav className="scrollbar-thin flex flex-1 flex-col gap-6 overflow-y-auto p-3">
      <div className="flex flex-col gap-2">
        <SectionLabel>Menu</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <SectionLabel>General</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS_SECONDARY.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>
    </nav>
  );
}
