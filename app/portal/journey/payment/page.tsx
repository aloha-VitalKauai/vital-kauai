/**
 * PR 8 (D-085): superseded by the Member Contribution Portal. This is a pure
 * server redirect — no legacy financial component renders and no legacy read
 * runs on the way through.
 */
import { redirect } from "next/navigation";

export default function SupersededPaymentRedirect() {
  redirect("/portal/donate");
}
