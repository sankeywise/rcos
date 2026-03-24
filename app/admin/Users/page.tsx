import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, tenant_role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!membership) {
    redirect("/");
  }

  if (membership.tenant_role !== "tenant_admin") {
    redirect("/");
  }

  const orgId = membership.organization_id;

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const { data: members } = await supabase
    .from("organization_memberships")
    .select(`
      id,
      tenant_role,
      is_active,
      user_id,
      profiles (
        full_name,
        email
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">User Management</h1>
        <p className="text-slate-500 mt-1">
          {organization?.name || "Organization"}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Members</h2>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {!members || members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-slate-500">
                  No members found.
                </td>
              </tr>
            ) : (
              members.map((member: any) => (
                <tr
                  key={member.id}
                  className="border-b hover:bg-slate-50 transition"
                >
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {member.profiles?.full_name || "No Name"}
                  </td>

                  <td className="px-4 py-3 text-slate-800">
                    {member.profiles?.email || "No Email"}
                  </td>

                  <td className="px-4 py-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                      {member.tenant_role}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {member.is_active ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}