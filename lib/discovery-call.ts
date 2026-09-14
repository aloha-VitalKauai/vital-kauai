// The public discovery-call front door (/discovery-call) is the one page a
// stranger can reach while the rest of the site stays private. These helpers
// keep the booking embed and its attribution in one place.

/** The Calendly event every discovery call books into. */
export const DISCOVERY_CALL_CALENDLY_URL =
  "https://calendly.com/aloha-vitalkauai/30min";

/** Campaign parameters Calendly records on the invitee when present on the
 *  embed URL, so a booking made from an ad or a post carries its source. */
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Embed-only display parameters, matching the member booking page. */
const EMBED_PARAMS: Record<string, string> = {
  hide_gdpr_banner: "1",
  background_color: "ffffff",
  text_color: "1a1a18",
  primary_color: "7a9e7e",
  embed_type: "Inline",
};

/**
 * Build the inline Calendly embed URL for the discovery call, carrying any
 * utm_* parameters from the landing page's own query string through to the
 * booking so the source of each call survives into Calendly.
 *
 * `search` is the page's `location.search` (with or without the leading `?`).
 * Empty and non-utm parameters are left out.
 */
export function buildDiscoveryCallEmbedUrl(search: string = ""): string {
  const url = new URL(DISCOVERY_CALL_CALENDLY_URL);
  for (const [key, value] of Object.entries(EMBED_PARAMS)) {
    url.searchParams.set(key, value);
  }
  const incoming = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  for (const key of UTM_KEYS) {
    const value = incoming.get(key)?.trim();
    if (value) url.searchParams.set(key, value.slice(0, 200));
  }
  return url.toString();
}

/**
 * True when a `message` event from the Calendly iframe reports a completed
 * booking. Calendly posts `{ event: "calendly.event_scheduled" }` from its
 * own origin; anything else (other events, other origins) is ignored.
 */
export function isCalendlyBookingMessage(
  origin: string,
  data: unknown,
): boolean {
  if (origin !== "https://calendly.com") return false;
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { event?: unknown }).event === "calendly.event_scheduled"
  );
}
