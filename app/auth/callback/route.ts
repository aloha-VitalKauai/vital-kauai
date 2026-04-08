import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeNextPath(input: string | null) {
  if (!input) return "/portal";
  if (!input.startsWith("/")) return "/portal";
  if (input.startsWith("//")) return "/portal";
  return input;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Missing%20authentication%20code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
