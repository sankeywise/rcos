import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function NewArtifactPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
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
  const defaultProjectId = resolvedSearchParams?.projectId || "";

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (projectsError) {
    return <div className="p-6 text-red-600">Failed to load projects.</div>;
  }

  async function createArtifact(formData: FormData) {
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
    const title = String(formData.get("title") || "").trim();
    const artifactType = String(formData.get("artifact_type") || "").trim();
    const status = String(formData.get("status") || "").trim();

    if (!projectId || !title || !artifactType || !status) {
      throw new Error("Missing required fields.");
    }

    const { error } = await supabase.from("artifacts").insert({
      project_id: projectId,
      organization_id: membership.organization_id,
      title,
      artifact_type: artifactType,
      status,
      uploaded_by_user_id: user.id,
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/projects/${projectId}`);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <Link
          href={defaultProjectId ? `/projects/${defaultProjectId}` : "/artifacts"}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>

        <div className="mt-3">
          <h1 className="text-3xl font-bold text-slate-900">Add Document</h1>
          <p className="text-slate-700 mt-1">
            Create a new artifact record for this organization
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <form action={createArtifact} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Project
            </label>
            <select
              name="project_id"
              defaultValue={defaultProjectId}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              required
            >
              <option value="">Select project</option>
              {projects?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Document Title
            </label>
            <input
              type="text"
              name="title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-white"
              placeholder="AI Radar TCP"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Document Type
            </label>
            <select
              name="artifact_type"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              required
            >
              <option value="">Select type</option>
              <option value="Technology Control Plan">Technology Control Plan</option>
              <option value="NDA">NDA</option>
              <option value="Data Use Agreement">Data Use Agreement</option>
              <option value="Export Review">Export Review</option>
              <option value="CUI Marking Guide">CUI Marking Guide</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Status
            </label>
            <select
              name="status"
              defaultValue="Pending"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              required
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Signed">Signed</option>
              <option value="Complete">Complete</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Save Document
            </button>

            <Link
              href={defaultProjectId ? `/projects/${defaultProjectId}` : "/artifacts"}
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