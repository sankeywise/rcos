import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type IncidentReport = {
  id: number;
  title: string;
  incident_status: string | null;
  severity: string | null;
  incident_type: string | null;
  discovered_date: string | null;
  reported_by: string | null;
  department: string | null;
  project_name: string | null;
  involves_cui: boolean;
  involves_itar: boolean;
  involves_ear: boolean;
  involves_pii: boolean;
  cyber_related: boolean;
  created_at: string | null;
};

function getBadgeClass(value?: string | null) {
  const normalized = String(value || "").toLowerCase();

  if (["closed", "complete", "completed", "resolved"].includes(normalized)) {
    return "bg-green-100 text-green-700";
  }

  if (["submitted", "in review", "open", "in progress"].includes(normalized)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["high", "critical"].includes(normalized)) {
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

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export default async function IncidentReportingPage() {
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

  const { data: incidentData } = await supabase
    .from("incident_reports")
    .select(`
      id,
      title,
      incident_status,
      severity,
      incident_type,
      discovered_date,
      reported_by,
      department,
      project_name,
      involves_cui,
      involves_itar,
      involves_ear,
      involves_pii,
      cyber_related,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const incidents: IncidentReport[] = (incidentData ?? []) as IncidentReport[];

  const openIncidents = incidents.filter((incident) =>
    ["open", "in review", "in progress", "submitted"].includes(
      String(incident.incident_status || "").toLowerCase()
    )
  );

  const draftIncidents = incidents.filter(
    (incident) => String(incident.incident_status || "").toLowerCase() === "draft"
  );

  const closedIncidents = incidents.filter((incident) =>
    ["closed", "resolved", "complete", "completed"].includes(
      String(incident.incident_status || "").toLowerCase()
    )
  );

  const highRiskIncidents = incidents.filter((incident) =>
    ["high", "critical"].includes(String(incident.severity || "").toLowerCase())
  );

  async function createIncidentReport(formData: FormData) {
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
      throw new Error("Incident title is required.");
    }

    const payload = {
      organization_id: membership.organization_id,
      title,
      incident_status: String(formData.get("incident_status") || "Draft"),
      severity: String(formData.get("severity") || "Medium"),
      incident_type: String(formData.get("incident_type") || "").trim() || null,
      discovered_date: String(formData.get("discovered_date") || "").trim() || null,
      discovered_time: String(formData.get("discovered_time") || "").trim() || null,
      reported_by: String(formData.get("reported_by") || "").trim() || null,
      department: String(formData.get("department") || "").trim() || null,
      project_name: String(formData.get("project_name") || "").trim() || null,

      involves_cui: checkboxValue(formData, "involves_cui"),
      involves_itar: checkboxValue(formData, "involves_itar"),
      involves_ear: checkboxValue(formData, "involves_ear"),
      involves_pii: checkboxValue(formData, "involves_pii"),
      cyber_related: checkboxValue(formData, "cyber_related"),
      unauthorized_access: checkboxValue(formData, "unauthorized_access"),
      wrong_recipient: checkboxValue(formData, "wrong_recipient"),
      downloaded_printed_transferred: checkboxValue(
        formData,
        "downloaded_printed_transferred"
      ),

      what_happened: String(formData.get("what_happened") || "").trim() || null,
      how_discovered: String(formData.get("how_discovered") || "").trim() || null,
      who_involved: String(formData.get("who_involved") || "").trim() || null,
      affected_system_or_environment:
        String(formData.get("affected_system_or_environment") || "").trim() || null,
      information_involved:
        String(formData.get("information_involved") || "").trim() || null,

      immediate_actions: String(formData.get("immediate_actions") || "").trim() || null,
      access_revoked: checkboxValue(formData, "access_revoked"),
      it_security_notified: checkboxValue(formData, "it_security_notified"),
      iso_notified: checkboxValue(formData, "iso_notified"),
      fso_notified: checkboxValue(formData, "fso_notified"),
      eco_notified: checkboxValue(formData, "eco_notified"),
      sponsor_notified: checkboxValue(formData, "sponsor_notified"),
      file_deleted_or_quarantined: checkboxValue(formData, "file_deleted_or_quarantined"),
      evidence_preserved: checkboxValue(formData, "evidence_preserved"),

      affected_records_count:
        String(formData.get("affected_records_count") || "").trim() || null,
      affected_data_type: String(formData.get("affected_data_type") || "").trim() || null,
      affected_project_or_sponsor:
        String(formData.get("affected_project_or_sponsor") || "").trim() || null,
      potential_reporting_obligation:
        String(formData.get("potential_reporting_obligation") || "").trim() || null,
      follow_up_required: checkboxValue(formData, "follow_up_required"),

      root_cause: String(formData.get("root_cause") || "").trim() || null,
      corrective_action_required:
        String(formData.get("corrective_action_required") || "").trim() || null,
      corrective_action_owner:
        String(formData.get("corrective_action_owner") || "").trim() || null,
      corrective_action_due_date:
        String(formData.get("corrective_action_due_date") || "").trim() || null,
      closure_notes: String(formData.get("closure_notes") || "").trim() || null,
      evidence_location: String(formData.get("evidence_location") || "").trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("incident_reports")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/incident-reporting");

    if (data?.id) {
      redirect(`/incident-reporting/${data.id}`);
    }

    redirect("/incident-reporting");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Incident Reporting</h1>
        <p className="mt-1 text-slate-600">
          Create, track, and generate internal compliance incident reports without storing sensitive
          supporting evidence directly in RCOS.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Open Incidents</div>
          <div className="mt-2 text-4xl font-bold text-blue-600">{openIncidents.length}</div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Draft Reports</div>
          <div className="mt-2 text-4xl font-bold text-yellow-600">{draftIncidents.length}</div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Closed Reports</div>
          <div className="mt-2 text-4xl font-bold text-green-600">{closedIncidents.length}</div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">High Risk</div>
          <div className="mt-2 text-4xl font-bold text-red-600">{highRiskIncidents.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Create Incident Report</h2>
          <p className="mt-1 text-sm text-slate-500">
            Complete the form below. After submission, RCOS will open a printable incident report
            that can be saved as PDF.
          </p>

          <form action={createIncidentReport} className="mt-6 space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Incident Title
                  </label>
                  <input
                    name="title"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Example: Misaddressed CUI email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Incident Status
                  </label>
                  <select
                    name="incident_status"
                    defaultValue="Draft"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Open">Open</option>
                    <option value="In Review">In Review</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Closed">Closed</option>
                  </select>
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
                    Incident Type
                  </label>
                  <select
                    name="incident_type"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select type</option>
                    <option value="CUI Handling">CUI Handling</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Export Control">Export Control</option>
                    <option value="Unauthorized Access">Unauthorized Access</option>
                    <option value="Misdelivery / Wrong Recipient">
                      Misdelivery / Wrong Recipient
                    </option>
                    <option value="Policy Violation">Policy Violation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Reported By
                  </label>
                  <input
                    name="reported_by"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Name / role"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Date Discovered
                  </label>
                  <input
                    type="date"
                    name="discovered_date"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Time Discovered
                  </label>
                  <input
                    type="time"
                    name="discovered_time"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Department
                  </label>
                  <input
                    name="department"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Department / office"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Project / Award
                  </label>
                  <input
                    name="project_name"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Project, sponsor, or award"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">Classification Flags</h3>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ["involves_cui", "Does this involve CUI?"],
                  ["involves_itar", "Does this involve ITAR?"],
                  ["involves_ear", "Does this involve EAR?"],
                  ["involves_pii", "Does this involve PII?"],
                  ["cyber_related", "Is this cyber-related?"],
                  ["unauthorized_access", "Suspected unauthorized access?"],
                  ["wrong_recipient", "Wrong recipient / misdelivery?"],
                  [
                    "downloaded_printed_transferred",
                    "Downloaded, printed, emailed, or transferred?",
                  ],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <input name={name} type="checkbox" className="h-4 w-4" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">Incident Description</h3>

              <div className="mt-4 space-y-4">
                <textarea
                  name="what_happened"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What happened?"
                />

                <textarea
                  name="how_discovered"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="How was it discovered?"
                />

                <textarea
                  name="who_involved"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Who was involved?"
                />

                <textarea
                  name="affected_system_or_environment"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What system, project, or environment was affected?"
                />

                <textarea
                  name="information_involved"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What information may have been exposed?"
                />
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">Containment / Response</h3>

              <textarea
                name="immediate_actions"
                rows={4}
                className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Immediate actions taken"
              />

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ["access_revoked", "Was access revoked?"],
                  ["it_security_notified", "Was IT/Security notified?"],
                  ["iso_notified", "Was ISO notified?"],
                  ["fso_notified", "Was FSO notified?"],
                  ["eco_notified", "Was ECO notified?"],
                  ["sponsor_notified", "Was sponsor/POC notified?"],
                  ["file_deleted_or_quarantined", "Was file/email deleted or quarantined?"],
                  ["evidence_preserved", "Was evidence preserved?"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <input name={name} type="checkbox" className="h-4 w-4" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">Impact Assessment</h3>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  name="affected_records_count"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Number of affected records/files"
                />

                <input
                  name="affected_data_type"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Type of data involved"
                />

                <input
                  name="affected_project_or_sponsor"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Project / sponsor affected"
                />

                <input
                  name="potential_reporting_obligation"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Potential reporting obligation"
                />

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm md:col-span-2">
                  <input name="follow_up_required" type="checkbox" className="h-4 w-4" />
                  <span>Follow-up required?</span>
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">Corrective Action</h3>

              <div className="mt-4 space-y-4">
                <textarea
                  name="root_cause"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Root cause"
                />

                <textarea
                  name="corrective_action_required"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Corrective action required"
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    name="corrective_action_owner"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Corrective action owner"
                  />

                  <input
                    type="date"
                    name="corrective_action_due_date"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <textarea
                  name="closure_notes"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Closure notes"
                />

                <textarea
                  name="evidence_location"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Evidence location/reference only. Example: SEC SharePoint path, ticket number, secure mailbox reference."
                />
              </div>
            </section>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Incident Report
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Incident Reports</h2>

            {incidents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No incident reports created yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/incident-reporting/${incident.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600"
                        >
                          {incident.title}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500">
                          {incident.incident_type || "Incident"} •{" "}
                          {formatDate(incident.discovered_date || incident.created_at)}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          incident.severity
                        )}`}
                      >
                        {incident.severity || "Medium"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          incident.incident_status
                        )}`}
                      >
                        {incident.incident_status || "Draft"}
                      </span>

                      {incident.involves_cui && (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                          CUI
                        </span>
                      )}

                      {incident.involves_itar && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          ITAR
                        </span>
                      )}

                      {incident.involves_ear && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                          EAR
                        </span>
                      )}

                      {incident.cyber_related && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          Cyber
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/incident-reporting/${incident.id}`}
                      className="mt-4 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                    >
                      View / Print Report
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900">Handling Reminder</h2>
            <p className="mt-2 text-sm text-amber-800">
              Avoid uploading sensitive technical evidence or CUI into RCOS at this stage. Use
              evidence references such as secure repository path, ticket number, or SEC mailbox
              reference.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}