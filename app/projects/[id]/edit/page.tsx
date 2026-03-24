import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function formatDateForInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
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

  const projectId = Number(resolvedParams?.id);

  if (Number.isNaN(projectId)) {
    return <div className="p-6 text-red-600">Invalid Project ID</div>;
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      sponsor,
      status,
      classification,
      classification_type,
      environment,
      pop_start_date,
      pop_end_date,
      organization_id
    `)
    .eq("id", projectId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (error || !project) {
    return <div className="p-6 text-red-600">Project not found.</div>;
  }

  async function updateProject(formData: FormData) {
    "use server";

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

    const projectId = Number(formData.get("project_id"));

    const payload = {
      name: String(formData.get("name") || "").trim(),
      sponsor: String(formData.get("sponsor") || "").trim(),
      status: String(formData.get("status") || "").trim(),
      classification: String(formData.get("classification") || "").trim(),
      classification_type: String(
        formData.get("classification_type") || ""
      ).trim(),
      environment: String(formData.get("environment") || "").trim(),
      pop_start_date:
        String(formData.get("pop_start_date") || "").trim() || null,
      pop_end_date: String(formData.get("pop_end_date") || "").trim() || null,
    };

    const { error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", projectId)
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/projects/${projectId}`);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to Project
        </Link>

        <div className="mt-3">
          <h1 className="text-3xl font-bold text-slate-900">
            Edit Project Details
          </h1>
          <p className="text-slate-700 mt-1">
            Update the project record for {project.name}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <form action={updateProject} className="space-y-6">
          <input type="hidden" name="project_id" value={project.id} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Project Name
              </label>
              <input
                type="text"
                name="name"
                defaultValue={project.name || ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Sponsor
              </label>
              <input
                type="text"
                name="sponsor"
                defaultValue={project.sponsor || ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Status
              </label>
              <select
                name="status"
                defaultValue={project.status || "active"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Environment
              </label>
              <input
                type="text"
                name="environment"
                defaultValue={project.environment || ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-white"
                placeholder="Secure Lab, Enclave, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Classification
              </label>
              <input
                type="text"
                name="classification"
                defaultValue={project.classification || ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-white"
                placeholder="CUI, Controlled Research, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Export Control / Classification Type
              </label>
              <select
                name="classification_type"
                defaultValue={project.classification_type || ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              >
                <option value="">Select type</option>
                <option value="cui">CUI</option>
                <option value="itar_cui">ITAR Export Controlled + CUI</option>
                <option value="ear_cui">EAR Export Controlled + CUI</option>
                <option value="itar">ITAR Export Controlled</option>
                <option value="ear">EAR Export Controlled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                PoP Start Date
              </label>
              <input
                type="date"
                name="pop_start_date"
                defaultValue={formatDateForInput(project.pop_start_date)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                PoP Anticipated End Date
              </label>
              <input
                type="date"
                name="pop_end_date"
                defaultValue={formatDateForInput(project.pop_end_date)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Save Project Details
            </button>

            <Link
              href={`/projects/${project.id}`}
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}