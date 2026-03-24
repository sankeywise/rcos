import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import LogoutButton from "@/components/logout-button";

export default async function Sidebar() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = "Guest User";
  let organizationName = "No Organization";
  let isTenantAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id, tenant_role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (profile?.full_name) {
      fullName = profile.full_name;
    }

    if (membership?.tenant_role === "tenant_admin") {
      isTenantAdmin = true;
    }

    if (membership?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .single();

      if (org?.name) {
        organizationName = org.name;
      }
    }
  }

  return (
    <aside className="w-64 shrink-0 bg-slate-800 text-white flex flex-col min-h-screen border-r border-slate-700 relative z-30">
      <div className="p-6 text-2xl font-bold border-b border-slate-700">
        RCOS
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Link
          href="/"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Dashboard
        </Link>

        <Link
          href="/projects"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Projects
        </Link>

        <Link
          href="/personnel"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Personnel
        </Link>

        <Link
          href="/artifacts"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Documents
        </Link>

        {isTenantAdmin && (
          <Link
            href="/users"
            className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            Manage Users
          </Link>
        )}

        {isTenantAdmin && (
          <Link
            href="/admin"
            className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            Admin
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-sm text-slate-100 font-medium">{fullName}</div>
        <div className="text-xs text-slate-400 mt-1">{organizationName}</div>

        <div className="mt-3">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}