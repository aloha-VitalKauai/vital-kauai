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

  // Not logged in — protect both portal and dashboard
  if (!user && (path.startsWith("/portal") || path.startsWith("/dashboard"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("Middleware role check:", { userId: user.id, roleRow, roleError, path });

    const role = roleRow?.role ?? "member";

    // Protect /dashboard — founders only, send members back to portal
    if (path.startsWith("/dashboard") && role !== "founder") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    // If founder is on /login, send them to dashboard
    if (path === "/login" && role === "founder") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // If founder hits /portal, redirect to dashboard
    if (path.startsWith("/portal") && role === "founder") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/portal/:path*", "/dashboard/:path*", "/login"],
};
