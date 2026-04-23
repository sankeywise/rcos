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

type CriticalAction = {
  label: string;
  action: string;
  href: string;
  severity: "Critical" | "High" | "Medium";
};

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  return [
    "complete",
    "completed",
    "approved",
    "signed",
    "verified",
    "cleared",
    "active",
    "audit ready",
  ].includes(normalizeStatus(value));
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
    normalized === "active" ||
    normalized === "audit ready"
  ) {
    return "bg-green-100 text-green-700";
  }

  if (
    normalized === "in progress" ||
    normalized === "pending" ||
    normalized === "draft" ||
    normalized === "review required" ||
    normalized === "partial"
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (
    normalized === "expired" ||
    normalized === "overdue" ||
    normalized === "non-compliant" ||
    normalized === "restricted" ||
    normalized === "missing"
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

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function getProjectReadiness(
  project: ProjectRow,
  docs: ArtifactRow[],
  personnel: PersonnelRow[]
) {
  const projectDocs = docs.filter((doc) => doc.project_id === project.id);
  const projectPersonnel = personnel.filter((person) => person.project_id === project.id);

  const checks: boolean[] = [
    projectDocs.length > 0,
    projectDocs.length > 0 && projectDocs.every((doc) => isCompleteStatus(doc.status)),
    projectPersonnel.length > 0,
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) => Boolean(person.training_complete)),
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) =>
        ["verified", "approved", "cleared"].includes(
          normalizeStatus(person.citizenship_status)
        )
      ),
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) =>
        ["cleared", "verified", "complete", "completed"].includes(
          normalizeStatus(person.rps_screening_status)
        )
      ),
    projectPersonnel.length > 0 &&
      projectPersonnel.every((person) => !!person.secure_machine_name),
    projectPersonnel.length > 0 &&
      projectPersonnel.every(
        (person) => normalizeStatus(person.secure_machine_status) === "verified"
      ),
  ];

  const completeCount = checks.filter(Boolean).length;
  const totalCount = checks.length;

  return {
    percent: formatPercent(completeCount, totalCount),
    completeCount,
    totalCount,
  };
}

function getEvidenceStatus(doc: ArtifactRow) {
  if (!doc.status) return "Missing";

  if (isCompleteStatus(doc.status)) return "Complete";

  return "Partial";
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
  const complianceTeam: ComplianceTeamRow[] =
    (complianceTeamResult.data ?? []) as ComplianceTeamRow[];
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

  const pendingProjectDocs = artifacts.filter((doc) => !isCompleteStatus(doc.status));

  const personnelTrainingIncomplete = personnel.filter((person) => !person.training_complete);

  const personnelRpsIncomplete = personnel.filter(
    (person) =>
      !["cleared", "verified", "complete", "completed"].includes(
        normalizeStatus(person.rps_screening_status)
      )
  );

  const personnelCitizenshipIncomplete = personnel.filter(
    (person) =>
      !["verified", "approved", "cleared"].includes(
        normalizeStatus(person.citizenship_status)
      )
  );

  const personnelSecureMachineIncomplete = personnel.filter(
    (person) =>
      !person.secure_machine_name ||
      normalizeStatus(person.secure_machine_status) !== "verified"
  );

  const incompleteComplianceTeamTraining = complianceTeam.filter((member) => {
    const records = complianceTeamTrainingMap[String(member.id)] || [];
    if (records.length === 0) return true;
    return !records.every((row) => isCompleteStatus(row.status));
  });

  const controlCards = [
    { label: "SSP", status: cmmcProfile?.ssp_status || "Draft" },
    { label: "POA&M", status: cmmcProfile?.poam_status || "Draft" },
    {
      label: "Incident Response",
      status: cmmcProfile?.incident_response_status || "Draft",
    },
    {
      label: "Access Control",
      status: cmmcProfile?.access_control_status || "Draft",
    },
    {
      label: "Audit Logging",
      status: cmmcProfile?.audit_logging_status || "Draft",
    },
    {
      label: "Media Protection",
      status: cmmcProfile?.media_protection_status || "Draft",
    },
    {
      label: "Training Program",
      status: cmmcProfile?.training_program_status || "Draft",
    },
    {
      label: "Vendor Management",
      status: cmmcProfile?.vendor_management_status || "Draft",
    },
    {
      label: "Scoping",
      status: cmmcProfile?.scoping_status || "Draft",
    },
  ];

  const incompleteControls = controlCards.filter(
    (card) => !isCompleteStatus(card.status)
  );

  const readinessChecks = [
    { label: "Organization CMMC profile", complete: Boolean(cmmcProfile) },
    { label: "SPRS score entered", complete: typeof cmmcProfile?.sprs_score === "number" },
    {
      label: "Assessment status complete",
      complete: isCompleteStatus(cmmcProfile?.assessment_status),
    },
    { label: "SSP complete", complete: isCompleteStatus(cmmcProfile?.ssp_status) },
    { label: "POA&M complete", complete: isCompleteStatus(cmmcProfile?.poam_status) },
    {
      label: "Incident response complete",
      complete: isCompleteStatus(cmmcProfile?.incident_response_status),
    },
    {
      label: "Access control complete",
      complete: isCompleteStatus(cmmcProfile?.access_control_status),
    },
    {
      label: "Audit logging complete",
      complete: isCompleteStatus(cmmcProfile?.audit_logging_status),
    },
    {
      label: "Media protection complete",
      complete: isCompleteStatus(cmmcProfile?.media_protection_status),
    },
    {
      label: "Training program complete",
      complete: isCompleteStatus(cmmcProfile?.training_program_status),
    },
    {
      label: "Vendor management complete",
      complete: isCompleteStatus(cmmcProfile?.vendor_management_status),
    },
    {
      label: "Scoping complete",
      complete: isCompleteStatus(cmmcProfile?.scoping_status),
    },
    {
      label: "All project documents complete",
      complete: pendingProjectDocs.length === 0 && artifacts.length > 0,
    },
    {
      label: "All personnel training complete",
      complete: personnel.length > 0 && personnelTrainingIncomplete.length === 0,
    },
    {
      label: "All personnel RPS complete",
      complete: personnel.length > 0 && personnelRpsIncomplete.length === 0,
    },
    {
      label: "All citizenship verifications complete",
      complete: personnel.length > 0 && personnelCitizenshipIncomplete.length === 0,
    },
    {
      label: "All secure machines verified",
      complete: personnel.length > 0 && personnelSecureMachineIncomplete.length === 0,
    },
    {
      label: "Compliance team training complete",
      complete:
        complianceTeam.length > 0 && incompleteComplianceTeamTraining.length === 0,
    },
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

  const documentsCompleteCount = artifacts.filter((doc) =>
    isCompleteStatus(doc.status)
  ).length;

  const personnelTrainingCompleteCount = personnel.filter(
    (person) => person.training_complete
  ).length;

  const complianceTeamReadyCount = complianceTeam.filter((member) => {
    const records = complianceTeamTrainingMap[String(member.id)] || [];
    return records.length > 0 && records.every((row) => isCompleteStatus(row.status));
  }).length;

  const evidenceGaps = artifacts
    .filter((artifact) => !isCompleteStatus(artifact.status))
    .slice(0, 5);

  const criticalActions: CriticalAction[] = [
    ...evidenceGaps.slice(0, 3).map((artifact) => ({
      label: `Upload evidence for ${artifact.title || "missing item"}`,
      action: "Upload Evidence",
      href:
        artifact.project_id != null ? `/projects/${artifact.project_id}` : "/cmmc-compliance",
      severity: "Critical" as const,
    })),
    ...personnelTrainingIncomplete.slice(0, 2).map((person) => ({
      label: `Resolve training for ${displayPersonName(person)}`,
      action: "Resolve Training",
      href: "/personnel",
      severity: "High" as const,
    })),
    ...personnelSecureMachineIncomplete.slice(0, 2).map((person) => ({
      label: `Verify secure machine for ${displayPersonName(person)}`,
      action: "Verify Machine",
      href:
        person.project_id != null ? `/projects/${person.project_id}` : "/personnel",
      severity: "High" as const,
    })),
  ].slice(0, 5);

  const topRisks = [
    ...(personnelSecureMachineIncomplete.length > 0
      ? [
          {
            label: `${personnelSecureMachineIncomplete.length} unverified secure machine assignment(s)`,
            risk: "High Risk",
          },
        ]
      : []),
    ...(personnelTrainingIncomplete.length > 0
      ? [
          {
            label: `${personnelTrainingIncomplete.length} personnel training item(s) incomplete`,
            risk: "High Risk",
          },
        ]
      : []),
    ...(personnelRpsIncomplete.length > 0
      ? [
          {
            label: `${personnelRpsIncomplete.length} personnel screening item(s) incomplete`,
            risk: "High Risk",
          },
        ]
      : []),
    ...(pendingProjectDocs.length > 0
      ? [
          {
            label: `${pendingProjectDocs.length} evidence/document item(s) not audit-ready`,
            risk: "Medium Risk",
          },
        ]
      : []),
    ...(incompleteControls.length > 0
      ? [
          {
            label: `${incompleteControls.length} CMMC control area(s) still incomplete`,
            risk: "Medium Risk",
          },
        ]
      : []),
  ].slice(0, 5);

  const uniqueIncompleteItems = [
    ...(pendingProjectDocs.length > 0
      ? [`${pendingProjectDocs.length} project document(s) still incomplete or pending`] 
      : []),
    ...(personnelTrainingIncomplete.length > 0
      ? [`${personnelTrainingIncomplete.length} personnel record(s) missing completed training`]
      : []),
    ...(personnelRpsIncomplete.length > 0
      ? [`${personnelRpsIncomplete.length} personnel record(s) missing completed restricted party screening`]
      : []),
    ...(personnelCitizenshipIncomplete.length > 0
      ? [`${personnelCitizenshipIncomplete.length} personnel record(s) missing citizenship verification`]
      : []),
    ...(personnelSecureMachineIncomplete.length > 0
      ? [`${personnelSecureMachineIncomplete.length} personnel record(s) missing verified secure machine assignment`]
      : []),
    ...(incompleteComplianceTeamTraining.length > 0
      ? [`${incompleteComplianceTeamTraining.length} compliance team member(s) missing completed training coverage`]
      : []),
    ...incompleteControls.map(
      (card) => `${card.label} is still ${card.status || "Draft"}`
    ),
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-600">
          Action Center for compliance readiness, risk, evidence gaps, and required next steps.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Critical Actions</h2>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
              {criticalActions.length} Active
            </span>
          </div>

          {criticalActions.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              No critical actions at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {criticalActions.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs text-red-600">{item.severity}</div>
                  </div>

                  <Link
                    href={item.href}
                    className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                  >
                    {item.action}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Institutional Readiness</h2>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-8 border-blue-100">
              <div className="text-center">
                <div className="text-5xl font-bold text-blue-600">{readinessPercent}%</div>
                <div className="mt-2 text-xs text-slate-500">Overall readiness</div>
              </div>
            </div>

            <div className="mt-5 text-sm text-slate-500">
              {completedReadinessChecks} of {readinessChecks.length} tracked status checks complete
            </div>

            <Link
              href="/cmmc-compliance"
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View Compliance Hub
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Top 5 Risks</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              {topRisks.length} Identified
            </span>
          </div>

          {topRisks.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              No major risks identified.
            </div>
          ) : (
            <div className="space-y-3">
              {topRisks.map((risk, index) => (
                <div
                  key={`${risk.label}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="text-sm text-slate-900">{risk.label}</div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {risk.risk}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Projects Overview</h2>
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
            <div className="space-y-4">
              {projectReadiness.slice(0, 5).map((project) => (
                <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {project.project_name || "Untitled Project"}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">
                        {project.sponsor || "No sponsor"} • {project.status || "Pending"}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                        project.status
                      )}`}
                    >
                      {project.status || "Pending"}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">Compliance Progress</span>
                    <span className="font-medium text-slate-900">
                      {project.readiness.percent}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${project.readiness.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Evidence Gaps</h2>
            <Link
              href="/cmmc-compliance"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Missing Evidence
            </Link>
          </div>

          {evidenceGaps.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              All evidence is complete.
            </div>
          ) : (
            <div className="space-y-3">
              {evidenceGaps.map((gap) => (
                <div
                  key={gap.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {gap.title || "Missing Evidence"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {gap.artifact_type || "Evidence Item"} • {getEvidenceStatus(gap)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Updated {formatDate(gap.created_at)}
                    </div>
                  </div>

                  <Link
                    href={
                      gap.project_id != null
                        ? `/projects/${gap.project_id}`
                        : "/cmmc-compliance"
                    }
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Upload Evidence
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Personnel Compliance</h2>
            <Link
              href="/personnel"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Manage Personnel
            </Link>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Training Incomplete</div>
              <div className="mt-2 text-4xl font-bold text-red-600">
                {personnelTrainingIncomplete.length}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Unverified Machines</div>
              <div className="mt-2 text-4xl font-bold text-amber-600">
                {personnelSecureMachineIncomplete.length}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Authorized / Compliant</div>
              <div className="mt-2 text-4xl font-bold text-blue-600">
                {personnel.length === 0
                  ? "0%"
                  : `${formatPercent(
                      personnel.length - personnelTrainingIncomplete.length,
                      personnel.length
                    )}%`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Alerts</h2>
            <Link
              href="/cmmc-compliance"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Alerts
            </Link>
          </div>

          {uniqueIncompleteItems.length === 0 ? (
            <div className="text-sm text-slate-500">No active alerts.</div>
          ) : (
            <div className="space-y-3">
              {uniqueIncompleteItems.slice(0, 6).map((alert, index) => (
                <div key={index} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <div className="text-sm text-slate-700">{alert}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Readiness Summary</h2>
            <Link
              href="/cmmc-compliance"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Compliance
            </Link>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Projects</div>
              <div className="text-right text-slate-900">
                {activeProjects.length} active project records
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Documents / Evidence</div>
              <div className="text-right text-slate-900">
                {documentsCompleteCount} complete / {artifacts.length} total
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Personnel</div>
              <div className="text-right text-slate-900">
                {personnel.length} assigned personnel records
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Personnel Training</div>
              <div className="text-right text-slate-900">
                {personnelTrainingCompleteCount} complete / {personnel.length} total
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Compliance Team</div>
              <div className="text-right text-slate-900">
                {complianceTeamReadyCount} ready / {complianceTeam.length} total
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">SPRS Score</div>
              <div className="text-right text-slate-900">
                {cmmcProfile?.sprs_score ?? "—"}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="font-medium text-slate-700">Organization Readiness</div>
              <div className="text-right font-semibold text-slate-900">
                {readinessPercent}% complete
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}