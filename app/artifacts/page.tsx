import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

export default async function ArtifactsPage() {
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

  const orgId = membership.organization_id;

  const { data: artifacts, error } = await supabase
    .from("artifacts")
    .select(`
      id,
      title,
      artifact_type,
      status,
      file_path,
      project_id,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6 text-red-600">Failed to load documents.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-700 mt-1">
            Manage compliance artifacts for this organization
          </p>
        </div>

        <Link
          href="/artifacts/new"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Add Document
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-slate-500 border-b">
              <tr>
                <th className="py-3 pr-4">Title</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Project ID</th>
                <th className="py-3 pr-4">File</th>
              </tr>
            </thead>
            <tbody>
              {!artifacts || artifacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
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
                      {artifact.project_id}
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
    </div>
  );
}