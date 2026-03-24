import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import DeleteArtifactButton from "@/components/delete-artifact-button";

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
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-800">
          No Organization Access
        </h1>
        <p className="text-slate-600 mt-2">
          Your account is authenticated, but no active tenant membership was found.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, sponsor")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const { data: documents, error: documentsError } = await supabase
    .from("artifacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  if (projectsError || documentsError) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-800">Documents</h1>
        <p className="text-red-600 mt-2">Error loading document data.</p>
      </div>
    );
  }

  const documentsWithUrls = await Promise.all(
    (documents || []).map(async (document: any) => {
      if (!document.file_path) {
        return { ...document, signedUrl: null };
      }

      const { data, error } = await supabase.storage
        .from("artifacts")
        .createSignedUrl(document.file_path, 60 * 10);

      return {
        ...document,
        signedUrl: error ? null : data?.signedUrl ?? null,
      };
    })
  );

  const documentsByProject = new Map<number, any[]>();

  for (const project of projects || []) {
    documentsByProject.set(project.id, []);
  }

  for (const document of documentsWithUrls) {
    const existing = documentsByProject.get(document.project_id) || [];
    existing.push(document);
    documentsByProject.set(document.project_id, existing);
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-1">Documents</h1>
          <p className="text-slate-500 text-lg">
            Compliance documents grouped by project
          </p>
        </div>
      </div>

      {(projects || []).length === 0 ? (
        <div className="text-slate-500">No projects found.</div>
      ) : (
        (projects || []).map((project: any) => {
          const projectDocuments = documentsByProject.get(project.id) || [];

          return (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    {project.name}
                  </h2>
                  <p className="text-sm text-slate-500">{project.sponsor}</p>
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  View Project
                </Link>
              </div>

              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left w-[25%]">Title</th>
                    <th className="px-4 py-3 text-left w-[20%]">Document Type</th>
                    <th className="px-4 py-3 text-left w-[15%]">Status</th>
                    <th className="px-4 py-3 text-left w-[25%]">File</th>
                    <th className="px-4 py-3 text-left w-[15%]">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {projectDocuments.length ? (
                    projectDocuments.map((document: any) => (
                      <tr
                        key={document.id}
                        className="border-b hover:bg-slate-50 transition"
                      >
                        <td className="px-4 py-3 text-slate-800">
                          {document.title}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {document.artifact_type}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              document.status === "Approved"
                                ? "bg-green-100 text-green-700"
                                : document.status === "Signed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {document.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {document.signedUrl ? (
                            <a
                              href={document.signedUrl}
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
                            artifactId={document.id}
                            filePath={document.file_path}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-slate-500">
                        No documents found for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}