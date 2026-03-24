import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ReadinessCircle from "@/components/readiness-circle";
import UserMenu from "@/components/user-menu";

export default async function DashboardPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, contact_title")
    .eq("id", user.id)
    .single();

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const { data: personnel } = await supabase
    .from("personnel")
    .select("*")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const totalProjects = projects?.length || 0;
  const totalArtifacts = artifacts?.length || 0;
  const totalPersonnel = personnel?.length || 0;

  const completedArtifacts =
    artifacts?.filter(
      (a: any) => a.status === "Approved" || a.status === "Signed"
    ).length || 0;

  const pendingArtifacts = totalArtifacts - completedArtifacts;

  const overallReadiness =
    totalArtifacts > 0
      ? Math.round((completedArtifacts / totalArtifacts) * 100)
      : 0;

  const pendingTraining =
    personnel?.filter((p: any) => !p.training_complete).length || 0;

  const readinessByProject = new Map<number, number>();

  for (const project of projects || []) {
    const projectArtifacts =
      artifacts?.filter((a: any) => a.project_id === project.id) || [];

    const total = projectArtifacts.length;
    const complete = projectArtifacts.filter(
      (a: any) => a.status === "Approved" || a.status === "Signed"
    ).length;

    const readiness = total > 0 ? Math.round((complete / total) * 100) : 0;
    readinessByProject.set(project.id, readiness);
  }

  const topProjects = (projects || []).slice(0, 5);
  const topPersonnel = (personnel || []).slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-1">
            Welcome to RCOS
          </h1>
          <p className="text-slate-500 text-lg">
            Research Compliance Oversight System
          </p>
        </div>

        <UserMenu
          userId={user.id}
          fullName={profile?.full_name || "User"}
          email={profile?.email || user.email || ""}
          organizationName={organization?.name || "No Organization"}
          phone={profile?.phone || ""}
          contactTitle={profile?.contact_title || ""}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
          <div>
            <div className="text-slate-500 text-sm font-medium">
              Active Projects
            </div>
            <div className="text-4xl font-bold text-slate-800 mt-2">
              {totalProjects}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-500" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
          <div>
            <div className="text-slate-500 text-sm font-medium">
              Pending Authorizations
            </div>
            <div className="text-4xl font-bold text-slate-800 mt-2">
              {pendingTraining}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-500" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
          <div>
            <div className="text-slate-500 text-sm font-medium">
              Missing Artifacts
            </div>
            <div className="text-4xl font-bold text-slate-800 mt-2">
              {pendingArtifacts}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-500" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-5">
          <ReadinessCircle percentage={overallReadiness} />
          <div>
            <div className="text-slate-500 text-sm font-medium">
              Compliance Readiness
            </div>
            <div className="text-2xl font-bold text-blue-700 mt-1">
              {overallReadiness}%
            </div>
            <div className="text-slate-500 text-sm mt-1">
              {completedArtifacts} of {totalArtifacts} artifacts complete
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">
              Project Overview
            </h2>
            <Link
              href="/projects"
              className="text-blue-600 font-medium text-sm hover:underline"
            >
              View All Projects
            </Link>
          </div>

          <table className="w-full text-sm text-left border-t border-slate-200">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Sponsor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Readiness</th>
              </tr>
            </thead>

            <tbody>
              {topProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-slate-500">
                    No projects found.
                  </td>
                </tr>
              ) : (
                topProjects.map((project: any) => {
                  const readiness = readinessByProject.get(project.id) || 0;

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
                        <div className="space-y-1">
                          <div className="font-semibold">{readiness}%</div>
                          <div className="w-28 bg-slate-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${readiness}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">
              Compliance Alerts
            </h2>
            <span className="text-blue-600 font-medium text-sm">
              View All Alerts
            </span>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-red-500"></div>
              <div className="text-slate-700 text-sm">
                {pendingArtifacts} artifact{pendingArtifacts === 1 ? "" : "s"} pending approval or signature
              </div>
            </div>

            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-red-500"></div>
              <div className="text-slate-700 text-sm">
                {pendingTraining} personnel record{pendingTraining === 1 ? "" : "s"} need training completion
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-2 rounded-full bg-red-500"></div>
              <div className="text-slate-700 text-sm">
                Overall readiness is {overallReadiness}% across {totalProjects} project{totalProjects === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">
              Personnel Status
            </h2>
            <Link
              href="/personnel"
              className="text-blue-600 font-medium text-sm hover:underline"
            >
              Manage Personnel
            </Link>
          </div>

          <table className="w-full text-sm text-left border-t border-slate-200">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Training</th>
              </tr>
            </thead>

            <tbody>
              {topPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-slate-500">
                    No personnel found.
                  </td>
                </tr>
              ) : (
                topPersonnel.map((person: any) => (
                  <tr key={person.id} className="border-b hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {person.name}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {person.role}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
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
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">
              Readiness Summary
            </h2>
            <span className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
              View Event Log
            </span>
          </div>

          <div className="px-6 py-4 space-y-4 text-slate-700">
            <div className="border-b border-slate-200 pb-3">
              <div className="font-medium text-slate-800">Projects</div>
              <div>{totalProjects} active project records</div>
            </div>

            <div className="border-b border-slate-200 pb-3">
              <div className="font-medium text-slate-800">Artifacts</div>
              <div>
                {completedArtifacts} complete / {totalArtifacts} total
              </div>
            </div>

            <div className="border-b border-slate-200 pb-3">
              <div className="font-medium text-slate-800">Personnel</div>
              <div>{totalPersonnel} assigned personnel records</div>
            </div>

            <div>
              <div className="font-medium text-slate-800">
                Organization Readiness
              </div>
              <div>{overallReadiness}% complete</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}