import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type CorrectiveAction = {
  id: number;
  organization_id: string;
  title: string;
  source_type: string | null;
  source_reference: string | null;
  related_control: string | null;
  related_project: string | null;
  related_incident_id: number | null;
  severity: string | null;
  status: string | null;
  description: string | null;
  root_cause: string | null;
  corrective_action_plan: string | null;
  mitigation_steps: string | null;
  owner: string | null;
  due_date: string | null;
  completed_date: string | null;
  validation_notes: string | null;
  evidence_location: string | null;
  created_at: string | null;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function getBadgeClass(value?: string | null) {
  const normalized = normalizeStatus(value);

  if (["closed", "complete", "completed", "resolved", "validated"].includes(normalized)) {
    return "bg-green-100 text-green-700";
  }

  if (["open", "in progress", "in review", "pending validation"].includes(normalized)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["high", "critical", "overdue"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }

  if (["medium"].includes(normalized)) {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function isClosed(action: CorrectiveAction) {
  return ["closed", "complete", "completed", "resolved", "validated"].includes(
    normalizeStatus(action.status)
  );
}

function isOverdue(action: CorrectiveAction) {
  if (!action.due_date || isClosed(action)) return false;

  const dueDate = new Date(action.due_date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
}

export default async function CorrectiveActionsPage() {
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

  const { data: actionsData } = await supabase
    .from("corrective_actions")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const correctiveActions: CorrectiveAction[] =
    (actionsData ?? []) as CorrectiveAction[];

  const openActions = correctiveActions.filter((action) => !isClosed(action));
  const closedActions = correctiveActions.filter((action) => isClosed(action));
  const overdueActions = correctiveActions.filter((action) => isOverdue(action));
  const highRiskActions = correctiveActions.filter((action) =>
    ["high", "critical"].includes(normalizeStatus(action.severity))
  );

  async function createCorrectiveAction(formData: FormData) {
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

    const title = String(formData.get("title") || "").trim();

    if (!title) {
      throw new Error("Corrective action title is required.");
    }

    const payload = {
      organization_id: membership.organization_id,
      title,
      source_type: String(formData.get("source_type") || "Manual").trim(),
      source_reference: String(formData.get("source_reference") || "").trim() || null,
      related_control: String(formData.get("related_control") || "").trim() || null,
      related_project: String(formData.get("related_project") || "").trim() || null,
      related_incident_id: String(formData.get("related_incident_id") || "").trim()
        ? Number(formData.get("related_incident_id"))
        : null,
      severity: String(formData.get("severity") || "Medium").trim(),
      status: String(formData.get("status") || "Open").trim(),
      description: String(formData.get("description") || "").trim() || null,
      root_cause: String(formData.get("root_cause") || "").trim() || null,
      corrective_action_plan:
        String(formData.get("corrective_action_plan") || "").trim() || null,
      mitigation_steps: String(formData.get("mitigation_steps") || "").trim() || null,
      owner: String(formData.get("owner") || "").trim() || null,
      due_date: String(formData.get("due_date") || "").trim() || null,
      evidence_location: String(formData.get("evidence_location") || "").trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("corrective_actions").insert(payload);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/corrective-actions");
    revalidatePath("/");
  }

  async function updateCorrectiveActionStatus(formData: FormData) {
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

    const actionId = String(formData.get("action_id") || "").trim();
    const status = String(formData.get("status") || "Open").trim();
    const validationNotes =
      String(formData.get("validation_notes") || "").trim() || null;

    if (!actionId) {
      throw new Error("Corrective action is required.");
    }

    const isClosing = ["Closed", "Complete", "Resolved", "Validated"].includes(status);

    const { error } = await supabase
      .from("corrective_actions")
      .update({
        status,
        validation_notes: validationNotes,
        completed_date: isClosing ? new Date().toISOString().slice(0, 10) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(actionId))
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/corrective-actions");
    revalidatePath("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            POA&amp;M / Corrective Actions
          </h1>
          <p className="mt-1 text-slate-600">
            Track remediation items from CMMC gaps, incident reports, audits, and internal reviews.
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
        <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Open Actions</div>
          <div className="mt-2 text-4xl font-bold text-blue-600">
            {openActions.length}
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Overdue</div>
          <div className="mt-2 text-4xl font-bold text-red-600">
            {overdueActions.length}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">High Risk</div>
          <div className="mt-2 text-4xl font-bold text-yellow-600">
            {highRiskActions.length}
          </div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Closed</div>
          <div className="mt-2 text-4xl font-bold text-green-600">
            {closedActions.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Create Corrective Action
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a POA&amp;M item, incident remediation action, audit finding, or manually tracked correction.
          </p>

          <form action={createCorrectiveAction} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                name="title"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Example: Update incident response policy"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Source Type
                </label>
                <select
                  name="source_type"
                  defaultValue="Manual"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Manual">Manual</option>
                  <option value="CMMC Gap">CMMC Gap</option>
                  <option value="Incident Report">Incident Report</option>
                  <option value="Audit Finding">Audit Finding</option>
                  <option value="Internal Review">Internal Review</option>
                  <option value="POA&M">POA&M</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Source Reference
                </label>
                <input
                  name="source_reference"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ticket, finding, report, or reference"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Related Control
                </label>
                <input
                  name="related_control"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Example: IR.L2-3.6.1"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Related Project
                </label>
                <input
                  name="related_project"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Project or enclave"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Related Incident ID
                </label>
                <input
                  name="related_incident_id"
                  type="number"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional incident ID"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Owner
                </label>
                <input
                  name="owner"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Responsible owner"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Severity
                </label>
                <select
                  name="severity"
                  defaultValue="Medium"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="Open"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending Validation">Pending Validation</option>
                  <option value="Closed">Closed</option>
                </select>
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

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Description / Finding
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Describe the gap, issue, audit finding, or incident-related concern."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Root Cause
              </label>
              <textarea
                name="root_cause"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Root cause or suspected reason."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Corrective Action Plan
              </label>
              <textarea
                name="corrective_action_plan"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Describe the planned remediation."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Mitigation Steps
              </label>
              <textarea
                name="mitigation_steps"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="List interim or completed mitigation steps."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Evidence Location / Reference
              </label>
              <textarea
                name="evidence_location"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Reference only. Example: secure SharePoint path, ticket number, enclave repository path."
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Corrective Action
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Corrective Action Register
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Track open remediation activity, POA&amp;M items, incident follow-up, and audit findings.
          </p>

          {correctiveActions.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No corrective actions created yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {correctiveActions.map((action) => (
                <div
                  key={action.id}
                  className={`rounded-xl border p-4 ${
                    isOverdue(action) ? "border-red-200 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {action.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {action.source_type || "Manual"} • Control{" "}
                        {action.related_control || "—"} • Owner{" "}
                        {action.owner || "Unassigned"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isOverdue(action) && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          Overdue
                        </span>
                      )}

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          action.severity
                        )}`}
                      >
                        {action.severity || "Medium"}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          action.status
                        )}`}
                      >
                        {action.status || "Open"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div>
                      <span className="font-medium text-slate-700">Due:</span>{" "}
                      <span className="text-slate-600">
                        {formatDate(action.due_date)}
                      </span>
                    </div>

                    <div>
                      <span className="font-medium text-slate-700">Completed:</span>{" "}
                      <span className="text-slate-600">
                        {formatDate(action.completed_date)}
                      </span>
                    </div>
                  </div>

                  {action.description && (
                    <div className="mt-3 text-sm text-slate-700">
                      {action.description}
                    </div>
                  )}

                  {action.corrective_action_plan && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="font-medium">Plan:</span>{" "}
                      {action.corrective_action_plan}
                    </div>
                  )}

                  {action.evidence_location && (
                    <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                      <span className="font-medium">Evidence Reference:</span>{" "}
                      {action.evidence_location}
                    </div>
                  )}

                  <form
                    action={updateCorrectiveActionStatus}
                    className="mt-4 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <input type="hidden" name="action_id" value={action.id} />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.7fr_1fr_auto] md:items-end">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600">
                          Update Status
                        </label>
                        <select
                          name="status"
                          defaultValue={action.status || "Open"}
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Pending Validation">Pending Validation</option>
                          <option value="Closed">Closed</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Validated">Validated</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600">
                          Validation Notes
                        </label>
                        <input
                          name="validation_notes"
                          defaultValue={action.validation_notes || ""}
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                          placeholder="Closure or validation notes"
                        />
                      </div>

                      <button
                        type="submit"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Corrective actions should reference sensitive evidence locations rather than upload raw CUI,
        enclave diagrams, vulnerability reports, or security-sensitive technical data into RCOS.
      </div>
    </div>
  );
}