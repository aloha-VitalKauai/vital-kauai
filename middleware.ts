import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Pages that are reachable without a session. Everything else on the site is
  // members-only — visitors get sent to /login. API routes and static assets
  // are excluded via the matcher below, not here.
  const isPublicPath =
    path === "/login" ||
    path.startsWith("/auth/") ||
    path === "/auth";

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    if (path && path !== "/") {
      loginUrl.searchParams.set("next", path + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    // Founder IDs — hardcoded for reliability (no DB query needed)
    const FOUNDER_IDS = [
      "d6e824e3-69ab-447c-b046-afecfe4b7028", // aloha@vitalkauai.com
      "268f721a-9c7c-4bb2-82b7-3c29178281b1", // joshuaperdue2@gmail.com
    ];

    const isFounder = FOUNDER_IDS.includes(user.id);

    // Protect /dashboard, /ops, /founders — founders only
    if ((path.startsWith("/dashboard") || path.startsWith("/ops") || path.startsWith("/founders")) && !isFounder) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    // Protect /nurse — nurse role only. The role query runs only on /nurse
    // paths, keeping the common case (member portal traffic) query-free.
    // The nurse layout re-checks server-side, so this is belt and braces.
    if (path.startsWith("/nurse")) {
      if (isFounder) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleRow?.role !== "nurse") {
        return NextResponse.redirect(new URL("/portal", request.url));
      }
    }

    // If founder is on /login, send them to dashboard
    if (path === "/login" && isFounder) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Founders can access /portal directly — no redirect
    // They land on /dashboard by default from login, but can navigate to /portal
  }

  return supabaseResponse;
}

export const config = {
  // Run on every request except Next.js internals, API routes (each handler
  // manages its own auth — Stripe webhooks, intake submission, etc.), and
  // static asset extensions. Public HTML pages like the Preparedness Guide
  // are intentionally included so they require a session too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map|txt|xml)$).*)",
  ],
};
