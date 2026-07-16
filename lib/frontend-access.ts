// Front-end-only access: a shared, non-member login that lets an approved
// visitor view the public-facing marketing site — and nothing else.
//
// This module is deliberately runtime-agnostic (Web Crypto, TextEncoder, btoa,
// Date.now — all available in both the Edge middleware and the Node route
// handler). It contains NO credentials: the shared email/password and the
// signing secret live only in server-only environment variables and are read
// by the API route and middleware, never bundled to the browser.

const enc = new TextEncoder();

/** Signed, HTTP-only cookie name. Its presence means only "may view the
 *  public site" — never member or admin. */
export const FRONTEND_ACCESS_COOKIE = "vk_frontend_access";

/** Cookie / token lifetime. Seven days, per spec. One value, one place. */
export const FRONTEND_ACCESS_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// Public-facing routes an approved front-end visitor may see. Deny-by-default:
// anything not in this set (member portal, dashboards, ops, intake, CRM, APIs,
// etc.) is off limits to the front-end cookie. Exact-match on the pathname.
const PUBLIC_FRONTEND_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/about",
  "/faq",
  "/iboga-guide",
  "/iboga-journey",
  "/healing-circle",
  "/church-information",
  "/island-residents",
  "/sacred-intimacy",
  "/stay",
  "/upcoming-ceremonies",
  "/vitality",
  "/testimonials",
  "/begin-your-journey",
  "/medical-disclaimer",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/terms-of-use",
  "/thank-you",
]);

/** True only for the explicitly-approved public marketing routes. */
export function isPublicFrontendPath(pathname: string): boolean {
  const p =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return PUBLIC_FRONTEND_PATHS.has(p);
}

// Static media/asset files the public pages need to render (hero video, audio,
// fonts, etc.). The middleware matcher already lets images/css/js through; this
// covers the extensions it does NOT (notably video like .mp4/.webm). Content
// files that are deliberately gated — .html guides, .pdf, data — are excluded.
const STATIC_ASSET_RE =
  /\.(?:mp4|webm|mov|m4v|ogv|ogg|mp3|wav|m4a|aac|flac|avif|apng|svg|png|jpe?g|gif|webp|ico|css|js|mjs|cjs|woff2?|ttf|otf|eot|map)$/i;

/** True for static asset requests (by file extension) that public pages load. */
export function isStaticAssetPath(pathname: string): boolean {
  return STATIC_ASSET_RE.test(pathname);
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

async function sha256(message: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(message)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Constant-time secret comparison. Both sides are hashed to a fixed-length
 *  digest first, so neither content nor length leaks through timing. */
export async function secretsMatch(submitted: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(submitted), sha256(expected)]);
  return constantTimeEqual(a, b);
}

/** Mint a token: "<expiryMs>.<base64url(HMAC-SHA256(secret, expiryMs))>". */
export async function signFrontendAccessToken(secret: string, expiryMs: number): Promise<string> {
  const payload = String(expiryMs);
  const sig = base64url(await hmacSha256(secret, payload));
  return `${payload}.${sig}`;
}

/** Verify signature and expiry in constant time. Returns false for a missing,
 *  malformed, tampered, or expired token — or when the secret is unset (the
 *  feature is simply inert until configured). */
export async function verifyFrontendAccessToken(
  secret: string | undefined,
  token: string | undefined,
): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiryMs = Number(payload);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) return false;
  const expected = base64url(await hmacSha256(secret, payload));
  return constantTimeEqual(enc.encode(sig), enc.encode(expected));
}
