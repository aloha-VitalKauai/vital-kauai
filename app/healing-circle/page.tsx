import { redirect } from "next/navigation";

// Healing circle page temporarily hidden — redirect any visitors home.
// The page component and data file remain in the repo to restore later.
export default function HealingCircleRoute(): never {
  redirect("/");
}
