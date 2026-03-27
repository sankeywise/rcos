import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type ProjectRow = {
  id: number;
  organization_id: string;
  project_name: string | null;
  sponsor: string | null;
  status: string | null;
  classification: string | null;
  environment: string | null;
  export_control_type: string | null;
};

type ArtifactRow = {
  id: number;
  organization_id: string;
  project_id: number | null;
  title: string | null;
  artifact_type: string | null;
  status: string | null;
  created_at: string | null;
};

type PersonnelRow = {
  id: number;
  organization_id: string;
  project_id: number | null;
  name: string | null;
  full_name: string | null;
  role: string | null;
  training_complete: boolean | null;
  citizenship_status: string | null;
  additional_screening_status: string | null;
  additional_screening_date: string | null;
  rps_screening_status: string | null;
  rps_screening_date: string | null;
  personnel_status: string | null;
  secure_machine_name: string | null;
  secure_machine_asset_tag: string | null;
  secure_machine_status: string | null;
};

type ComplianceTeamRow = {
  id: string;
  organization_id: string;
  name: string | null;
  functional_role: string | null;
};

type ComplianceTeamTrainingRow = {
  id: number;
  compliance_team_id: string;
  training_name: string | null;
  status: string | null;
};

type CmmcProfileRow = {
  id: number;
  organization_id: string;
  enclave_name: string | null;
  cmmc_level_target: string | null;
  sprs_score: number | null;
  sprs_last_updated: string | null;
  assessment_status: string | null;
  ssp_status: string | null;
  poam_status: string | null;
  incident_response_status: string | null;
  access_control_status: string | null;
  audit_logging_status: string | null;
  media_protection_status: string | null;
  training_program_status: string | null;
  vendor_management_status: string | null;
  scoping_status: string | null;
  notes: string | null;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  return ["complete", "completed", "approved", "signed", "verified", "cleared"].includes(
    normalizeStatus(value)
  );
}

function getBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "approved" ||
    normalized === "signed" ||
    normalized === "verified" ||
    normalized === "cleared" ||
    normalized === "active"
  ) {
    return "bg-green-100 text-green-700";
  }

  if (
    normalized === "in progress" ||
    normalized === "pending" ||
    normalized === "draft" ||
    normalized === "review required"
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (
    normalized === "expired" ||
    normalized === "overdue" ||
    normalized === "non-compliant" ||
    normalized === "restricted"
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function displayPersonName(person: PersonnelRow) {
  return person.full_name || person.name || "Unnamed Person";
}

function getProjectReadiness(
  project: ProjectRow,
  docs: ArtifactRow[],
  personnel: PersonnelRow[]
) {
  const checks: boolean[] = [];

  const projectDocs = docs.filter((doc) => doc.project_id === project.id);
  const projectPersonnel = personnel.filter((person) => person.project_id === project.id);

  checks.push(projectDocs.length > 0);
  checks.push(projectDocs.length > 0 && projectDocs.every((doc) => isCompleteStatus(doc.status)));
  checks.push(
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) => !!person.secure_machine_name)
  );
  checks.push(
    projectPersonnel.length > 0 &&
      projectPersonnel.every(
        (person) => normalizeStatus(person.secure_machine_status) === "verified"
      )
  );
  checks.push(
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) => Boolean(person.training_complete))
  );
  checks.push(
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) =>
        ["verified", "approved", "cleared"].includes(
          normalizeStatus(person.citizenship_status)
        )
      )
  );
  checks.push(
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) =>
        ["cleared", "verified", "complete", "completed"].includes(
          normalizeStatus(person.rps_screening_status)
        )
      )
  );

  const completeCount = checks.filter(Boolean).length;
  const totalCount = checks.length;

  return {
    percent: formatPercent(completeCount, totalCount),
    totalCount,
    completeCount,
  };
}

export default async function DashboardPage() {
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

  const projectsResult = await supabase
    .from("projects")
    .select(`
      id,
      organization_id,
      project_name,
      sponsor,
      status,
      classification,
      environment,
      export_control_type
    `)
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const artifactsResult = await supabase
    .from("artifacts")
    .select(`
      id,
      organization_id,
      project_id,
      title,
      artifact_type,
      status,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const personnelResult = await supabase
    .from("personnel")
    .select(`
      id,
      organization_id,
      project_id,
      name,
      full_name,
      role,
      training_complete,
      citizenship_status,
      additional_screening_status,
      additional_screening_date,
      rps_screening_status,
      rps_screening_date,
      personnel_status,
      secure_machine_name,
      secure_machine_asset_tag,
      secure_machine_status
    `)
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const complianceTeamResult = await supabase
    .from("compliance_team")
    .select(`
      id,
      organization_id,
      name,
      functional_role
    `)
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const complianceTeamTrainingResult = await supabase
    .from("compliance_team_training_records")
    .select(`
      id,
      compliance_team_id,
      training_name,
      status
    `)
    .order("id", { ascending: true });

  const cmmcProfileResult = await supabase
    .from("cmmc_compliance_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const artifacts: ArtifactRow[] = (artifactsResult.data ?? []) as ArtifactRow[];
  const personnel: PersonnelRow[] = (personnelResult.data ?? []) as PersonnelRow[];
  const complianceTeam: ComplianceTeamRow[] = (complianceTeamResult.data ?? []) as ComplianceTeamRow[];
  const complianceTeamTraining: ComplianceTeamTrainingRow[] =
    (complianceTeamTrainingResult.data ?? []) as ComplianceTeamTrainingRow[];
  const cmmcProfile: CmmcProfileRow | null =
    (cmmcProfileResult.data as CmmcProfileRow | null) ?? null;

  const complianceTeamTrainingMap: Record<string, ComplianceTeamTrainingRow[]> = {};
  complianceTeamTraining.forEach((row) => {
    const key = String(row.compliance_team_id);
    if (!complianceTeamTrainingMap[key]) {
      complianceTeamTrainingMap[key] = [];
    }
    complianceTeamTrainingMap[key].push(row);
  });

  const incompleteItems: string[] = [];
  const alerts: string[] = [];

  const pendingProjectDocs = artifacts.filter((doc) => !isCompleteStatus(doc.status));
  pendingProjectDocs.forEach((doc) => {
    const projectName =
      projects.find((project) => project.id === doc.project_id)?.project_name ||
      "Unknown Project";
    incompleteItems.push(
      `Project document incomplete: ${doc.title || "Untitled"} (${projectName})`
    );
    alerts.push(`Document pending: ${doc.title || "Untitled"} (${projectName})`);
  });

  const personnelTrainingIncomplete = personnel.filter((person) => !person.training_complete);
  personnelTrainingIncomplete.forEach((person) => {
    const projectName =
      projects.find((project) => project.id === person.project_id)?.project_name ||
      "No Project";
    incompleteItems.push(
      `Personnel training incomplete: ${displayPersonName(person)} (${projectName})`
    );
    alerts.push(
      `Personnel training incomplete: ${displayPersonName(person)} (${projectName})`
    );
  });

  const personnelRpsIncomplete = personnel.filter(
    (person) =>
      !["cleared", "verified", "complete", "completed"].includes(
        normalizeStatus(person.rps_screening_status)
      )
  );
  personnelRpsIncomplete.forEach((person) => {
    incompleteItems.push(`RPS screening incomplete: ${displayPersonName(person)}`);
  });

  const personnelCitizenshipIncomplete = personnel.filter(
    (person) =>
      !["verified", "approved", "cleared"].includes(
        normalizeStatus(person.citizenship_status)
      )
  );
  personnelCitizenshipIncomplete.forEach((person) => {
    incompleteItems.push(
      `Citizenship verification incomplete: ${displayPersonName(person)}`
    );
  });

  const personnelSecureMachineIncomplete = personnel.filter(
    (person) =>
      !person.secure_machine_name ||
      normalizeStatus(person.secure_machine_status) !== "verified"
  );
  personnelSecureMachineIncomplete.forEach((person) => {
    incompleteItems.push(`Secure machine incomplete: ${displayPersonName(person)}`);
  });

  const incompleteComplianceTeamTraining = complianceTeam.filter((member) => {
    const records = complianceTeamTrainingMap[String(member.id)] || [];
    if (records.length === 0) return true;
    return !records.every((row) => isCompleteStatus(row.status));
  });

  incompleteComplianceTeamTraining.forEach((member) => {
    const records = complianceTeamTrainingMap[String(member.id)] || [];
    const incompleteNames = records
      .filter((row) => !isCompleteStatus(row.status))
      .map((row) => row.training_name)
      .filter(Boolean)
      .join(", ");

    incompleteItems.push(
      `Compliance team training incomplete: ${member.name || "Unnamed Member"}${
        incompleteNames ? ` - ${incompleteNames}` : ""
      }`
    );

    alerts.push(
      `Compliance training incomplete: ${member.name || "Unnamed Member"}${
        incompleteNames ? ` - ${incompleteNames}` : ""
      }`
    );
  });

  const controlCards = [
    { label: "SSP", status: cmmcProfile?.ssp_status || "Draft" },
    { label: "POA&M", status: cmmcProfile?.poam_status || "Draft" },
    { label: "Incident Response", status: cmmcProfile?.incident_response_status || "Draft" },
    { label: "Access Control", status: cmmcProfile?.access_control_status || "Draft" },
    { label: "Audit Logging", status: cmmcProfile?.audit_logging_status || "Draft" },
    { label: "Media Protection", status: cmmcProfile?.media_protection_status || "Draft" },
    { label: "Training Program", status: cmmcProfile?.training_program_status || "Draft" },
    { label: "Vendor Management", status: cmmcProfile?.vendor_management_status || "Draft" },
    { label: "Scoping", status: cmmcProfile?.scoping_status || "Draft" },
  ];

  controlCards
    .filter((card) => !isCompleteStatus(card.status))
    .forEach((card) => {
      incompleteItems.push(`${card.label} is still ${card.status}`);
    });

  const uniqueIncompleteItems = Array.from(new Set(incompleteItems));
  const uniqueAlerts = Array.from(new Set(alerts)).slice(0, 6);

  const readinessChecks = [
    { label: "Organization CMMC profile", complete: Boolean(cmmcProfile) },
    { label: "SPRS score entered", complete: typeof cmmcProfile?.sprs_score === "number" },
    { label: "Assessment status complete", complete: isCompleteStatus(cmmcProfile?.assessment_status) },
    { label: "SSP complete", complete: isCompleteStatus(cmmcProfile?.ssp_status) },
    { label: "POA&M complete", complete: isCompleteStatus(cmmcProfile?.poam_status) },
    { label: "Incident response complete", complete: isCompleteStatus(cmmcProfile?.incident_response_status) },
    { label: "Access control complete", complete: isCompleteStatus(cmmcProfile?.access_control_status) },
    { label: "Audit logging complete", complete: isCompleteStatus(cmmcProfile?.audit_logging_status) },
    { label: "Media protection complete", complete: isCompleteStatus(cmmcProfile?.media_protection_status) },
    { label: "Training program complete", complete: isCompleteStatus(cmmcProfile?.training_program_status) },
    { label: "Vendor management complete", complete: isCompleteStatus(cmmcProfile?.vendor_management_status) },
    { label: "Scoping complete", complete: isCompleteStatus(cmmcProfile?.scoping_status) },
    { label: "All project documents complete", complete: pendingProjectDocs.length === 0 && artifacts.length > 0 },
    { label: "All personnel training complete", complete: personnel.length > 0 && personnelTrainingIncomplete.length === 0 },
    { label: "All personnel RPS complete", complete: personnel.length > 0 && personnelRpsIncomplete.length === 0 },
    { label: "All citizenship verifications complete", complete: personnel.length > 0 && personnelCitizenshipIncomplete.length === 0 },
    { label: "All secure machines verified", complete: personnel.length > 0 && personnelSecureMachineIncomplete.length === 0 },
    { label: "Compliance team training complete", complete: complianceTeam.length > 0 && incompleteComplianceTeamTraining.length === 0 },
  ];

  const completedReadinessChecks = readinessChecks.filter((check) => check.complete).length;
  const readinessPercent = formatPercent(
    completedReadinessChecks,
    readinessChecks.length
  );

  const projectReadiness = projects.map((project) => ({
    ...project,
    readiness: getProjectReadiness(project, artifacts, personnel),
  }));

  const activeProjects = projects.filter(
    (project) => normalizeStatus(project.status) === "active"
  );

  const documentsCompleteCount = artifacts.filter((doc) => isCompleteStatus(doc.status)).length;
  const personnelTrainingCompleteCount = personnel.filter((person) => person.training_complete).length;

  const complianceTeamReadyCount = complianceTeam.filter((member) => {
    const records = complianceTeamTrainingMap[String(member.id)] || [];
    return records.length > 0 && records.every((row) => isCompleteStatus(row.status));
  }).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Welcome to RCOS</h1>
        <p className="text-slate-600 mt-1">Research Compliance Oversight System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Active Projects</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {activeProjects.length}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Pending Authorizations</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {
              projects.filter((project) =>
                ["pending", "in progress"].includes(normalizeStatus(project.status))
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Incomplete Items</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {uniqueIncompleteItems.length}
          </div>
          <div className="mt-3">
            <Link
              href="/cmmc-compliance"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View incomplete items
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm text-slate-500">Compliance Readiness</div>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-14 w-14 rounded-full border-4 border-slate-200 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(#2563eb ${readinessPercent}%, transparent ${readinessPercent}% 100%)`,
                  WebkitMask:
                    "radial-gradient(circle at center, transparent 58%, black 60%)",
                  mask: "radial-gradient(circle at center, transparent 58%, black 60%)",
                }}
              />
              <span className="relative text-xs font-semibold text-slate-900">
                {readinessPercent}%
              </span>
            </div>

            <div>
              <div className="text-3xl font-bold text-slate-900">
                {readinessPercent}%
              </div>
              <div className="text-sm text-slate-500">
                {completedReadinessChecks} of {readinessChecks.length} tracked status checks complete
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Project Overview</h2>
            <Link
              href="/projects"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Projects
            </Link>
          </div>

          {projectReadiness.length === 0 ? (
            <div className="text-sm text-slate-500">No project records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 text-left font-medium">Project</th>
                    <th className="py-3 pr-4 text-left font-medium">Sponsor</th>
                    <th className="py-3 pr-4 text-left font-medium">Status</th>
                    <th className="py-3 pr-4 text-left font-medium">Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {projectReadiness.slice(0, 5).map((project) => (
                    <tr key={project.id} className="border-b border-slate-100">
                      <td className="py-4 pr-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {project.project_name || "Untitled Project"}
                        </Link>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        {project.sponsor || "—"}
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            project.status
                          )}`}
                        >
                          {project.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${project.readiness.percent}%` }}
                            />
                          </div>
                          <span className="text-slate-700">
                            {project.readiness.percent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Alerts</h2>
            <Link
              href="/cmmc-compliance"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Alerts
            </Link>
          </div>

          {uniqueAlerts.length === 0 ? (
            <div className="text-sm text-slate-500">No active alerts.</div>
          ) : (
            <div className="space-y-4">
              {uniqueAlerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  <div className="text-sm text-slate-700">{alert}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Personnel & Training
            </h2>
            <Link
              href="/personnel"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Manage Personnel
            </Link>
          </div>

          {personnel.length === 0 ? (
            <div className="text-sm text-slate-500">No personnel records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 text-left font-medium">Name</th>
                    <th className="py-3 pr-4 text-left font-medium">Training</th>
                    <th className="py-3 pr-4 text-left font-medium">RPS</th>
                    <th className="py-3 pr-4 text-left font-medium">Machine</th>
                  </tr>
                </thead>
                <tbody>
                  {personnel.slice(0, 5).map((person) => (
                    <tr key={person.id} className="border-b border-slate-100">
                      <td className="py-4 pr-4 text-slate-900 font-medium">
                        {displayPersonName(person)}
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            person.training_complete
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {person.training_complete ? "Complete" : "Required"}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            person.rps_screening_status
                          )}`}
                        >
                          {person.rps_screening_status || "Not Started"}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            person.secure_machine_status
                          )}`}
                        >
                          {person.secure_machine_status || "Unassigned"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Readiness Summary</h2>
            <Link
              href="/cmmc-compliance"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              View Compliance Hub
            </Link>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Projects</div>
              <div className="text-right text-slate-900">
                <div>{activeProjects.length} active project records</div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Documents</div>
              <div className="text-right text-slate-900">
                <div>
                  {documentsCompleteCount} complete / {artifacts.length} total
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Personnel</div>
              <div className="text-right text-slate-900">
                <div>{personnel.length} assigned personnel records</div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Personnel Training</div>
              <div className="text-right text-slate-900">
                <div>
                  {personnelTrainingCompleteCount} complete / {personnel.length} total
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Compliance Team</div>
              <div className="text-right text-slate-900">
                <div>{complianceTeam.length} rostered members</div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Compliance Team Training</div>
              <div className="text-right text-slate-900">
                <div>
                  {complianceTeamReadyCount} ready / {complianceTeam.length} total
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">CMMC Program</div>
              <div className="text-right text-slate-900">
                <div>{cmmcProfile ? "Profile tracked" : "Profile not started"}</div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="text-slate-700 font-medium">Organization Readiness</div>
              <div className="text-right text-slate-900 font-semibold">
                <div>{readinessPercent}% complete</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}