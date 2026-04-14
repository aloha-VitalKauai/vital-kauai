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

  // Not logged in — protect portal, dashboard, ops, and founders
  if (!user && (path.startsWith("/portal") || path.startsWith("/dashboard") || path.startsWith("/ops") || path.startsWith("/founders"))) {
    return NextResponse.redirect(new URL("/login", request.url));
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
  matcher: ["/portal/:path*", "/dashboard/:path*", "/ops/:path*", "/founders/:path*", "/login"],
};
