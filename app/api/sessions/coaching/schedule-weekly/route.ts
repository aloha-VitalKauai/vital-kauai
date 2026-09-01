// "Set My Weekly Time" — the same gated booking flow as /coaching/book, but
// the hold it issues is marked series_anchor: the session booked through
// this link becomes the anchor of the member's recurring post-integration
// series, and the webhook fans out the rest of their allowance weekly.
import { handleBookRequest } from "@/lib/sessions/book-route";

export async function POST() {
  return handleBookRequest("coaching", { purpose: "series_anchor" });
}
