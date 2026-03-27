import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ConfirmDeleteButton from "@/components/confirm-delete-button";

type PersonnelPageProps = {
  searchParams?: Promise<{
    person?: string;
    trainingRecord?: string;
  }>;
};

const STANDARD_PERSONNEL_TRAININGS = [
  "CUI Training",
  "Cybersecurity Awareness",
  "Insider Threat Awareness",
  "Export Control Training",
  "Access Control Training",
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function getBadgeClass(status?: string | boolean | null) {
  if (typeof status === "boolean") {
    return status
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700";
  }

  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "approved" ||
    normalized === "verified" ||
    normalized === "active" ||
    normalized === "cleared"
  ) {
    return "bg-green-100 text-green-700";
  }

  if (
    normalized === "in progress" ||
    normalized === "pending" ||
    normalized === "pending verification" ||
    normalized === "review required"
  ) {
    return "bg-blue-100 text-blue-700";
  }

  if (
    normalized === "expired" ||
    normalized === "overdue" ||
    normalized === "non-compliant" ||
    normalized === "restricted"
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function displayName(person: any) {
  return person.full_name || person.name || "Unnamed Person";
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function getTrainingRollup(trainingRecords: any[]) {
  if (!trainingRecords || trainingRecords.length === 0) {
    return {
      overallStatus: "Not Started",
      completedCount: 0,
      totalCount: 0,
    };
  }

  const totalCount = trainingRecords.length;
  const completedCount = trainingRecords.filter((record) =>
    ["complete", "completed"].includes(String(record.status || "").toLowerCase())
  ).length;

  const statuses = trainingRecords.map((record) =>
    String(record.status || "").toLowerCase()
  );

  let overallStatus = "Not Started";

  if (statuses.some((status) => status === "expired" || status === "overdue")) {
    overallStatus = "Expired";
  } else if (
    statuses.every(
      (status) => status === "complete" || status === "completed"
    )
  ) {
    overallStatus = "Complete";
  } else if (statuses.some((status) => status === "in progress")) {
    overallStatus = "In Progress";
  }

  return {
    overallStatus,
    completedCount,
    totalCount,
  };
}

export default async function PersonnelPage({
  searchParams,
}: PersonnelPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedPersonId = resolvedSearchParams?.person || "";
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

  const { data: personnel, error: personnelError } = await supabase
    .from("personnel")
    .select(`
      id,
      organization_id,
      project_id,
      name,
      full_name,
      role,
      citizenship,
      training_complete,
      citizenship_status,
      additional_screening_status,
      additional_screening_date,
      rps_screening_status,
      rps_screening_date,
      personnel_status,
      secure_machine_name,
      secure_machine_asset_tag,
      secure_machine_serial,
      secure_machine_location,
      secure_machine_verified_on,
      secure_machine_status,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_name")
    .eq("organization_id", orgId)
    .order("project_name", { ascending: true });

  const { data: trainingRecords, error: trainingError } = await supabase
    .from("personnel_training_records")
    .select(`
      id,
      personnel_id,
      training_name,
      status,
      completed_on,
      certificate_path,
      certificate_file_name,
      created_at
    `)
    .order("training_name", { ascending: true });

  const trainingMap: Record<string, any[]> = {};

  (trainingRecords || []).forEach((record) => {
    const key = String(record.personnel_id);
    if (!trainingMap[key]) {
      trainingMap[key] = [];
    }
    trainingMap[key].push(record);
  });

  async function createPersonnelRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) redirect("/");

    const fullName = String(formData.get("full_name") || "").trim();
    const projectIdRaw = String(formData.get("project_id") || "").trim();

    const payload = {
      organization_id: membership.organization_id,
      project_id: projectIdRaw ? Number(projectIdRaw) : null,
      full_name: fullName || null,
      name: fullName || null,
      role: String(formData.get("role") || "").trim(),
      citizenship: String(formData.get("citizenship") || "").trim() || null,
      training_complete: false,
      citizenship_status:
        String(formData.get("citizenship_status") || "").trim() || null,
      additional_screening_status:
        String(formData.get("additional_screening_status") || "").trim() || null,
      additional_screening_date:
        String(formData.get("additional_screening_date") || "").trim() || null,
      rps_screening_status:
        String(formData.get("rps_screening_status") || "").trim() || null,
      rps_screening_date:
        String(formData.get("rps_screening_date") || "").trim() || null,
      personnel_status:
        String(formData.get("personnel_status") || "").trim() || "Active",
      secure_machine_name:
        String(formData.get("secure_machine_name") || "").trim() || null,
      secure_machine_asset_tag:
        String(formData.get("secure_machine_asset_tag") || "").trim() || null,
      secure_machine_serial:
        String(formData.get("secure_machine_serial") || "").trim() || null,
      secure_machine_location:
        String(formData.get("secure_machine_location") || "").trim() || null,
      secure_machine_verified_on:
        String(formData.get("secure_machine_verified_on") || "").trim() || null,
      secure_machine_status:
        String(formData.get("secure_machine_status") || "").trim() ||
        "Unassigned",
    };

    if (!payload.full_name || !payload.role) {
      throw new Error("Full name and role are required.");
    }

    const { error } = await supabase.from("personnel").insert(payload);

    if (error) throw new Error(error.message);

    revalidatePath("/personnel");
    revalidatePath("/");
  }

  async function updatePersonnelRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const personId = String(formData.get("person_id") || "").trim();
    const projectIdRaw = String(formData.get("project_id") || "").trim();
    const fullName = String(formData.get("full_name") || "").trim();

    if (!personId) throw new Error("Personnel record is required.");

    const payload = {
      project_id: projectIdRaw ? Number(projectIdRaw) : null,
      full_name: fullName || null,
      name: fullName || null,
      role: String(formData.get("role") || "").trim(),
      citizenship: String(formData.get("citizenship") || "").trim() || null,
      citizenship_status:
        String(formData.get("citizenship_status") || "").trim() || null,
      additional_screening_status:
        String(formData.get("additional_screening_status") || "").trim() || null,
      additional_screening_date:
        String(formData.get("additional_screening_date") || "").trim() || null,
      rps_screening_status:
        String(formData.get("rps_screening_status") || "").trim() || null,
      rps_screening_date:
        String(formData.get("rps_screening_date") || "").trim() || null,
      personnel_status:
        String(formData.get("personnel_status") || "").trim() || "Active",
      secure_machine_name:
        String(formData.get("secure_machine_name") || "").trim() || null,
      secure_machine_asset_tag:
        String(formData.get("secure_machine_asset_tag") || "").trim() || null,
      secure_machine_serial:
        String(formData.get("secure_machine_serial") || "").trim() || null,
      secure_machine_location:
        String(formData.get("secure_machine_location") || "").trim() || null,
      secure_machine_verified_on:
        String(formData.get("secure_machine_verified_on") || "").trim() || null,
      secure_machine_status:
        String(formData.get("secure_machine_status") || "").trim() ||
        "Unassigned",
    };

    if (!payload.full_name || !payload.role) {
      throw new Error("Full name and role are required.");
    }

    const { error } = await supabase
      .from("personnel")
      .update(payload)
      .eq("id", Number(personId));

    if (error) throw new Error(error.message);

    revalidatePath("/personnel");
    revalidatePath("/");
  }

  async function addPersonnelTrainingRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const personnelId = String(formData.get("personnel_id") || "").trim();
    const trainingName = String(formData.get("training_name") || "").trim();
    const status = String(formData.get("status") || "").trim() || "Not Started";
    const completedOn =
      String(formData.get("completed_on") || "").trim() || null;
    const certificate = formData.get("certificate") as File | null;

    if (!personnelId || !trainingName) {
      throw new Error("Personnel and training name are required.");
    }

    let certificatePath: string | null = null;
    let certificateFileName: string | null = null;

    if (certificate && certificate.size > 0) {
      const safeName = sanitizeFileName(certificate.name);
      const filePath = `${orgId}/personnel/${personnelId}/${Date.now()}-${safeName}`;

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

    const { error } = await supabase.from("personnel_training_records").insert({
      personnel_id: Number(personnelId),
      training_name: trainingName,
      status,
      completed_on: completedOn,
      certificate_path: certificatePath,
      certificate_file_name: certificateFileName,
    });

    if (error) throw new Error(error.message);

    const { data: personTrainingRows } = await supabase
      .from("personnel_training_records")
      .select("status")
      .eq("personnel_id", Number(personnelId));

    const allComplete =
      (personTrainingRows || []).length > 0 &&
      (personTrainingRows || []).every((row) =>
        ["complete", "completed"].includes(String(row.status || "").toLowerCase())
      );

    await supabase
      .from("personnel")
      .update({ training_complete: allComplete })
      .eq("id", Number(personnelId));

    revalidatePath("/personnel");
    revalidatePath("/");
  }

  async function updatePersonnelTrainingRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const trainingRecordId = String(
      formData.get("training_record_id") || ""
    ).trim();
    const personnelId = String(formData.get("personnel_id") || "").trim();
    const trainingName = String(formData.get("training_name") || "").trim();
    const status = String(formData.get("status") || "").trim() || "Not Started";
    const completedOn =
      String(formData.get("completed_on") || "").trim() || null;
    const certificate = formData.get("certificate") as File | null;

    if (!trainingRecordId || !personnelId || !trainingName) {
      throw new Error("Training record, personnel, and training name are required.");
    }

    const updatePayload: Record<string, any> = {
      training_name: trainingName,
      status,
      completed_on: completedOn,
    };

    if (certificate && certificate.size > 0) {
      const safeName = sanitizeFileName(certificate.name);
      const filePath = `${orgId}/personnel/${personnelId}/${Date.now()}-${safeName}`;

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
      .from("personnel_training_records")
      .update(updatePayload)
      .eq("id", Number(trainingRecordId));

    if (error) throw new Error(error.message);

    const { data: personTrainingRows } = await supabase
      .from("personnel_training_records")
      .select("status")
      .eq("personnel_id", Number(personnelId));

    const allComplete =
      (personTrainingRows || []).length > 0 &&
      (personTrainingRows || []).every((row) =>
        ["complete", "completed"].includes(String(row.status || "").toLowerCase())
      );

    await supabase
      .from("personnel")
      .update({ training_complete: allComplete })
      .eq("id", Number(personnelId));

    revalidatePath("/personnel");
    revalidatePath("/");
  }

  async function deletePersonnelTrainingRecord(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const trainingRecordId = String(
      formData.get("training_record_id") || ""
    ).trim();
    const personnelId = String(formData.get("personnel_id") || "").trim();

    if (!trainingRecordId) {
      throw new Error("Training record is required.");
    }

    const { error } = await supabase
      .from("personnel_training_records")
      .delete()
      .eq("id", Number(trainingRecordId));

    if (error) throw new Error(error.message);

    if (personnelId) {
      const { data: personTrainingRows } = await supabase
        .from("personnel_training_records")
        .select("status")
        .eq("personnel_id", Number(personnelId));

      const allComplete =
        (personTrainingRows || []).length > 0 &&
        (personTrainingRows || []).every((row) =>
          ["complete", "completed"].includes(
            String(row.status || "").toLowerCase()
          )
        );

      await supabase
        .from("personnel")
        .update({ training_complete: allComplete })
        .eq("id", Number(personnelId));
    }

    revalidatePath("/personnel");
    revalidatePath("/");
  }

  async function addStandardPersonnelTrainings(formData: FormData) {
    "use server";

    const supabase = await createServerSupabaseClient();

    const personnelId = String(formData.get("personnel_id") || "").trim();

    if (!personnelId) {
      throw new Error("Personnel is required.");
    }

    const { data: existing } = await supabase
      .from("personnel_training_records")
      .select("training_name")
      .eq("personnel_id", Number(personnelId));

    const existingNames = new Set(
      (existing || []).map((row) => String(row.training_name).toLowerCase())
    );

    const rowsToInsert = STANDARD_PERSONNEL_TRAININGS.filter(
      (name) => !existingNames.has(name.toLowerCase())
    ).map((name) => ({
      personnel_id: Number(personnelId),
      training_name: name,
      status: "Not Started",
      completed_on: null,
      certificate_path: null,
      certificate_file_name: null,
    }));

    if (rowsToInsert.length > 0) {
      const { error } = await supabase
        .from("personnel_training_records")
        .insert(rowsToInsert);

      if (error) throw new Error(error.message);
    }

    revalidatePath("/personnel");
  }

  const selectedPerson =
    (personnel || []).find((person) => String(person.id) === selectedPersonId) ||
    null;

  const selectedPersonTrainings = selectedPerson
    ? trainingMap[String(selectedPerson.id)] || []
    : [];

  const selectedTrainingRecord =
    selectedPersonTrainings.find(
      (record) => String(record.id) === selectedTrainingRecordId
    ) || null;

  const totalPersonnel = personnel?.length || 0;
  const verifiedMachines =
    personnel?.filter(
      (person) =>
        String(person.secure_machine_status || "").toLowerCase() === "verified"
    ).length || 0;
  const incompletePersonnel =
    personnel?.filter(
      (person) =>
        !person.training_complete ||
        !person.secure_machine_name ||
        String(person.secure_machine_status || "").toLowerCase() !== "verified"
    ).length || 0;

  const totalPersonnelTrainingRecords = (trainingRecords || []).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Personnel</h1>
        <p className="text-slate-600 mt-1">
          Track personnel, screenings, training records, and secure machine assignment.
        </p>
      </div>

      {personnelError || trainingError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          There was a problem loading personnel data.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Personnel Records</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalPersonnel}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Training Records</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalPersonnelTrainingRecords}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Verified Secure Machines</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {verifiedMachines}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Incomplete Personnel Items</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {incompletePersonnel}
          </div>
        </div>
      </div>

      {selectedPerson ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Edit Personnel
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {displayName(selectedPerson)} • {selectedPerson.role || "—"}
                </p>
              </div>

              <a
                href="/personnel"
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </a>
            </div>

            <form action={updatePersonnelRecord} className="space-y-4">
              <input type="hidden" name="person_id" value={selectedPerson.id} />

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={displayName(selectedPerson)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Role
                </label>
                <input
                  type="text"
                  name="role"
                  defaultValue={selectedPerson.role || ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Project
                </label>
                <select
                  name="project_id"
                  defaultValue={selectedPerson.project_id || ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select project</option>
                  {(projects || []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Citizenship
                </label>
                <input
                  type="text"
                  name="citizenship"
                  defaultValue={selectedPerson.citizenship || ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Citizenship Status
                  </label>
                  <select
                    name="citizenship_status"
                    defaultValue={selectedPerson.citizenship_status || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select status</option>
                    <option value="Verified">Verified</option>
                    <option value="Review Required">Review Required</option>
                    <option value="Restricted">Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Personnel Status
                  </label>
                  <select
                    name="personnel_status"
                    defaultValue={selectedPerson.personnel_status || "Active"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Restricted">Restricted</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    RPS Screening Status
                  </label>
                  <select
                    name="rps_screening_status"
                    defaultValue={selectedPerson.rps_screening_status || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select status</option>
                    <option value="Not Started">Not Started</option>
                    <option value="Pending">Pending</option>
                    <option value="Cleared">Cleared</option>
                    <option value="Review Required">Review Required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    RPS Screening Date
                  </label>
                  <input
                    type="date"
                    name="rps_screening_date"
                    defaultValue={selectedPerson.rps_screening_date || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Additional Screening Status
                  </label>
                  <select
                    name="additional_screening_status"
                    defaultValue={selectedPerson.additional_screening_status || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select status</option>
                    <option value="Not Needed">Not Needed</option>
                    <option value="Pending">Pending</option>
                    <option value="Complete">Complete</option>
                    <option value="Review Required">Review Required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Additional Screening Date
                  </label>
                  <input
                    type="date"
                    name="additional_screening_date"
                    defaultValue={selectedPerson.additional_screening_date || ""}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="text-sm font-semibold text-slate-900 mb-3">
                  Secure Machine Assignment
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Machine Name
                    </label>
                    <input
                      type="text"
                      name="secure_machine_name"
                      defaultValue={selectedPerson.secure_machine_name || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Asset Tag
                    </label>
                    <input
                      type="text"
                      name="secure_machine_asset_tag"
                      defaultValue={selectedPerson.secure_machine_asset_tag || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      name="secure_machine_serial"
                      defaultValue={selectedPerson.secure_machine_serial || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      name="secure_machine_location"
                      defaultValue={selectedPerson.secure_machine_location || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Verified On
                    </label>
                    <input
                      type="date"
                      name="secure_machine_verified_on"
                      defaultValue={selectedPerson.secure_machine_verified_on || ""}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Machine Status
                    </label>
                    <select
                      name="secure_machine_status"
                      defaultValue={selectedPerson.secure_machine_status || "Unassigned"}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="Unassigned">Unassigned</option>
                      <option value="Pending Verification">Pending Verification</option>
                      <option value="Verified">Verified</option>
                      <option value="Non-Compliant">Non-Compliant</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  Save Personnel Changes
                </button>

                <a
                  href="/personnel"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </a>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Individual Training Statuses
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    View and update individual training records for this person.
                  </p>
                </div>

                <form action={addStandardPersonnelTrainings}>
                  <input
                    type="hidden"
                    name="personnel_id"
                    value={selectedPerson.id}
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Add Standard Trainings
                  </button>
                </form>
              </div>

              {selectedPersonTrainings.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No personnel training records yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPersonTrainings.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">
                            {record.training_name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Date Completed: {formatDate(record.completed_on)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Certificate:{" "}
                            {record.certificate_file_name || "No certificate uploaded"}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                              record.status
                            )}`}
                          >
                            {record.status || "Not Started"}
                          </span>

                          <a
                            href={`/personnel?person=${selectedPerson.id}&trainingRecord=${record.id}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Edit Training
                          </a>

                          <form action={deletePersonnelTrainingRecord}>
                            <input
                              type="hidden"
                              name="training_record_id"
                              value={record.id}
                            />
                            <input
                              type="hidden"
                              name="personnel_id"
                              value={selectedPerson.id}
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Add Training Record
              </h2>
              <p className="text-sm text-slate-600 mt-1 mb-6">
                Add an individual training record for this person.
              </p>

              <form action={addPersonnelTrainingRecord} className="space-y-4">
                <input
                  type="hidden"
                  name="personnel_id"
                  value={selectedPerson.id}
                />

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
                    {STANDARD_PERSONNEL_TRAININGS.map((training) => (
                      <option key={training} value={training}>
                        {training}
                      </option>
                    ))}
                    <option value="Research Security Training">
                      Research Security Training
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
                Update the selected training record.
              </p>

              {!selectedTrainingRecord ? (
                <div className="text-sm text-slate-500">
                  Click “Edit Training” above to update an individual training record.
                </div>
              ) : (
                <div className="space-y-4">
                  <form action={updatePersonnelTrainingRecord} className="space-y-4">
                    <input
                      type="hidden"
                      name="training_record_id"
                      value={selectedTrainingRecord.id}
                    />
                    <input
                      type="hidden"
                      name="personnel_id"
                      value={selectedPerson.id}
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
                        {STANDARD_PERSONNEL_TRAININGS.map((training) => (
                          <option key={training} value={training}>
                            {training}
                          </option>
                        ))}
                        <option value="Research Security Training">
                          Research Security Training
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
                        href={`/personnel?person=${selectedPerson.id}`}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </a>
                    </div>
                  </form>

                  <form action={deletePersonnelTrainingRecord}>
                    <input
                      type="hidden"
                      name="training_record_id"
                      value={selectedTrainingRecord.id}
                    />
                    <input
                      type="hidden"
                      name="personnel_id"
                      value={selectedPerson.id}
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
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${selectedPerson ? "xl:col-span-3" : "xl:col-span-2"} bg-white rounded-2xl shadow-sm border border-slate-200 p-6`}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Personnel Registry</h2>
            <div className="text-sm text-slate-500">
              {totalPersonnel} record{totalPersonnel === 1 ? "" : "s"}
            </div>
          </div>

          {!personnel || personnel.length === 0 ? (
            <div className="text-sm text-slate-500">No personnel records yet.</div>
          ) : (
            <div className="space-y-4">
              {personnel.map((person) => {
                const projectName =
                  projects?.find((project) => project.id === person.project_id)
                    ?.project_name || "No project assigned";

                const personTrainings = trainingMap[String(person.id)] || [];
                const trainingRollup = getTrainingRollup(personTrainings);

                return (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-slate-200 overflow-hidden"
                  >
                    <div className="bg-white px-5 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-slate-900">
                            {displayName(person)}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">{person.role}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {projectName}
                            {person.citizenship ? ` • ${person.citizenship}` : ""}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 lg:items-end">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                              trainingRollup.overallStatus
                            )}`}
                          >
                            Training: {trainingRollup.overallStatus}
                          </span>

                          <div className="text-xs text-slate-500">
                            {trainingRollup.totalCount > 0
                              ? `${trainingRollup.completedCount}/${trainingRollup.totalCount} Complete`
                              : "No trainings assigned"}
                          </div>

                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                              person.rps_screening_status
                            )}`}
                          >
                            RPS: {person.rps_screening_status || "Not Started"}
                          </span>

                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                              person.secure_machine_status
                            )}`}
                          >
                            Machine: {person.secure_machine_status || "Unassigned"}
                          </span>

                          <a
                            href={`/personnel?person=${person.id}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Edit Personnel Record
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Citizenship Review
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {person.citizenship || "—"}
                          </div>
                          <div className="mt-1 text-slate-500">
                            Status: {person.citizenship_status || "—"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            RPS Screening
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {person.rps_screening_status || "Not Started"}
                          </div>
                          <div className="mt-1 text-slate-500">
                            Date: {formatDate(person.rps_screening_date)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Additional Screening
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {person.additional_screening_status || "—"}
                          </div>
                          <div className="mt-1 text-slate-500">
                            Date: {formatDate(person.additional_screening_date)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Secure Machine
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {person.secure_machine_name || "Not assigned"}
                          </div>
                          <div className="mt-1 text-slate-500">
                            {person.secure_machine_asset_tag || "—"} •{" "}
                            {person.secure_machine_status || "Unassigned"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!selectedPerson ? (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900">Add Personnel</h2>
              <p className="text-sm text-slate-600 mt-1 mb-6">
                Add personnel and track screening and machine details.
              </p>

              <form action={createPersonnelRecord} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Full Name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    name="role"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Role"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Project
                  </label>
                  <select
                    name="project_id"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select project</option>
                    {(projects || []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Citizenship
                  </label>
                  <input
                    type="text"
                    name="citizenship"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Citizenship"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Citizenship Status
                  </label>
                  <select
                    name="citizenship_status"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select status</option>
                    <option value="Verified">Verified</option>
                    <option value="Review Required">Review Required</option>
                    <option value="Restricted">Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    RPS Screening Status
                  </label>
                  <select
                    name="rps_screening_status"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select status</option>
                    <option value="Not Started">Not Started</option>
                    <option value="Pending">Pending</option>
                    <option value="Cleared">Cleared</option>
                    <option value="Review Required">Review Required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    RPS Screening Date
                  </label>
                  <input
                    type="date"
                    name="rps_screening_date"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Personnel Status
                  </label>
                  <select
                    name="personnel_status"
                    defaultValue="Active"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Restricted">Restricted</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="text-sm font-semibold text-slate-900 mb-3">
                    Secure Machine Assignment
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Machine Name
                      </label>
                      <input
                        type="text"
                        name="secure_machine_name"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="Research-Laptop-01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Asset Tag
                      </label>
                      <input
                        type="text"
                        name="secure_machine_asset_tag"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="FT-SEC-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        name="secure_machine_serial"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="Serial Number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        name="secure_machine_location"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="FTRI Lab / Office / Enclave"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Verified On
                      </label>
                      <input
                        type="date"
                        name="secure_machine_verified_on"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Machine Status
                      </label>
                      <select
                        name="secure_machine_status"
                        defaultValue="Unassigned"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="Unassigned">Unassigned</option>
                        <option value="Pending Verification">Pending Verification</option>
                        <option value="Verified">Verified</option>
                        <option value="Non-Compliant">Non-Compliant</option>
                        <option value="Retired">Retired</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  Add Personnel Record
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}