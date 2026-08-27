import { redirect } from "next/navigation";

// About the Founders page temporarily hidden—redirect any visitors home.
// The page component and content remain in the repo to restore later.
export default function AboutRoute(): never {
  redirect("/");
}
