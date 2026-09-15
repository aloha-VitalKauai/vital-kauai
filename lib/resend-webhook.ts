import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend webhook verification (Svix signing scheme) and the bounce rule.
 *
 * Resend signs each delivery with headers `svix-id`, `svix-timestamp` and
 * `svix-signature` ("v1,<base64>" entries, space separated). The signed
 * content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the secret
 * that follows the `whsec_` prefix, base64-decoded.
 */

export const RESEND_TOLERANCE_SECONDS = 5 * 60;

export function verifyResendSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signature, rawBody } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(now - ts) > RESEND_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    let given: Buffer;
    try { given = Buffer.from(sig, "base64"); } catch { continue; }
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

/** Event types after which we stop writing to that address. */
export const STOP_EVENTS = new Set(["email.bounced", "email.complained"]);

export function stopReasonFor(eventType: string): string | null {
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.complained") return "complained";
  return null;
}

/** Recipient addresses from a Resend event payload, lower-cased. */
export function recipientsFrom(body: unknown): string[] {
  const data = (body as { data?: { to?: unknown } })?.data;
  const to = data?.to;
  const list = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  return list.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase());
}
