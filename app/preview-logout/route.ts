import { NextResponse } from "next/server";
import { FRONTEND_ACCESS_COOKIE } from "@/lib/frontend-access";

// One-click sign-out for the shared front-end preview login. Visiting
// /preview-logout clears the vk_frontend_access cookie and returns to the
// sign-in screen. It touches only the preview cookie — a real member's
// Supabase session is untouched. Reachable regardless of state because
// /preview-logout is in the middleware's public-path list.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(FRONTEND_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
