import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function statusBadgeClass(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (["approved", "complete", "completed", "signed"].includes(normalized)) {
    return "bg-green-100 text-green-700";
  }

  if (["pending", "in review"].includes(normalized)) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (["rejected", "expired"].includes(normalized)) {
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

export default async function DocumentsPage() {
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
    return <div className="p-6">No organization found.</div>;
  }

  const orgId = membership.organization_id;

  const { data: documents, error } = await supabase
    .from("artifacts")
    .select(`
      id,
      title,
      artifact_type,
      status,
      created_at,
      project_id,
      file_path
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("organization_id", orgId);

  const projectMap = new Map<string, string>();
  (projects || []).forEach((project) => {
    projectMap.set(String(project.id), project.name);
  });

  const totalDocuments = documents?.length || 0;
  const completeDocuments =
    documents?.filter((doc) => {
      const normalized = String(doc.status || "").toLowerCase();
      return ["approved", "complete", "completed", "signed"].includes(
        normalized
      );
    }).length || 0;

  const pendingDocuments =
    documents?.filter((doc) => {
      const normalized = String(doc.status || "").toLowerCase();
      return ["pending", "in review"].includes(normalized);
    }).length || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage compliance documents, approvals, and signatures
            </p>
          </div>

          <Link
            href="/artifacts/new"
            className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            Add Document
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <div className="text-sm text-slate-500">Total Documents</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalDocuments}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <div className="text-sm text-slate-500">Completed Documents</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {completeDocuments}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <div className="text-sm text-slate-500">Pending Review / Signature</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {pendingDocuments}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Document Registry
          </h2>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load documents.
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="text-sm text-slate-500">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Project</th>
                  <th className="py-3 pr-4">File</th>
                  <th className="py-3 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-900">
                        {doc.title}
                      </div>
                    </td>

                    <td className="py-4 pr-4 text-slate-700">
                      {doc.artifact_type || "—"}
                    </td>

                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(
                          doc.status
                        )}`}
                      >
                        {doc.status || "Pending"}
                      </span>
                    </td>

                    <td className="py-4 pr-4 text-slate-700">
                      {projectMap.get(String(doc.project_id)) || "—"}
                    </td>

                    <td className="py-4 pr-4 text-slate-700">
                      {doc.file_path ? "File Uploaded" : "No file"}
                    </td>

                    <td className="py-4 pr-4 text-slate-700">
                      {formatDate(doc.created_at)}
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