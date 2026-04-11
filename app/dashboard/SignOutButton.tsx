"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      style={{
        fontSize: 13,
        color: "#6B6B67",
        background: "none",
        border: "0.5px solid rgba(0,0,0,0.15)",
        borderRadius: 6,
        padding: "5px 12px",
        cursor: "pointer",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      Sign out
    </button>
  );
}
