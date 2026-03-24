"use client";

import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-slate-300 hover:text-white"
    >
      Logout
    </button>
  );
}