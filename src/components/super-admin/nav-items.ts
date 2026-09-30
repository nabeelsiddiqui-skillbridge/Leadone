import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Bot,
  Megaphone,
  PhoneCall,
  Plug,
  CreditCard,
  LifeBuoy,
  Phone,
  Radar,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
  { label: "Users", href: "/super-admin/users", icon: Users },
  { label: "Agents", href: "/super-admin/agents", icon: Bot },
  { label: "Campaigns", href: "/super-admin/campaigns", icon: Megaphone },
  { label: "Calls", href: "/super-admin/calls", icon: PhoneCall },
  { label: "Discovery", href: "/super-admin/discovery", icon: Radar },
  { label: "Plans", href: "/super-admin/plans", icon: CreditCard },
  { label: "Phone Numbers", href: "/super-admin/phone-numbers", icon: Phone },
  { label: "Tickets", href: "/super-admin/tickets", icon: LifeBuoy },
  { label: "Settings → APIs", href: "/super-admin/settings/apis", icon: Plug },
];
