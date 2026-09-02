import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  FRONTEND_ACCESS_COOKIE,
  isPublicFrontendPath,
  isStaticAssetPath,
  verifyFrontendAccessToken,
} from "@/lib/frontend-access";

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
  //
  // /setup-account (token-based password creation for newly approved members)
  // and /pay/* (emailed, token-validated payment links) are deliberately
  // session-less: a brand-new member has no session yet, so they must stay
  // public even under the whole-site login wall, or the emailed setup and
  // payment links bounce straight to /login.
  //
  // /support (PR 10C) is the permanent public contribution page — the printed
  // QR points here, so it must work for anyone with no session at all. The
  // page itself is fail-closed: with no ACTIVE campaign it renders a quiet
  // notice and the checkout API refuses in the database before any Stripe call.
  const isPublicPath =
    path === "/login" ||
    path.startsWith("/auth/") ||
    path === "/auth" ||
    path === "/preview-logout" ||
    path === "/setup-account" ||
    path === "/pay" ||
    path.startsWith("/pay/") ||
    path === "/support" ||
    path.startsWith("/support/");

  if (!user && !isPublicPath) {
    // Front-end-only access: a signed, HTTP-only cookie that lets an approved
    // visitor (who is NOT a Supabase member) view the public marketing site.
    // It never confers member or founder status — it only unlocks the
    // deny-by-default public allowlist; every other route (portal, dashboard,
    // ops, intake, etc.) redirects them to the public homepage.
    const hasFrontendAccess = await verifyFrontendAccessToken(
      process.env.FRONTEND_ACCESS_COOKIE_SECRET,
      request.cookies.get(FRONTEND_ACCESS_COOKIE)?.value,
    );
    if (hasFrontendAccess) {
      if (isPublicFrontendPath(path) || isStaticAssetPath(path)) {
        return supabaseResponse;
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

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

    // Accounts whose sign-in still works but which hold no portal access.
    // Hardcoded alongside FOUNDER_IDS for the same reason: the check runs on
    // every request, so it stays query-free.
    //
    // These accounts keep their credentials while the access they should
    // hold is still being worked out, so until it is settled they land on
    // the public site instead of the member portal.
    const PORTAL_RESTRICTED_IDS = [
      "88859822-90be-41fb-b003-4d6a0a8b1c38", // mattmontee@mac.com
      "1ba49fa4-35f2-469b-a3c7-21e121437734", // martin.vivien@gmail.com
    ];

    // Restricted accounts keep the public marketing site and /login only;
    // every members-only route sends them back to the homepage. Any session
    // already open is cut off at the next request.
    if (PORTAL_RESTRICTED_IDS.includes(user.id)) {
      if (isPublicFrontendPath(path) || isStaticAssetPath(path) || isPublicPath) {
        return supabaseResponse;
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

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
  //
  // Media (mp4/webm) is excluded like images so it serves publicly — the
  // login gate's hero video must load for logged-out visitors. This does not
  // change page gating; the only /public videos are the decorative hero loop.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map|txt|xml|mp4|webm)$).*)",
  ],
};
