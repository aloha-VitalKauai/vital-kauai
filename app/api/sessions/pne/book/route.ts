import { handleBookRequest } from "@/lib/sessions/book-route";

export async function POST() {
  return handleBookRequest("pne");
}
