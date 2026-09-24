import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every route under /api/ handles its own auth (session for browser
  // callers, a shared-secret header for the campaign worker/cron/webhooks) -
  // this proxy's redirect-to-/login is only meaningful for page navigation.
  // Applying it to /api/* turned a same-origin, cookie-less POST (from the
  // campaign worker or an external cron scheduler) into a redirect to the
  // /login *page*, and POSTing to a page route is a 405.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
