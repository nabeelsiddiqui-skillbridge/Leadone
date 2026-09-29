import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

// Auth pages: public, and a logged-in user gets bounced off them back to the
// dashboard (see the `user && isAuthPath` check below) so a signed-in user
// doesn't land back on /login.
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];
// Everything here plus AUTH_PATHS never requires a session — but unlike auth
// pages, these stay visible to a logged-in user too. /widget in particular
// must: it's the embeddable widget page, and the workspace owner testing
// their own embed snippet is very often logged into the dashboard in the
// same browser at the time.
const PUBLIC_PATHS = [...AUTH_PATHS, "/widget"];

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  // The embed script itself (public/widget.js) — an anonymous visitor's
  // browser requests this directly via a <script src> tag on a third-party
  // site. It doesn't match the "/widget" prefix below (no trailing slash),
  // and static-file extension exclusions in proxy.ts's matcher only cover
  // image types, not .js, so without this it was being redirected to
  // /login and returned as HTML instead of executing as the embed script -
  // silently breaking every embed for a signed-out visitor.
  if (pathname === "/widget.js") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and gates access to
 * the authenticated app and the Super Admin area. Called from proxy.ts (the
 * Next.js 16 rename of middleware.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && pathname.startsWith("/super-admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("platform_role")
      .eq("id", user.id)
      .single();

    if (profile?.platform_role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}
