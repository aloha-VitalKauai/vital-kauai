import { redirect } from "next/navigation";

// Upcoming Ceremonies page temporarily hidden — redirect any visitors home.
// The page component remains in the repo to restore later.
export default function UpcomingCeremoniesRoute(): never {
  redirect("/");
}
