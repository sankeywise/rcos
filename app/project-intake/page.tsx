import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type ProjectRow = {
  id: number;
  organization_id: string;
  project_name: string | null;
  sponsor: string | null;
  classification: string | null;
  environment: string | null;
  export_control_type: string | null;
  status: string | null;
  created_at: string | null;
};

type ProjectComplianceItem = {
  id: number;
  project_id: number;
  status: string | null;
  evidence_status: string | null;
  requires_evidence: boolean | null;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  return [
    "complete",
    "completed",
    "approved",
    "verified",
    "closed",
    "resolved",
    "validated",
    "not applicable",
  ].includes(normalizeStatus(value));
}

function getBadgeClass(value?: string | null) {
  const normalized = normalizeStatus(value);

  if (["active", "complete", "completed", "approved", "verified"].includes(normalized)) {
    return "bg-green-100 text-green-700";
  }

  if (["pending", "draft", "in progress", "partial"].includes(normalized)) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (["inactive", "restricted", "on hold", "closed", "not started"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function getProjectDisplayName(project: ProjectRow) {
  if (project.project_name && project.project_name.trim().length > 0) {
    return project.project_name.trim();
  }

  return `Unnamed Project ${project.id}`;
}

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (membershipError || !membership) {
    return <div className="p-6 text-red-600">No organization membership found.</div>;
  }

  const orgId = membership.organization_id;

  const projectsResult = await supabase
    .from("projects")
    .select(
      "id, organization_id, project_name, sponsor, classification, environment, export_control_type, status, created_at"
    )
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const complianceItemsResult = await supabase
    .from("project_compliance_items")
    .select("id, project_id, status, evidence_status, requires_evidence")
    .eq("organization_id", orgId);

  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const projectComplianceItems: ProjectComplianceItem[] =
    (complianceItemsResult.data ?? []) as ProjectComplianceItem[];

  const activeProjects = projects.filter(
    (project) => normalizeStatus(project.status) === "active"
  );

  const pendingProjects = projects.filter(
    (project) =>
      normalizeStatus(project.status) === "pending" ||
      normalizeStatus(project.status) === "draft" ||
      normalizeStatus(project.status) === "in progress"
  );

  const restrictedProjects = projects.filter(
    (project) =>
      normalizeStatus(project.classification).includes("cui") ||
      normalizeStatus(project.classification).includes("itar") ||
      normalizeStatus(project.classification).includes("export") ||
      normalizeStatus(project.export_control_type).includes("itar") ||
      normalizeStatus(project.export_control_type).includes("ear")
  );

  const complianceItemMap: Record<number, ProjectComplianceItem[]> = {};
  projectComplianceItems.forEach((item) => {
    if (!complianceItemMap[item.project_id]) {
      complianceItemMap[item.project_id] = [];
    }

    complianceItemMap[item.project_id].push(item);
  });

  async function createProject(formData: FormData) {
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

    const projectName = String(formData.get("project_name") || "").trim();

    if (!projectName) {
      throw new Error("Project name is required.");
    }

    const { error } = await supabase.from("projects").insert({
      organization_id: membership.organization_id,
      project_name: projectName,
      sponsor: String(formData.get("sponsor") || "").trim() || null,
      classification: String(formData.get("classification") || "").trim() || null,
      environment: String(formData.get("environment") || "").trim() || null,
      export_control_type:
        String(formData.get("export_control_type") || "").trim() || null,
      status: String(formData.get("status") || "Pending").trim(),
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/project-intake");
    revalidatePath("/project-compliance");
    revalidatePath("/audit-mode");
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

    const projectId = String(formData.get("project_id") || "").trim();
    const projectName = String(formData.get("project_name") || "").trim();

    if (!projectId) {
      throw new Error("Project ID is required.");
    }

    if (!projectName) {
      throw new Error("Project name is required.");
    }

    const { error } = await supabase
      .from("projects")
      .update({
        project_name: projectName,
        sponsor: String(formData.get("sponsor") || "").trim() || null,
        classification: String(formData.get("classification") || "").trim() || null,
        environment: String(formData.get("environment") || "").trim() || null,
        export_control_type:
          String(formData.get("export_control_type") || "").trim() || null,
        status: String(formData.get("status") || "Pending").trim(),
      })
      .eq("id", Number(projectId))
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/project-intake");
    revalidatePath("/project-compliance");
    revalidatePath("/audit-mode");
  }

  async function deleteProject(formData: FormData) {
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

    const projectId = String(formData.get("project_id") || "").trim();

    if (!projectId) {
      throw new Error("Project ID is required.");
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", Number(projectId))
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/project-intake");
    revalidatePath("/project-compliance");
    revalidatePath("/audit-mode");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-slate-600">
            Manage controlled research projects, sponsor information, classification,
            environment, and export-control status.
          </p>
        </div>

        <Link
          href="/project-intake"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Start Project Intake
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Total Projects</div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {projects.length}
          </div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Active</div>
          <div className="mt-2 text-4xl font-bold text-green-600">
            {activeProjects.length}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Pending / Draft</div>
          <div className="mt-2 text-4xl font-bold text-yellow-600">
            {pendingProjects.length}
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Controlled / Restricted</div>
          <div className="mt-2 text-4xl font-bold text-red-600">
            {restrictedProjects.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.4fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Add New Project</h2>
          <p className="mt-1 text-sm text-slate-500">
            This will create a real project record using the{" "}
            <span className="font-medium">project_name</span> field.
          </p>

          <form action={createProject} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Project Name
              </label>
              <input
                name="project_name"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Example: Quantum Navigation"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sponsor
              </label>
              <input
                name="sponsor"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Example: NASA, DoD, Army, AFRL"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Classification
              </label>
              <select
                name="classification"
                defaultValue="Unclassified"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Unclassified">Unclassified</option>
                <option value="CUI">CUI</option>
                <option value="ITAR">ITAR</option>
                <option value="EAR">EAR</option>
                <option value="Export Controlled">Export Controlled</option>
                <option value="CUI / Export Controlled">CUI / Export Controlled</option>
                <option value="Restricted">Restricted</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Export Control Type
              </label>
              <select
                name="export_control_type"
                defaultValue="TBD"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="TBD">TBD</option>
                <option value="None Identified">None Identified</option>
                <option value="EAR">EAR</option>
                <option value="ITAR">ITAR</option>
                <option value="EAR / ITAR">EAR / ITAR</option>
                <option value="CUI//SP-EXPT">CUI//SP-EXPT</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Environment
              </label>
              <select
                name="environment"
                defaultValue="Standard Research Environment"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Standard Research Environment">
                  Standard Research Environment
                </option>
                <option value="Secure Lab">Secure Lab</option>
                <option value="Restricted Network">Restricted Network</option>
                <option value="Controlled Facility">Controlled Facility</option>
                <option value="CUI Enclave">CUI Enclave</option>
                <option value="SEC Environment">SEC Environment</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                name="status"
                defaultValue="Pending"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Project
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Project Register</h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirm the project name, sponsor, classification, and environment are saved correctly.
          </p>

          {projects.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No projects created yet.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Sponsor</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Environment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Readiness</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {projects.map((project) => {
                    const items = complianceItemMap[project.id] || [];
                    const completeItems = items.filter((item) =>
                      isCompleteStatus(item.status)
                    ).length;
                    const readiness = formatPercent(completeItems, items.length);

                    return (
                      <tr key={project.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-blue-600">
                            {getProjectDisplayName(project)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            ID: {project.id}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-slate-700">
                          {project.sponsor || "—"}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                            {project.classification || "Unclassified"}
                          </span>
                          <div className="mt-2 text-xs text-slate-500">
                            {project.export_control_type || "TBD"}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-slate-700">
                          {project.environment || "—"}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                              project.status
                            )}`}
                          >
                            {project.status || "Pending"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">
                            {readiness}%
                          </div>
                          <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${readiness}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {completeItems} of {items.length} complete
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 space-y-5">
            <h3 className="text-lg font-semibold text-slate-900">Edit Projects</h3>

            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <form action={updateProject} className="space-y-4">
                  <input type="hidden" name="project_id" value={project.id} />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600">
                        Project Name
                      </label>
                      <input
                        name="project_name"
                        required
                        defaultValue={project.project_name || ""}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Project name"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600">
                        Sponsor
                      </label>
                      <input
                        name="sponsor"
                        defaultValue={project.sponsor || ""}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Sponsor"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600">
                        Classification
                      </label>
                      <select
                        name="classification"
                        defaultValue={project.classification || "Unclassified"}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="Unclassified">Unclassified</option>
                        <option value="CUI">CUI</option>
                        <option value="ITAR">ITAR</option>
                        <option value="EAR">EAR</option>
                        <option value="Export Controlled">Export Controlled</option>
                        <option value="CUI / Export Controlled">
                          CUI / Export Controlled
                        </option>
                        <option value="Restricted">Restricted</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600">
                        Export Control Type
                      </label>
                      <select
                        name="export_control_type"
                        defaultValue={project.export_control_type || "TBD"}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="TBD">TBD</option>
                        <option value="None Identified">None Identified</option>
                        <option value="EAR">EAR</option>
                        <option value="ITAR">ITAR</option>
                        <option value="EAR / ITAR">EAR / ITAR</option>
                        <option value="CUI//SP-EXPT">CUI//SP-EXPT</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600">
                        Environment
                      </label>
                      <select
                        name="environment"
                        defaultValue={
                          project.environment || "Standard Research Environment"
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="Standard Research Environment">
                          Standard Research Environment
                        </option>
                        <option value="Secure Lab">Secure Lab</option>
                        <option value="Restricted Network">Restricted Network</option>
                        <option value="Controlled Facility">Controlled Facility</option>
                        <option value="CUI Enclave">CUI Enclave</option>
                        <option value="SEC Environment">SEC Environment</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600">
                        Status
                      </label>
                      <select
                        name="status"
                        defaultValue={project.status || "Pending"}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Active">Active</option>
                        <option value="In Progress">In Progress</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Save Project
                    </button>
                  </div>
                </form>

                <form action={deleteProject} className="mt-2">
                  <input type="hidden" name="project_id" value={project.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete Project
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Project records should describe the project at a metadata level only. Do not enter
        controlled technical data, CUI contents, enclave diagrams, vulnerability details, or
        sensitive system configuration information.
      </div>
    </div>
  );
}