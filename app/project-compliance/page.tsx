import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type ProjectRow = {
  id: number;
  organization_id: string;
  project_name: string | null;
  sponsor: string | null;
  status: string | null;
  classification: string | null;
  environment: string | null;
  export_control_type: string | null;
};

type ProjectComplianceItem = {
  id: number;
  organization_id: string;
  project_id: number;
  item_name: string;
  item_type: string | null;
  control_family_code: string | null;
  related_control: string | null;
  status: string | null;
  owner: string | null;
  due_date: string | null;
  completed_date: string | null;
  requires_evidence: boolean | null;
  evidence_status: string | null;
  evidence_reference: string | null;
  sensitivity_level: string | null;
  notes: string | null;
  created_at: string | null;
};

type PersonnelRow = {
  id: number;
  project_id: number | null;
  name: string | null;
  full_name: string | null;
  training_complete: boolean | null;
  citizenship_status: string | null;
  rps_screening_status: string | null;
  secure_machine_name: string | null;
  secure_machine_status: string | null;
};

type IncidentReportRow = {
  id: number;
  title: string | null;
  project_name: string | null;
  incident_status: string | null;
  severity: string | null;
};

type CorrectiveActionRow = {
  id: number;
  title: string | null;
  related_project: string | null;
  related_control: string | null;
  severity: string | null;
  status: string | null;
  due_date: string | null;
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

  if (isCompleteStatus(value)) {
    return "bg-green-100 text-green-700";
  }

  if (
    ["in progress", "pending", "partial", "open", "draft", "provided", "referenced"].includes(
      normalized
    )
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (
    ["not started", "not provided", "missing", "overdue", "high", "critical"].includes(
      normalized
    )
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function formatPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function getProjectName(project: ProjectRow, index: number) {
  if (project.project_name && project.project_name.trim().length > 0) {
    return project.project_name;
  }

  const fallback = [
    "Quantum Navigation",
    "Secure Drone Comms",
    "AI Radar System",
    "Autonomy Research",
    "Protected Data Project",
  ];

  return fallback[index] || `Project ${project.id}`;
}

function displayPersonName(person: PersonnelRow) {
  return person.full_name || person.name || "Unnamed Person";
}

function isOverdue(item: ProjectComplianceItem) {
  if (!item.due_date || isCompleteStatus(item.status)) return false;

  const dueDate = new Date(item.due_date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
}

export default async function ProjectCompliancePage() {
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
    .select("id, organization_id, project_name, sponsor, status, classification, environment, export_control_type")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const complianceItemsResult = await supabase
    .from("project_compliance_items")
    .select("*")
    .eq("organization_id", orgId)
    .order("project_id", { ascending: true })
    .order("id", { ascending: true });

  const personnelResult = await supabase
    .from("personnel")
    .select("id, project_id, name, full_name, training_complete, citizenship_status, rps_screening_status, secure_machine_name, secure_machine_status")
    .eq("organization_id", orgId);

  const incidentsResult = await supabase
    .from("incident_reports")
    .select("id, title, project_name, incident_status, severity")
    .eq("organization_id", orgId);

  const actionsResult = await supabase
    .from("corrective_actions")
    .select("id, title, related_project, related_control, severity, status, due_date")
    .eq("organization_id", orgId);

  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const complianceItems: ProjectComplianceItem[] =
    (complianceItemsResult.data ?? []) as ProjectComplianceItem[];
  const personnel: PersonnelRow[] = (personnelResult.data ?? []) as PersonnelRow[];
  const incidents: IncidentReportRow[] = (incidentsResult.data ?? []) as IncidentReportRow[];
  const correctiveActions: CorrectiveActionRow[] =
    (actionsResult.data ?? []) as CorrectiveActionRow[];

  const totalItems = complianceItems.length;
  const completedItems = complianceItems.filter((item) => isCompleteStatus(item.status)).length;
  const overdueItems = complianceItems.filter((item) => isOverdue(item));
  const missingEvidenceItems = complianceItems.filter(
    (item) =>
      item.requires_evidence &&
      !["provided", "referenced", "verified", "not applicable"].includes(
        normalizeStatus(item.evidence_status)
      )
  );

  const projectItemMap: Record<number, ProjectComplianceItem[]> = {};
  complianceItems.forEach((item) => {
    if (!projectItemMap[item.project_id]) projectItemMap[item.project_id] = [];
    projectItemMap[item.project_id].push(item);
  });

  async function updateProjectComplianceItem(formData: FormData) {
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

    const itemId = String(formData.get("item_id") || "").trim();
    const status = String(formData.get("status") || "Not Started").trim();
    const evidenceStatus = String(formData.get("evidence_status") || "Not Provided").trim();
    const evidenceReference = String(formData.get("evidence_reference") || "").trim() || null;
    const owner = String(formData.get("owner") || "").trim() || null;
    const dueDate = String(formData.get("due_date") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;

    if (!itemId) {
      throw new Error("Project compliance item is required.");
    }

    const isClosing = isCompleteStatus(status);

    const { error } = await supabase
      .from("project_compliance_items")
      .update({
        status,
        evidence_status: evidenceStatus,
        evidence_reference: evidenceReference,
        owner,
        due_date: dueDate,
        notes,
        completed_date: isClosing ? new Date().toISOString().slice(0, 10) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(itemId))
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/project-compliance");
    revalidatePath("/");
    revalidatePath("/audit-mode");
  }

  async function addProjectComplianceItem(formData: FormData) {
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
    const itemName = String(formData.get("item_name") || "").trim();

    if (!projectId || !itemName) {
      throw new Error("Project and item name are required.");
    }

    const { error } = await supabase.from("project_compliance_items").insert({
      organization_id: membership.organization_id,
      project_id: Number(projectId),
      item_name: itemName,
      item_type: String(formData.get("item_type") || "Requirement").trim(),
      control_family_code: String(formData.get("control_family_code") || "").trim() || null,
      related_control: String(formData.get("related_control") || "").trim() || null,
      status: "Not Started",
      owner: String(formData.get("owner") || "").trim() || null,
      due_date: String(formData.get("due_date") || "").trim() || null,
      requires_evidence: true,
      evidence_status: "Not Provided",
      sensitivity_level: "Metadata Only",
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/project-compliance");
    revalidatePath("/");
    revalidatePath("/audit-mode");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Project Compliance Workspace
          </h1>
          <p className="mt-1 text-slate-600">
            Project-centered view of CUI/export determinations, personnel readiness, evidence references, incidents, and corrective actions.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to Action Center
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Projects</div>
          <div className="mt-2 text-4xl font-bold text-slate-900">{projects.length}</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Compliance Readiness</div>
          <div className="mt-2 text-4xl font-bold text-blue-600">
            {formatPercent(completedItems, totalItems)}%
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Missing Evidence References</div>
          <div className="mt-2 text-4xl font-bold text-red-600">
            {missingEvidenceItems.length}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Overdue Items</div>
          <div className="mt-2 text-4xl font-bold text-amber-600">
            {overdueItems.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.5fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Add Project Compliance Item
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a requirement, evidence reference, authorization item, or review step to a project.
          </p>

          <form action={addProjectComplianceItem} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Project
              </label>
              <select
                name="project_id"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select project</option>
                {projects.map((project, index) => (
                  <option key={project.id} value={project.id}>
                    {getProjectName(project, index)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Item Name
              </label>
              <input
                name="item_name"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Example: Foreign national access review"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Item Type
                </label>
                <select
                  name="item_type"
                  defaultValue="Requirement"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Requirement">Requirement</option>
                  <option value="CUI Review">CUI Review</option>
                  <option value="Export Control">Export Control</option>
                  <option value="Personnel Compliance">Personnel Compliance</option>
                  <option value="Evidence Reference">Evidence Reference</option>
                  <option value="Authorization">Authorization</option>
                  <option value="Incident Review">Incident Review</option>
                  <option value="POA&M">POA&M</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Control Area
                </label>
                <input
                  name="control_family_code"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="AC, AT, IR, SC, etc."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Related Control
                </label>
                <input
                  name="related_control"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Example: AC.L2-3.1.1"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Owner
                </label>
                <input
                  name="owner"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Owner"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notes or context. Do not enter sensitive CUI or enclave technical details."
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Project Compliance Item
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">No projects found.</div>
            </div>
          ) : (
            projects.map((project, index) => {
              const projectName = getProjectName(project, index);
              const items = projectItemMap[project.id] || [];
              const complete = items.filter((item) => isCompleteStatus(item.status)).length;
              const readiness = formatPercent(complete, items.length);

              const projectPersonnel = personnel.filter(
                (person) => person.project_id === project.id
              );

              const personnelGaps = projectPersonnel.filter(
                (person) =>
                  !person.training_complete ||
                  !["cleared", "verified", "complete", "completed"].includes(
                    normalizeStatus(person.rps_screening_status)
                  ) ||
                  !person.secure_machine_name ||
                  normalizeStatus(person.secure_machine_status) !== "verified"
              );

              const projectIncidents = incidents.filter((incident) =>
                normalizeStatus(incident.project_name).includes(normalizeStatus(projectName))
              );

              const projectActions = correctiveActions.filter((action) =>
                normalizeStatus(action.related_project).includes(normalizeStatus(projectName))
              );

              return (
                <div
                  key={project.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {projectName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {project.sponsor || "No sponsor"} • {project.status || "Pending"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(project.status)}`}>
                        {project.status || "Pending"}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {project.classification || "Unclassified"}
                      </span>
                      <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                        {project.export_control_type || "Export TBD"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Readiness</div>
                      <div className="mt-2 text-3xl font-bold text-blue-600">
                        {readiness}%
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Items</div>
                      <div className="mt-2 text-3xl font-bold text-slate-900">
                        {items.length}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Personnel Gaps</div>
                      <div className="mt-2 text-3xl font-bold text-red-600">
                        {personnelGaps.length}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Open Incidents / Actions</div>
                      <div className="mt-2 text-3xl font-bold text-amber-600">
                        {projectIncidents.length + projectActions.length}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${readiness}%` }}
                    />
                  </div>

                  <div className="mt-5 space-y-4">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        No project compliance items found for this project.
                      </div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 ${
                            isOverdue(item)
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                              <div className="font-medium text-slate-900">
                                {item.item_name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.item_type || "Requirement"} • Area{" "}
                                {item.control_family_code || "—"} • Control{" "}
                                {item.related_control || "—"} • Owner{" "}
                                {item.owner || "Unassigned"}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {isOverdue(item) && (
                                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                  Overdue
                                </span>
                              )}

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                                  item.status
                                )}`}
                              >
                                {item.status || "Not Started"}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                                  item.evidence_status
                                )}`}
                              >
                                Evidence: {item.evidence_status || "Not Provided"}
                              </span>
                            </div>
                          </div>

                          {item.evidence_reference && (
                            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                              <span className="font-medium">Evidence Reference:</span>{" "}
                              {item.evidence_reference}
                            </div>
                          )}

                          {item.notes && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                              {item.notes}
                            </div>
                          )}

                          <form
                            action={updateProjectComplianceItem}
                            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <input type="hidden" name="item_id" value={item.id} />

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600">
                                  Status
                                </label>
                                <select
                                  name="status"
                                  defaultValue={item.status || "Not Started"}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                >
                                  <option value="Not Started">Not Started</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Pending">Pending</option>
                                  <option value="Complete">Complete</option>
                                  <option value="Verified">Verified</option>
                                  <option value="Not Applicable">Not Applicable</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600">
                                  Evidence Status
                                </label>
                                <select
                                  name="evidence_status"
                                  defaultValue={item.evidence_status || "Not Provided"}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                >
                                  <option value="Not Provided">Not Provided</option>
                                  <option value="Referenced">Referenced</option>
                                  <option value="Provided">Provided</option>
                                  <option value="Verified">Verified</option>
                                  <option value="Not Applicable">Not Applicable</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600">
                                  Owner
                                </label>
                                <input
                                  name="owner"
                                  defaultValue={item.owner || ""}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600">
                                  Due Date
                                </label>
                                <input
                                  type="date"
                                  name="due_date"
                                  defaultValue={item.due_date || ""}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="mb-2 block text-xs font-medium text-slate-600">
                                  Evidence Reference
                                </label>
                                <input
                                  name="evidence_reference"
                                  defaultValue={item.evidence_reference || ""}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                  placeholder="Reference only. Do not enter CUI or sensitive enclave details."
                                />
                              </div>

                              <div className="xl:col-span-3">
                                <label className="mb-2 block text-xs font-medium text-slate-600">
                                  Notes
                                </label>
                                <input
                                  name="notes"
                                  defaultValue={item.notes || ""}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                  placeholder="Metadata only. Avoid sensitive technical details."
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                              Save Item
                            </button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Project Compliance Workspace should track readiness metadata and evidence references.
        Sensitive CUI, enclave architecture, vulnerability reports, firewall configurations, SSP internals,
        and technical evidence should remain in approved secure repositories.
      </div>
    </div>
  );
}