import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bot,
  Megaphone,
  Users,
  PhoneCall,
  CalendarClock,
  BookOpen,
  Phone,
  Plug,
  BarChart3,
  Settings,
  UserCircle,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Calls", href: "/calls", icon: PhoneCall },
  { label: "Appointments", href: "/appointments", icon: CalendarClock },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { label: "Phone Numbers", href: "/phone-numbers", icon: Phone },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export const NAV_ITEMS_SECONDARY: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Account", href: "/account", icon: UserCircle },
];
