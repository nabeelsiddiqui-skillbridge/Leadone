import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContactStatus } from "@/lib/supabase/database.types";

import { contactStatusBadgeProps, contactStatusLabel } from "@/components/contacts/constants";

export function ContactStatusBadge({ status, className }: { status: ContactStatus; className?: string }) {
  const { variant, className: variantClassName } = contactStatusBadgeProps(status);
  return (
    <Badge variant={variant} className={cn(variantClassName, className)}>
      {contactStatusLabel(status)}
    </Badge>
  );
}
