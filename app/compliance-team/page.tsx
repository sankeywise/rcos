import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ConfirmDeleteButton from "@/components/confirm-delete-button";

type ComplianceTeamPageProps = {
  searchParams?: Promise<{
    member?: string;
    expanded?: string;
    trainingRecord?: string;
  }>;
};

const STANDARD_TRAININGS = [
  "CUI Training",
  "Cybersecurity Awareness",
  "Insider Threat Awareness",
  "Export Control Training",
];

function getStatusBadgeClass(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "complete" || normalized === "completed") {
    return "bg-green-100 text-green-700";
  }

  if (normalized === "in progress") {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized === "expired" || normalized === "overdue") {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function getOverallStatus(trainingRecords: any[]) {
  if (!trainingRecords || trainingRecords.length === 0) {
    return "Not Started";
  }

  const statuses = trainingRecords.map((record) =>
    String(record.status || "").toLowerCase()
  );

  if (statuses.some((status) => status === "expired" || status === "overdue")) {
    return "Expired";
  }

  if (
    statuses.every(
      (status) => status === "complete" || status === "completed"
    )
  ) {
    return "Complete";
  }

  if (statuses.some((status) => status === "in progress")) {
    return "In Progress";
  }

  return "Not Started";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function buildMemberLink(
  memberId: string,
  expandedId?: string,
  trainingRecordId?: string
) {
  const params = new URLSearchParams();
  params.set("member", memberId);
  params.set("expanded", expandedId || memberId);

  if (trainingRecordId) {
    params.set("trainingRecord", trainingRecordId);
  }

  return `/compliance-team?${params.toString()}`;
}

export default async function ComplianceTeamPage({
  searchParams,
}: ComplianceTeamPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedMemberId = resolvedSearchParams?.member || "";
  const expandedMemberId = resolvedSearchParams?.expanded || "";
  const selectedTrainingRecordId = resolvedSearchParams?.trainingRecord || "";

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
        Unable to load organization membership.
      </div>
    );
  }

  const orgId = membership.organization_id;

  const { data: teamMembers, error: teamError } = await supabase
    .from("compliance_team")
    .select(`
      id,
      organization_id,
      name,
      email,
      functional_role,
      department,
      responsibility_area,
      notes,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  const { data: trainingRecords, error: trainingError } = await supabase
    .from("compliance_team_training_records")
    .select(`
      id,
      compliance_team_id,
      training_name,
      status,
      completed_on,
      due_on,
      certificate_path,
      certificate_file_name,
      created_at
    `)
    .order("training_name", { ascending: true });

  const trainingMap: Record<string, any[]> = {};

  trainingRecords?.forEach((record) => {
    const key = String(record.compliance_team_id);

    if (!trainingMap[key]) {
      trainingMap[key] = [];
    }

    trainingMap[key].push(record);
  });

  async function createComplianceTeamMember(formData: FormData) {
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
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim() || null,
      functional_role: String(formData.get("functional_role") || "").trim(),
      department: String(formData.get("department") || "").trim() || null,
      responsibility_area:
        String(formData.get("responsibility_area") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    };

    if (!payload.name || !payload.functional_role) {
      throw new Error("Name and functional role are required.");
    }

    const { error } = await supabase.from("compliance_team").insert(payload);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/compliance-team");
  }

  async function updateComplianceTeamMember(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const memberId = String(formData.get("member_id") || "").trim();

    if (!memberId) {
      throw new Error("Member is required.");
    }

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim() || null,
      functional_role: String(formData.get("functional_role") || "").trim(),
      department: String(formData.get("department") || "").trim() || null,
      responsibility_area:
        String(formData.get("responsibility_area") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    };

    if (!payload.name || !payload.functional_role) {
      throw new Error("Name and functional role are required.");
    }

    const { error } = await supabase
      .from("compliance_team")
      .update(payload)
      .eq("id", memberId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/compliance-team");
  }

  async function createTrainingRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const complianceTeamId = String(
      formData.get("compliance_team_id") || ""
    ).trim();
    const trainingName = String(formData.get("training_name") || "").trim();
    const status = String(formData.get("status") || "").trim() || "Not Started";
    const completedOn =
      String(formData.get("completed_on") || "").trim() || null;
    const certificate = formData.get("certificate") as File | null;

    if (!complianceTeamId || !trainingName) {
      throw new Error("Compliance team member and training name are required.");
    }

    let certificatePath: string | null = null;
    let certificateFileName: string | null = null;

    if (certificate && certificate.size > 0) {
      const safeName = sanitizeFileName(certificate.name);
      const filePath = `${orgId}/${complianceTeamId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("training-certificates")
        .upload(filePath, certificate, {
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      certificatePath = filePath;
      certificateFileName = certificate.name;
    }

    const { error } = await supabase
      .from("compliance_team_training_records")
      .insert({
        compliance_team_id: complianceTeamId,
        training_name: trainingName,
        status,
        completed_on: completedOn,
        due_on: null,
        certificate_path: certificatePath,
        certificate_file_name: certificateFileName,
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/compliance-team");
  }

  async function updateTrainingRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const trainingRecordId = String(
      formData.get("training_record_id") || ""
    ).trim();
    const complianceTeamId = String(
      formData.get("compliance_team_id") || ""
    ).trim();
    const trainingName = String(formData.get("training_name") || "").trim();
    const status = String(formData.get("status") || "").trim() || "Not Started";
    const completedOn =
      String(formData.get("completed_on") || "").trim() || null;
    const certificate = formData.get("certificate") as File | null;

    if (!trainingRecordId || !complianceTeamId || !trainingName) {
      throw new Error("Training record, member, and training name are required.");
    }

    const updatePayload: Record<string, any> = {
      training_name: trainingName,
      status,
      completed_on: completedOn,
    };

    if (certificate && certificate.size > 0) {
      const safeName = sanitizeFileName(certificate.name);
      const filePath = `${orgId}/${complianceTeamId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("training-certificates")
        .upload(filePath, certificate, {
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      updatePayload.certificate_path = filePath;
      updatePayload.certificate_file_name = certificate.name;
    }

    const { error } = await supabase
      .from("compliance_team_training_records")
      .update(updatePayload)
      .eq("id", trainingRecordId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/compliance-team");
  }

  async function deleteTrainingRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const trainingRecordId = String(
      formData.get("training_record_id") || ""
    ).trim();

    if (!trainingRecordId) {
      throw new Error("Training record is required.");
    }

    const { error } = await supabase
      .from("compliance_team_training_records")
      .delete()
      .eq("id", trainingRecordId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/compliance-team");
  }

  async function addStandardTrainings(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const complianceTeamId = String(
      formData.get("compliance_team_id") || ""
    ).trim();

    if (!complianceTeamId) {
      throw new Error("Compliance team member is required.");
    }

    const { data: existing } = await supabase
      .from("compliance_team_training_records")
      .select("training_name")
      .eq("compliance_team_id", complianceTeamId);

    const existingNames = new Set(
      (existing || []).map((record) =>
        String(record.training_name).toLowerCase()
      )
    );

    const rowsToInsert = STANDARD_TRAININGS.filter(
      (name) => !existingNames.has(name.toLowerCase())
    ).map((name) => ({
      compliance_team_id: complianceTeamId,
      training_name: name,
      status: "Not Started",
      completed_on: null,
      due_on: null,
      certificate_path: null,
      certificate_file_name: null,
    }));

    if (rowsToInsert.length > 0) {
      const { error } = await supabase
        .from("compliance_team_training_records")
        .insert(rowsToInsert);

      if (error) {
        throw new Error(error.message);
      }
    }

    revalidatePath("/compliance-team");
  }

  const selectedMember =
    (teamMembers || []).find((member) => String(member.id) === selectedMemberId) ||
    null;

  const selectedTrainingRecord =
    (trainingRecords || []).find(
      (record) => String(record.id) === selectedTrainingRecordId
    ) || null;

  const totalTrainingRecords = trainingRecords?.length || 0;
  const completedTrainingRecords =
    trainingRecords?.filter((record) =>
      ["complete", "completed"].includes(
        String(record.status || "").toLowerCase()
      )
    ).length || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Compliance Team</h1>
        <p className="text-slate-600 mt-1">
          Manage compliance personnel, training completion, certificates, and
          readiness.
        </p>
      </div>

      {(teamError || trainingError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          There was a problem loading the compliance team data.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Compliance Team Members</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {teamMembers?.length || 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Training Records</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalTrainingRecords}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Training Completion</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalTrainingRecords === 0
              ? "0%"
              : `${Math.round(
                  (completedTrainingRecords / totalTrainingRecords) * 100
                )}%`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Team Members
            </h2>
            <div className="text-sm text-slate-500">
              {teamMembers?.length || 0} member
              {(teamMembers?.length || 0) === 1 ? "" : "s"}
            </div>
          </div>

          {!teamMembers || teamMembers.length === 0 ? (
            <div className="text-sm text-slate-500">No team members yet.</div>
          ) : (
            <div className="space-y-5">
              {teamMembers.map((member) => {
                const memberTrainings = trainingMap[String(member.id)] || [];
                const completedCount = memberTrainings.filter(
                  (record) =>
                    String(record.status || "").toLowerCase() === "complete" ||
                    String(record.status || "").toLowerCase() === "completed"
                ).length;
                const totalCount = memberTrainings.length;
                const overallStatus = getOverallStatus(memberTrainings);
                const isExpanded = expandedMemberId === String(member.id);

                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-slate-200 overflow-hidden"
                  >
                    <div className="bg-white px-5 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-slate-900">
                            {member.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {member.functional_role}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {member.email || "No email"}
                            {member.department ? ` • ${member.department}` : ""}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 lg:items-end">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                              overallStatus
                            )}`}
                          >
                            {overallStatus}
                          </span>

                          <div className="text-sm text-slate-700">
                            {totalCount === 0 ? (
                              <span className="text-slate-400">
                                No trainings assigned
                              </span>
                            ) : (
                              <span>
                                {completedCount}/{totalCount} Complete
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500">
                            Responsibility: {member.responsibility_area || "—"}
                          </div>

                          <div className="flex items-center gap-4">
                            <a
                              href={buildMemberLink(String(member.id), String(member.id))}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              Edit Member
                            </a>

                            <a
                              href={
                                isExpanded
                                  ? `/compliance-team${
                                      selectedMemberId
                                        ? `?member=${selectedMemberId}`
                                        : ""
                                    }`
                                  : `/compliance-team?expanded=${member.id}${
                                      selectedMemberId
                                        ? `&member=${selectedMemberId}`
                                        : ""
                                    }`
                              }
                              className="text-xs font-medium text-slate-600 hover:text-slate-800"
                            >
                              {isExpanded
                                ? "Hide Standard Trainings"
                                : "Show Standard Trainings"}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-800">
                              Standard Training Requirements
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              View and manage the assigned training evidence for
                              this member.
                            </div>
                          </div>

                          <form action={addStandardTrainings}>
                            <input
                              type="hidden"
                              name="compliance_team_id"
                              value={member.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              Add Standard Trainings
                            </button>
                          </form>
                        </div>

                        {memberTrainings.length === 0 ? (
                          <div className="text-sm text-slate-400">
                            No training records assigned yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {memberTrainings.map((record) => (
                              <div
                                key={record.id}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {record.training_name}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Date Completed:{" "}
                                      {formatDate(record.completed_on)}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Certificate:{" "}
                                      {record.certificate_path ? (
                                        <span className="text-slate-700">
                                          {record.certificate_file_name ||
                                            "Uploaded"}
                                        </span>
                                      ) : (
                                        "No certificate uploaded"
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-start gap-2 md:items-end">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                                        record.status
                                      )}`}
                                    >
                                      {record.status || "Not Started"}
                                    </span>

                                    <a
                                      href={buildMemberLink(
                                        String(member.id),
                                        String(member.id),
                                        String(record.id)
                                      )}
                                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                    >
                                      Edit Training
                                    </a>

                                    <form action={deleteTrainingRecord}>
                                      <input
                                        type="hidden"
                                        name="training_record_id"
                                        value={record.id}
                                      />
                                      <ConfirmDeleteButton
                                        className="text-xs font-medium text-red-600 hover:text-red-700"
                                        message="Are you sure you want to delete this training record?"
                                      >
                                        Delete Training
                                      </ConfirmDeleteButton>
                                    </form>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Add Member</h2>
            <p className="text-sm text-slate-600 mt-1 mb-6">
              Add a compliance team member to the operational roster.
            </p>

            <form action={createComplianceTeamMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Full Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Functional Role
                </label>
                <select
                  name="functional_role"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  required
                >
                  <option value="">Select Role</option>
                  <option value="Export Control Officer">
                    Export Control Officer
                  </option>
                  <option value="ISO / CISO">ISO / CISO</option>
                  <option value="FSO">FSO</option>
                  <option value="IT Administrator">IT Administrator</option>
                  <option value="Research Security Officer">
                    Research Security Officer
                  </option>
                  <option value="Compliance Analyst">Compliance Analyst</option>
                  <option value="Compliance Manager">Compliance Manager</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Department"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Responsibility Area
                </label>
                <input
                  type="text"
                  name="responsibility_area"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Responsibility Area"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Optional notes"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                Add Member
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Add Training Record
            </h2>
            <p className="text-sm text-slate-600 mt-1 mb-6">
              Add individual training completion records and upload certificates.
            </p>

            <form action={createTrainingRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Team Member
                </label>
                <select
                  name="compliance_team_id"
                  defaultValue={selectedMemberId}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  required
                >
                  <option value="">Select team member</option>
                  {(teamMembers || []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} — {member.functional_role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Training Name
                </label>
                <select
                  name="training_name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  required
                >
                  <option value="">Select training</option>
                  {STANDARD_TRAININGS.map((training) => (
                    <option key={training} value={training}>
                      {training}
                    </option>
                  ))}
                  <option value="Research Security Training">
                    Research Security Training
                  </option>
                  <option value="Access Control Training">
                    Access Control Training
                  </option>
                  <option value="Other Training">Other Training</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="Not Started"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Date Completed
                </label>
                <input
                  type="date"
                  name="completed_on"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Completion Certificate
                </label>
                <input
                  type="file"
                  name="certificate"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  accept=".pdf,.png,.jpg,.jpeg"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 transition"
              >
                Add Training Record
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Edit Training Record
            </h2>
            <p className="text-sm text-slate-600 mt-1 mb-6">
              Update training progress, completion details, and certificate evidence.
            </p>

            {!selectedTrainingRecord ? (
              <div className="text-sm text-slate-500">
                Select a training record by clicking “Edit Training” on the left.
              </div>
            ) : (
              <div className="space-y-4">
                <form action={updateTrainingRecord} className="space-y-4">
                  <input
                    type="hidden"
                    name="training_record_id"
                    value={selectedTrainingRecord.id}
                  />
                  <input
                    type="hidden"
                    name="compliance_team_id"
                    value={selectedTrainingRecord.compliance_team_id}
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Training Name
                    </label>
                    <select
                      name="training_name"
                      defaultValue={selectedTrainingRecord.training_name || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      required
                    >
                      <option value="">Select training</option>
                      {STANDARD_TRAININGS.map((training) => (
                        <option key={training} value={training}>
                          {training}
                        </option>
                      ))}
                      <option value="Research Security Training">
                        Research Security Training
                      </option>
                      <option value="Access Control Training">
                        Access Control Training
                      </option>
                      <option value="Other Training">Other Training</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      defaultValue={selectedTrainingRecord.status || "Not Started"}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Complete">Complete</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Date Completed
                    </label>
                    <input
                      type="date"
                      name="completed_on"
                      defaultValue={selectedTrainingRecord.completed_on || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    Current Certificate:{" "}
                    {selectedTrainingRecord.certificate_file_name ||
                      "No certificate uploaded"}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Replace Completion Certificate
                    </label>
                    <input
                      type="file"
                      name="certificate"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
                    >
                      Save Training Changes
                    </button>

                    <a
                      href={
                        selectedMemberId
                          ? buildMemberLink(selectedMemberId, selectedMemberId)
                          : "/compliance-team"
                      }
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </a>
                  </div>
                </form>

                <form action={deleteTrainingRecord}>
                  <input
                    type="hidden"
                    name="training_record_id"
                    value={selectedTrainingRecord.id}
                  />
                  <ConfirmDeleteButton
                    className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition"
                    message="Are you sure you want to delete this training record?"
                  >
                    Delete Training
                  </ConfirmDeleteButton>
                </form>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Edit Member
            </h2>
            <p className="text-sm text-slate-600 mt-1 mb-6">
              Update compliance team member information.
            </p>

            {!selectedMember ? (
              <div className="text-sm text-slate-500">
                Select a team member by clicking “Edit Member” on the left.
              </div>
            ) : (
              <form action={updateComplianceTeamMember} className="space-y-4">
                <input type="hidden" name="member_id" value={selectedMember.id} />

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={selectedMember.name || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={selectedMember.email || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Functional Role
                  </label>
                  <select
                    name="functional_role"
                    defaultValue={selectedMember.functional_role || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  >
                    <option value="">Select Role</option>
                    <option value="Export Control Officer">
                      Export Control Officer
                    </option>
                    <option value="ISO / CISO">ISO / CISO</option>
                    <option value="FSO">FSO</option>
                    <option value="IT Administrator">IT Administrator</option>
                    <option value="Research Security Officer">
                      Research Security Officer
                    </option>
                    <option value="Compliance Analyst">Compliance Analyst</option>
                    <option value="Compliance Manager">Compliance Manager</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    defaultValue={selectedMember.department || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Responsibility Area
                  </label>
                  <input
                    type="text"
                    name="responsibility_area"
                    defaultValue={selectedMember.responsibility_area || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={4}
                    defaultValue={selectedMember.notes || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
                  >
                    Save Member Changes
                  </button>

                  <a
                    href="/compliance-team"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}