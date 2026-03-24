import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import UploadArtifactForm from "@/components/upload-artifact-form";
import DeleteArtifactButton from "@/components/delete-artifact-button";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-800">
          No Organization Access
        </h1>
        <p className="text-slate-600 mt-2">
          You do not have access to this organization.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", Number(id))
    .eq("organization_id", orgId)
    .single();

  if (!project) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-800">Project not found</h1>
      </div>
    );
  }

  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", project.id)
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const { data: personnel } = await supabase
    .from("personnel")
    .select("*")
    .eq("project_id", project.id)
    .eq("organization_id", orgId);

  const artifactsWithUrls = await Promise.all(
    (artifacts || []).map(async (artifact: any) => {
      if (!artifact.file_path) {
        return { ...artifact, signedUrl: null };
      }

      const { data, error } = await supabase.storage
        .from("artifacts")
        .createSignedUrl(artifact.file_path, 60 * 10);

      return {
        ...artifact,
        signedUrl: error ? null : data?.signedUrl ?? null,
      };
    })
  );

  const totalArtifacts = artifactsWithUrls.length;

  const completedArtifacts =
    artifactsWithUrls.filter(
      (a: any) => a.status === "Approved" || a.status === "Signed"
    ).length || 0;

  const readiness =
    totalArtifacts > 0
      ? Math.round((completedArtifacts / totalArtifacts) * 100)
      : 0;

  return (
    <div className="space-y-8 w-full">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 flex justify-between items-center">
        <div>
          <div className="mb-2">
            <Link
              href="/projects"
              className="text-blue-600 hover:underline text-sm"
            >
              ← Back to Projects
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-slate-800">{project.name}</h1>
          <p className="text-slate-500 mt-1">
            {project.sponsor} • {project.classification}
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            project.status === "Active"
              ? "bg-green-100 text-green-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          {project.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-slate-500 text-sm">Documents</div>
          <div className="text-3xl font-bold text-slate-800 mt-2">
            {totalArtifacts}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-slate-500 text-sm">Completed</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {completedArtifacts}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-slate-500 text-sm">Readiness</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {readiness}%
          </div>
        </div>
      </div>

      <UploadArtifactForm organizationId={orgId} projectId={project.id} />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Documents</h2>
        </div>

        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-[25%]">Title</th>
              <th className="px-4 py-3 text-left w-[20%]">Type</th>
              <th className="px-4 py-3 text-left w-[15%]">Status</th>
              <th className="px-4 py-3 text-left w-[25%]">File</th>
              <th className="px-4 py-3 text-left w-[15%]">Action</th>
            </tr>
          </thead>

          <tbody>
            {artifactsWithUrls.length ? (
              artifactsWithUrls.map((artifact: any) => (
                <tr key={artifact.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">
                    {artifact.title}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {artifact.artifact_type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        artifact.status === "Approved"
                          ? "bg-green-100 text-green-700"
                          : artifact.status === "Signed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {artifact.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {artifact.signedUrl ? (
                      <a
                        href={artifact.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View File
                      </a>
                    ) : (
                      <span className="text-slate-400">No file</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteArtifactButton
                      artifactId={artifact.id}
                      filePath={artifact.file_path}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  No documents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Personnel</h2>
        </div>

        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-1/3">Name</th>
              <th className="px-4 py-3 text-left w-1/3">Role</th>
              <th className="px-4 py-3 text-left w-1/3">Training</th>
            </tr>
          </thead>

          <tbody>
            {personnel?.length ? (
              personnel.map((person: any) => (
                <tr key={person.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{person.name}</td>
                  <td className="px-4 py-3 text-slate-800">{person.role}</td>
                  <td className="px-4 py-3">
                    {person.training_complete ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                        Complete
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
                        Required
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-slate-500">
                  No personnel assigned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}