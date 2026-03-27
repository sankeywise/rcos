import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type ProjectDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function trainingLabel(trainingComplete?: boolean | null) {
  return trainingComplete ? "Complete" : "Required";
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const resolvedParams = await params;
  const projectId = Number(resolvedParams.id);

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
    return <div className="p-6 text-red-600">No organization access found.</div>;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      id,
      organization_id,
      project_name,
      sponsor,
      status,
      environment,
      classification,
      export_control_type,
      pop_start_date,
      pop_end_date
    `)
    .eq("id", projectId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (projectError || !project) {
    return <div className="p-6 text-red-600">Project not found.</div>;
  }

  const { data: personnel } = await supabase
    .from("personnel")
    .select(`
      id,
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
      secure_machine_status
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: documents } = await supabase
    .from("artifacts")
    .select(`
      id,
      title,
      artifact_type,
      status,
      created_at,
      file_path
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const incompletePersonnelMachineCount =
    personnel?.filter(
      (person) =>
        !person.secure_machine_name ||
        String(person.secure_machine_status || "").toLowerCase() !== "verified"
    ).length || 0;

  const incompleteTrainingCount =
    personnel?.filter((person) => !person.training_complete).length || 0;

  const incompleteRpsCount =
    personnel?.filter(
      (person) =>
        !person.rps_screening_status ||
        !["cleared", "verified", "complete", "completed"].includes(
          String(person.rps_screening_status || "").toLowerCase()
        )
    ).length || 0;

  const incompleteCitizenshipCount =
    personnel?.filter(
      (person) =>
        !person.citizenship_status ||
        !["verified", "cleared", "approved"].includes(
          String(person.citizenship_status || "").toLowerCase()
        )
    ).length || 0;

  const incompleteDocumentCount =
    documents?.filter(
      (doc) =>
        !["complete", "completed", "approved", "signed"].includes(
          String(doc.status || "").toLowerCase()
        )
    ).length || 0;

  const incompleteItems = [
    ...(incompletePersonnelMachineCount > 0
      ? [
          `${incompletePersonnelMachineCount} personnel record(s) missing verified secure machine assignment`,
        ]
      : []),
    ...(incompleteTrainingCount > 0
      ? [`${incompleteTrainingCount} personnel record(s) missing completed training`]
      : []),
    ...(incompleteRpsCount > 0
      ? [`${incompleteRpsCount} personnel record(s) missing completed RPS review`]
      : []),
    ...(incompleteCitizenshipCount > 0
      ? [`${incompleteCitizenshipCount} personnel record(s) missing citizenship verification`]
      : []),
    ...(incompleteDocumentCount > 0
      ? [`${incompleteDocumentCount} project document(s) still incomplete or pending`]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/projects"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Projects
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {project.project_name}
          </h1>
          <p className="mt-1 text-slate-600">
            Sponsor: {project.sponsor || "—"} • Status: {project.status || "—"}
          </p>
        </div>

        <Link
          href={`/projects/${project.id}/edit`}
          className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Edit Project
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Classification</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {project.classification || "—"}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Environment</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {project.environment || "—"}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Export Control Type</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {project.export_control_type || "—"}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Incomplete Items</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {incompleteItems.length}
          </div>
        </div>
      </div>

      {incompleteItems.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Incomplete Items</h2>
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
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Project Details</h2>

          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                PoP Start Date
              </div>
              <div className="mt-1 font-medium text-slate-900">
                {formatDate(project.pop_start_date)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                PoP End Date
              </div>
              <div className="mt-1 font-medium text-slate-900">
                {formatDate(project.pop_end_date)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Project Documents
            </h2>
            <Link
              href={`/artifacts/new?project=${project.id}`}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Add Document
            </Link>
          </div>

          {!documents || documents.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">
              No project documents uploaded yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        {doc.title || "Untitled"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {doc.artifact_type || "Document"} • {formatDate(doc.created_at)}
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
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Project Personnel</h2>
          <Link
            href="/personnel"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage Personnel
          </Link>
        </div>

        {!personnel || personnel.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">
            No personnel assigned to this project yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 text-left font-medium">Name</th>
                  <th className="py-3 pr-4 text-left font-medium">Role</th>
                  <th className="py-3 pr-4 text-left font-medium">Citizenship</th>
                  <th className="py-3 pr-4 text-left font-medium">Training</th>
                  <th className="py-3 pr-4 text-left font-medium">RPS</th>
                  <th className="py-3 pr-4 text-left font-medium">Additional Screening</th>
                  <th className="py-3 pr-4 text-left font-medium">Personnel Status</th>
                  <th className="py-3 pr-4 text-left font-medium">Secure Machine</th>
                  <th className="py-3 pr-4 text-left font-medium">Machine Status</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map((person) => (
                  <tr key={person.id} className="border-b border-slate-100 align-top">
                    <td className="py-4 pr-4 font-medium text-slate-900">
                      {displayName(person)}
                    </td>

                    <td className="py-4 pr-4 text-slate-700">{person.role || "—"}</td>

                    <td className="py-4 pr-4 text-slate-700">
                      <div>{person.citizenship || "—"}</div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            person.citizenship_status
                          )}`}
                        >
                          {person.citizenship_status || "Not Reviewed"}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          trainingLabel(person.training_complete)
                        )}`}
                      >
                        {trainingLabel(person.training_complete)}
                      </span>
                    </td>

                    <td className="py-4 pr-4">
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            person.rps_screening_status
                          )}`}
                        >
                          {person.rps_screening_status || "Not Started"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(person.rps_screening_date)}
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            person.additional_screening_status
                          )}`}
                        >
                          {person.additional_screening_status || "—"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(person.additional_screening_date)}
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          person.personnel_status
                        )}`}
                      >
                        {person.personnel_status || "—"}
                      </span>
                    </td>

                    <td className="py-4 pr-4 text-slate-700">
                      <div>{person.secure_machine_name || "Not assigned"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {person.secure_machine_asset_tag || "—"}
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            person.secure_machine_status
                          )}`}
                        >
                          {person.secure_machine_status || "Unassigned"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(person.secure_machine_verified_on)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}