import { redirect } from "next/navigation";

// Placeholder alias for Week 1 action links. The canonical Questions for the
// Medicine page currently lives at /portal/questions. When a dedicated page
// ships at this slug, replace the redirect with the real component.
export default function QuestionsForTheMedicinePlaceholder() {
  redirect("/portal/questions");
}
