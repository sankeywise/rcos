import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, tenant_role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  let organizationName = "No Organization";

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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-700 mt-1">
          View your account and organization information
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-slate-500 mb-1">Full Name</div>
            <div className="text-slate-900 font-medium">
              {profile?.full_name || "—"}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Email</div>
            <div className="text-slate-900 font-medium">
              {profile?.email || user.email || "—"}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Organization</div>
            <div className="text-slate-900 font-medium">
              {organizationName}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Role</div>
            <div className="text-slate-900 font-medium">
              {membership?.tenant_role || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}