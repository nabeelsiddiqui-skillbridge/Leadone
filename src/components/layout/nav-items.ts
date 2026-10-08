import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bot,
  Megaphone,
  Users,
  PhoneCall,
  CalendarClock,
  Phone,
  Plug,
  BarChart3,
  Settings,
  UserCircle,
  LifeBuoy,
  MessageSquareText,
  Inbox,
  Radar,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Discover", href: "/discover", icon: Radar },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Leads", href: "/contacts", icon: Users },
  { label: "Calls", href: "/calls", icon: PhoneCall },
  { label: "Appointments", href: "/appointments", icon: CalendarClock },
  { label: "Chat Widgets", href: "/widgets", icon: MessageSquareText },
  { label: "Live Chat", href: "/live-chat", icon: Inbox },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Phone Numbers", href: "/phone-numbers", icon: Phone },
  { label: "Integrations", href: "/integrations", icon: Plug },
];

export const NAV_ITEMS_SECONDARY: NavItem[] = [
  { label: "Support", href: "/support", icon: LifeBuoy },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Account", href: "/account", icon: UserCircle },
];
