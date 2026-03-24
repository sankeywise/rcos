import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function formatClassificationType(value?: string | null) {
  if (!value) return "Not Set";

  const normalized = value.toLowerCase();

  if (normalized === "cui") return "CUI";
  if (normalized === "itar_cui") return "ITAR Export Controlled + CUI";
  if (normalized === "ear_cui") return "EAR Export Controlled + CUI";
  if (normalized === "itar") return "ITAR Export Controlled";
  if (normalized === "ear") return "EAR Export Controlled";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadge(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "active") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
        Active
      </span>
    );
  }

  if (normalized === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
        Pending
      </span>
    );
  }

  if (normalized === "closed") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
        Closed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
      {status || "Unknown"}
    </span>
  );
}

function artifactStatusBadge(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (["approved", "signed", "complete", "completed"].includes(normalized)) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
        {status || "Approved"}
      </span>
    );
  }

  if (normalized === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
        Pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
      {status || "Unknown"}
    </span>
  );
}

function trainingBadge(trainingComplete?: boolean | null) {
  if (trainingComplete) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
        Complete
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
      Required
    </span>
  );
}

export default async function ProjectDetailPage({
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

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (membershipError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Membership Error</h1>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-red-600">
          {JSON.stringify(membershipError, null, 2)}
        </pre>
      </div>
    );
  }

  if (!membership) {
    redirect("/");
  }

  const orgId = membership.organization_id;
  const projectId = Number(resolvedParams?.id);

  if (Number.isNaN(projectId)) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Invalid Project ID</h1>
        <p className="mt-2 text-slate-700">
          URL param was: {String(resolvedParams?.id || "")}
        </p>
      </div>
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      sponsor,
      status,
      created_at,
      classification,
      classification_type,
      environment,
      pop_start_date,
      pop_end_date,
      organization_id
    `)
    .eq("id", projectId)
    .eq("organization_id", orgId)
    .single();

  if (projectError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Project Query Error</h1>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-red-600">
          {JSON.stringify(projectError, null, 2)}
        </pre>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Project Not Found</h1>
      </div>
    );
  }

  const { data: artifacts, error: artifactsError } = await supabase
    .from("artifacts")
    .select(`
      id,
      title,
      artifact_type,
      status,
      file_path,
      uploaded_by_user_id,
      created_at
    `)
    .eq("project_id", projectId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (artifactsError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Artifacts Query Error</h1>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-red-600">
          {JSON.stringify(artifactsError, null, 2)}
        </pre>
      </div>
    );
  }

  const { data: personnel, error: personnelError } = await supabase
    .from("personnel")
    .select(`
      id,
      name,
      role,
      citizenship,
      citizenship_status,
      training_complete
    `)
    .eq("project_id", projectId)
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (personnelError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Personnel Query Error</h1>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-red-600">
          {JSON.stringify(personnelError, null, 2)}
        </pre>
      </div>
    );
  }

  const totalArtifacts = artifacts?.length || 0;
  const completedArtifacts =
    artifacts?.filter((artifact) =>
      ["approved", "signed", "complete", "completed"].includes(
        (artifact.status || "").toLowerCase()
      )
    ).length || 0;

  const readiness =
    totalArtifacts > 0
      ? Math.round((completedArtifacts / totalArtifacts) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <Link
          href="/projects"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to Projects
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {project.name}
            </h1>
            <p className="text-slate-500 mt-1">
              {project.sponsor || "No Sponsor"} ·{" "}
              {project.classification || "No Classification"}
            </p>
          </div>

          <div>{statusBadge(project.status)}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/projects/${project.id}/edit`}
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Edit Project Details
          </Link>

          <Link
            href={`/artifacts/new?projectId=${project.id}`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            Add Document
          </Link>

          <Link
            href={`/personnel/new?projectId=${project.id}`}
            className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 transition"
          >
            Add Personnel
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Documents</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalArtifacts}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Completed</div>
          <div className="mt-2 text-3xl font-bold text-green-700">
            {completedArtifacts}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Readiness</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {readiness}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Project Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-sm">
          <div>
            <div className="text-slate-500 mb-1">Sponsor</div>
            <div className="text-slate-800 font-medium">
              {project.sponsor || "—"}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Environment</div>
            <div className="text-slate-800 font-medium">
              {project.environment || "—"}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Classification</div>
            <div className="text-slate-800 font-medium">
              {project.classification || "—"}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">
              Export Control / Classification Type
            </div>
            <div className="text-slate-800 font-medium">
              {formatClassificationType(project.classification_type)}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">PoP Start</div>
            <div className="text-slate-800 font-medium">
              {formatDate(project.pop_start_date)}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">PoP Anticipated End</div>
            <div className="text-slate-800 font-medium">
              {formatDate(project.pop_end_date)}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Created</div>
            <div className="text-slate-800 font-medium">
              {formatDate(project.created_at)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Documents
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-slate-500 border-b">
              <tr>
                <th className="py-3 pr-4">Title</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">File</th>
              </tr>
            </thead>
            <tbody>
              {!artifacts || artifacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No documents found.
                  </td>
                </tr>
              ) : (
                artifacts.map((artifact) => (
                  <tr key={artifact.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-4 text-slate-800">
                      {artifact.title}
                    </td>
                    <td className="py-4 pr-4 text-slate-700">
                      {artifact.artifact_type || "—"}
                    </td>
                    <td className="py-4 pr-4">
                      {artifactStatusBadge(artifact.status)}
                    </td>
                    <td className="py-4 pr-4 text-slate-700">
                      {artifact.file_path ? "File Uploaded" : "No file"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Personnel
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-slate-500 border-b">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Citizenship</th>
                <th className="py-3 pr-4">Training</th>
              </tr>
            </thead>
            <tbody>
              {!personnel || personnel.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No personnel assigned.
                  </td>
                </tr>
              ) : (
                personnel.map((person: any) => (
                  <tr key={person.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-4 text-slate-800 font-medium">
                      {person.name}
                    </td>
                    <td className="py-4 pr-4 text-slate-700">
                      {person.role}
                    </td>
                    <td className="py-4 pr-4 text-slate-700">
                      {person.citizenship_status || person.citizenship || "—"}
                    </td>
                    <td className="py-4 pr-4">
                      {trainingBadge(person.training_complete)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}