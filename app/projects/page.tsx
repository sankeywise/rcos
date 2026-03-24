import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function ProjectsPage() {
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

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("id", { ascending: true });

  const { data: artifacts, error: artifactsError } = await supabase
    .from("artifacts")
    .select("id, project_id, status")
    .eq("organization_id", membership.organization_id);

  if (projectsError) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-800">Projects</h1>
        <p className="text-red-600 mt-2">
          Error loading projects: {projectsError.message}
        </p>
      </div>
    );
  }

  if (artifactsError) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-800">Projects</h1>
        <p className="text-red-600 mt-2">
          Error loading artifacts: {artifactsError.message}
        </p>
      </div>
    );
  }

  const readinessByProject = new Map<
    number,
    { totalArtifacts: number; completedArtifacts: number; readiness: number }
  >();

  for (const project of projects || []) {
    const projectArtifacts =
      artifacts?.filter((artifact: any) => artifact.project_id === project.id) ||
      [];

    const totalArtifacts = projectArtifacts.length;

    const completedArtifacts = projectArtifacts.filter(
      (artifact: any) =>
        artifact.status === "Approved" || artifact.status === "Signed"
    ).length;

    const readiness =
      totalArtifacts > 0
        ? Math.round((completedArtifacts / totalArtifacts) * 100)
        : 0;

    readinessByProject.set(project.id, {
      totalArtifacts,
      completedArtifacts,
      readiness,
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-1">Projects</h1>
          <p className="text-slate-500 text-lg">
            Manage CUI and controlled research projects
          </p>
        </div>

        <Link
          href="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + New Project
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left border-t border-slate-200">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Sponsor</th>
              <th className="px-4 py-3">Classification</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Environment</th>
              <th className="px-4 py-3">Readiness</th>
            </tr>
          </thead>

          <tbody>
            {projects?.length ? (
              projects.map((project: any) => {
                const readinessData = readinessByProject.get(project.id) || {
                  totalArtifacts: 0,
                  completedArtifacts: 0,
                  readiness: 0,
                };

                return (
                  <tr
                    key={project.id}
                    className="border-b hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {project.sponsor}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {project.classification}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {project.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {project.environment}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {readinessData.readiness}%
                        </div>
                        <div className="w-28 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${readinessData.readiness}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-500">
                          {readinessData.completedArtifacts} of{" "}
                          {readinessData.totalArtifacts} complete
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}