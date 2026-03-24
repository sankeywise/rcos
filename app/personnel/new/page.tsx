import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import NewPersonnelForm from "../../../components/personnel/new-personnel-form";

export default async function NewPersonnelPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!membership) {
    redirect("/");
  }

  const orgId = membership.organization_id;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-slate-900">
          Add Personnel
        </h1>
        <p className="text-slate-700">
          Create a new personnel record for this organization
        </p>
      </div>

      <NewPersonnelForm
        organizationId={orgId}
        projects={(projects || []).map((project) => ({
          id: project.id,
          name: project.name,
        }))}
      />
    </div>
  );
}