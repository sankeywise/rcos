import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function getBadgeClass(status?: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "approved" ||
    normalized === "active" ||
    normalized === "verified"
  ) {
    return "bg-green-100 text-green-700";
  }

  if (
    normalized === "in progress" ||
    normalized === "pending" ||
    normalized === "draft"
  ) {
    return "bg-blue-100 text-blue-700";
  }

  if (
    normalized === "expired" ||
    normalized === "overdue" ||
    normalized === "non-compliant"
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  const normalized = normalizeStatus(value);
  return ["complete", "completed", "approved", "verified"].includes(normalized);
}

export default async function CMMCCompliancePage() {
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
    return (
      <div className="p-6 text-red-600">
        No organization membership found.
      </div>
    );
  }

  const orgId = membership.organization_id;

  const { data: profile } = await supabase
    .from("cmmc_compliance_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  const { data: artifacts } = await supabase
    .from("artifacts")
    .select(`
      id,
      organization_id,
      title,
      artifact_type,
      status,
      created_at,
      file_path,
      project_id
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const { data: personnel } = await supabase
    .from("personnel")
    .select(`
      id,
      organization_id,
      training_complete,
      rps_screening_status,
      citizenship_status,
      secure_machine_name,
      secure_machine_status
    `)
    .eq("organization_id", orgId);

  const { data: complianceTeam } = await supabase
    .from("compliance_team")
    .select(`
      id,
      organization_id,
      name
    `)
    .eq("organization_id", orgId);

  const { data: complianceTeamTraining } = await supabase
    .from("compliance_team_training_records")
    .select(`
      id,
      compliance_team_id,
      status
    `);

  const cmmcDocs = (artifacts || []).filter((doc) => {
    const title = String(doc.title || "").toLowerCase();
    const type = String(doc.artifact_type || "").toLowerCase();

    return (
      title.includes("ssp") ||
      title.includes("sprs") ||
      title.includes("poam") ||
      title.includes("system security plan") ||
      title.includes("plan of action") ||
      title.includes("cmmc") ||
      title.includes("nist") ||
      title.includes("800-171") ||
      title.includes("incident response") ||
      title.includes("access control") ||
      title.includes("media protection") ||
      title.includes("audit") ||
      title.includes("logging") ||
      type.includes("ssp") ||
      type.includes("sprs") ||
      type.includes("poam") ||
      type.includes("cmmc")
    );
  });

  const completedDocs = cmmcDocs.filter((doc) => isCompleteStatus(doc.status));
  const pendingDocs = cmmcDocs.filter((doc) => !isCompleteStatus(doc.status));

  const complianceTeamTrainingMap: Record<string, any[]> = {};
  (complianceTeamTraining || []).forEach((row) => {
    const key = String(row.compliance_team_id);
    if (!complianceTeamTrainingMap[key]) {
      complianceTeamTrainingMap[key] = [];
    }
    complianceTeamTrainingMap[key].push(row);
  });

  const incompleteComplianceTeamMembers = (complianceTeam || []).filter((member) => {
    const records = complianceTeamTrainingMap[String(member.id)] || [];
    if (records.length === 0) return true;
    return !records.every((row) => isCompleteStatus(row.status));
  }).length;

  const incompletePersonnelTraining =
    (personnel || []).filter((person) => !person.training_complete).length || 0;

  const incompletePersonnelRps =
    (personnel || []).filter(
      (person) =>
        !["cleared", "verified", "complete", "completed"].includes(
          normalizeStatus(person.rps_screening_status)
        )
    ).length || 0;

  const incompletePersonnelCitizenship =
    (personnel || []).filter(
      (person) =>
        !["verified", "approved", "cleared"].includes(
          normalizeStatus(person.citizenship_status)
        )
    ).length || 0;

  const incompleteSecureMachines =
    (personnel || []).filter(
      (person) =>
        !person.secure_machine_name ||
        normalizeStatus(person.secure_machine_status) !== "verified"
    ).length || 0;

  const controlCards = [
    {
      label: "SSP",
      status: profile?.ssp_status || "Draft",
    },
    {
      label: "POA&M",
      status: profile?.poam_status || "Draft",
    },
    {
      label: "Incident Response",
      status: profile?.incident_response_status || "Draft",
    },
    {
      label: "Access Control",
      status: profile?.access_control_status || "Draft",
    },
    {
      label: "Audit Logging",
      status: profile?.audit_logging_status || "Draft",
    },
    {
      label: "Media Protection",
      status: profile?.media_protection_status || "Draft",
    },
    {
      label: "Training Program",
      status: profile?.training_program_status || "Draft",
    },
    {
      label: "Vendor Management",
      status: profile?.vendor_management_status || "Draft",
    },
    {
      label: "Scoping",
      status: profile?.scoping_status || "Draft",
    },
  ];

  const completedControlCount = controlCards.filter((card) =>
    isCompleteStatus(card.status)
  ).length;

  const totalChecklistItems =
    controlCards.length + 5;

  const completedChecklistItems =
    completedControlCount +
    (completedDocs.length > 0 ? 1 : 0) +
    (incompleteComplianceTeamMembers === 0 && (complianceTeam || []).length > 0 ? 1 : 0) +
    (incompletePersonnelTraining === 0 && (personnel || []).length > 0 ? 1 : 0) +
    (incompletePersonnelRps === 0 && (personnel || []).length > 0 ? 1 : 0) +
    (incompleteSecureMachines === 0 && (personnel || []).length > 0 ? 1 : 0);

  const readinessPercent =
    totalChecklistItems === 0
      ? 0
      : Math.round((completedChecklistItems / totalChecklistItems) * 100);

  const incompleteItems = [
    ...(pendingDocs.length > 0
      ? [`${pendingDocs.length} CMMC document(s) still draft, pending, or incomplete`]
      : []),
    ...(incompleteComplianceTeamMembers > 0
      ? [`${incompleteComplianceTeamMembers} compliance team member(s) missing completed training coverage`]
      : []),
    ...(incompletePersonnelTraining > 0
      ? [`${incompletePersonnelTraining} personnel record(s) missing completed training`]
      : []),
    ...(incompletePersonnelRps > 0
      ? [`${incompletePersonnelRps} personnel record(s) missing completed restricted party screening`]
      : []),
    ...(incompletePersonnelCitizenship > 0
      ? [`${incompletePersonnelCitizenship} personnel record(s) missing citizenship verification`]
      : []),
    ...(incompleteSecureMachines > 0
      ? [`${incompleteSecureMachines} personnel record(s) missing verified secure machine assignment`]
      : []),
    ...controlCards
      .filter((card) => !isCompleteStatus(card.status))
      .map((card) => `${card.label} is still ${card.status || "Draft"}`),
  ];

  async function saveCmmcProfile(formData: FormData) {
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

    const payload = {
      organization_id: membership.organization_id,
      enclave_name: String(formData.get("enclave_name") || "").trim() || null,
      cmmc_level_target:
        String(formData.get("cmmc_level_target") || "").trim() || "Level 2",
      sprs_score: String(formData.get("sprs_score") || "").trim()
        ? Number(formData.get("sprs_score"))
        : null,
      sprs_last_updated:
        String(formData.get("sprs_last_updated") || "").trim() || null,
      assessment_status:
        String(formData.get("assessment_status") || "").trim() || "In Progress",
      ssp_status: String(formData.get("ssp_status") || "").trim() || "Draft",
      poam_status: String(formData.get("poam_status") || "").trim() || "Draft",
      incident_response_status:
        String(formData.get("incident_response_status") || "").trim() || "Draft",
      access_control_status:
        String(formData.get("access_control_status") || "").trim() || "Draft",
      audit_logging_status:
        String(formData.get("audit_logging_status") || "").trim() || "Draft",
      media_protection_status:
        String(formData.get("media_protection_status") || "").trim() || "Draft",
      training_program_status:
        String(formData.get("training_program_status") || "").trim() || "Draft",
      vendor_management_status:
        String(formData.get("vendor_management_status") || "").trim() || "Draft",
      scoping_status:
        String(formData.get("scoping_status") || "").trim() || "Draft",
      notes: String(formData.get("notes") || "").trim() || null,
    };

    const { error } = await supabase
      .from("cmmc_compliance_profiles")
      .upsert(payload, { onConflict: "organization_id" });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/cmmc-compliance");
    revalidatePath("/");
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-900">CMMC Compliance</h1>
        <p className="text-slate-600 mt-1">
          Organization-level view for SPRS, SSP, POA&amp;M, enclave readiness, and related CMMC/NIST 800-171 compliance items.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">SPRS Score</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {profile?.sprs_score ?? "—"}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Updated {formatDate(profile?.sprs_last_updated)}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">CMMC Target</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {profile?.cmmc_level_target || "Level 2"}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Enclave: {profile?.enclave_name || "Not entered"}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Assessment Status</div>
          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                profile?.assessment_status
              )}`}
            >
              {profile?.assessment_status || "In Progress"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Incomplete Items</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {incompleteItems.length}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Readiness</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {readinessPercent}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900">Open Compliance Items</h2>
        {incompleteItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            No open organization-level CMMC compliance items detected.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {incompleteItems.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold text-slate-900">
                CMMC / NIST Documents
              </h2>
              <div className="text-sm text-slate-500">
                {cmmcDocs.length} item{cmmcDocs.length === 1 ? "" : "s"}
              </div>
            </div>

            {cmmcDocs.length === 0 ? (
              <div className="text-sm text-slate-500">
                No CMMC-specific documents identified yet.
              </div>
            ) : (
              <div className="space-y-3">
                {cmmcDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-slate-200 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium text-slate-900">
                          {doc.title || "Untitled"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {doc.artifact_type || "Compliance Item"} • {formatDate(doc.created_at)}
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          doc.status
                        )}`}
                      >
                        {doc.status || "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              CMMC Control Readiness
            </h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {controlCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-200 px-4 py-4"
                >
                  <div className="text-sm font-medium text-slate-900">
                    {card.label}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                        card.status
                      )}`}
                    >
                      {card.status || "Draft"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Readiness Drivers
            </h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-slate-200 px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Compliance Team Training
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {incompleteComplianceTeamMembers === 0 ? "Ready" : incompleteComplianceTeamMembers}
                </div>
                <div className="mt-1 text-slate-500">
                  {incompleteComplianceTeamMembers === 0
                    ? "All tracked compliance team records are complete"
                    : "Members still need training completion"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Personnel Training
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {incompletePersonnelTraining === 0 ? "Ready" : incompletePersonnelTraining}
                </div>
                <div className="mt-1 text-slate-500">
                  {incompletePersonnelTraining === 0
                    ? "All personnel training marked complete"
                    : "Personnel training still incomplete"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  RPS Screening
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {incompletePersonnelRps === 0 ? "Ready" : incompletePersonnelRps}
                </div>
                <div className="mt-1 text-slate-500">
                  {incompletePersonnelRps === 0
                    ? "Personnel screening coverage complete"
                    : "RPS screening still open"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Citizenship Verification
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {incompletePersonnelCitizenship === 0 ? "Ready" : incompletePersonnelCitizenship}
                </div>
                <div className="mt-1 text-slate-500">
                  {incompletePersonnelCitizenship === 0
                    ? "Citizenship reviews complete"
                    : "Citizenship review items remain"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 px-4 py-4 md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Secure Machine Verification
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {incompleteSecureMachines === 0 ? "Ready" : incompleteSecureMachines}
                </div>
                <div className="mt-1 text-slate-500">
                  {incompleteSecureMachines === 0
                    ? "All tracked personnel have verified secure machine assignments"
                    : "Some personnel still need verified machine coverage"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Edit CMMC Profile
          </h2>
          <p className="text-sm text-slate-600 mt-1 mb-6">
            Capture the organization-level CMMC program state here.
          </p>

          <form action={saveCmmcProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Enclave Name
              </label>
              <input
                type="text"
                name="enclave_name"
                defaultValue={profile?.enclave_name || ""}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="FTRI CUI Enclave"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                CMMC Level Target
              </label>
              <select
                name="cmmc_level_target"
                defaultValue={profile?.cmmc_level_target || "Level 2"}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="Level 1">Level 1</option>
                <option value="Level 2">Level 2</option>
                <option value="Level 3">Level 3</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  SPRS Score
                </label>
                <input
                  type="number"
                  name="sprs_score"
                  defaultValue={profile?.sprs_score ?? ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="110"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  SPRS Updated
                </label>
                <input
                  type="date"
                  name="sprs_last_updated"
                  defaultValue={profile?.sprs_last_updated || ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Assessment Status
              </label>
              <select
                name="assessment_status"
                defaultValue={profile?.assessment_status || "In Progress"}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="Draft">Draft</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Complete">Complete</option>
              </select>
            </div>

            {[
              ["ssp_status", "SSP Status"],
              ["poam_status", "POA&M Status"],
              ["incident_response_status", "Incident Response Status"],
              ["access_control_status", "Access Control Status"],
              ["audit_logging_status", "Audit Logging Status"],
              ["media_protection_status", "Media Protection Status"],
              ["training_program_status", "Training Program Status"],
              ["vendor_management_status", "Vendor Management Status"],
              ["scoping_status", "Scoping Status"],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  {label}
                </label>
                <select
                  name={field}
                  defaultValue={(profile as any)?.[field] || "Draft"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                  <option value="Complete">Complete</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                rows={5}
                defaultValue={profile?.notes || ""}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Assessment notes, enclave scoping notes, upcoming milestones, open issues, etc."
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Save CMMC Profile
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}