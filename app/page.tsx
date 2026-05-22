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

type IncidentReportRow = {
  id: number;
  title: string | null;
  incident_status: string | null;
  severity: string | null;
  incident_type: string | null;
  involves_cui: boolean | null;
  involves_itar: boolean | null;
  involves_ear: boolean | null;
  involves_pii: boolean | null;
  cyber_related: boolean | null;
  created_at: string | null;
};

type CorrectiveActionRow = {
  id: number;
  title: string | null;
  source_type: string | null;
  source_reference: string | null;
  related_control: string | null;
  related_project: string | null;
  related_incident_id: number | null;
  severity: string | null;
  status: string | null;
  owner: string | null;
  due_date: string | null;
  completed_date: string | null;
  created_at: string | null;
};

type CriticalAction = {
  label: string;
  action: string;
  href: string;
  severity: "Critical" | "High" | "Medium";
  owner?: string;
};

type RiskItem = {
  label: string;
  risk: "High Risk" | "Medium Risk";
};

type ActionAlert = {
  label: string;
  action: string;
  href: string;
  tone: "red" | "amber" | "blue";
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
    "closed",
    "resolved",
    "validated",
  ].includes(normalizeStatus(value));
}

function getBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (isCompleteStatus(status)) {
    return "bg-green-100 text-green-700";
  }

  if (
    normalized === "in progress" ||
    normalized === "pending" ||
    normalized === "draft" ||
    normalized === "review required" ||
    normalized === "partial" ||
    normalized === "open" ||
    normalized === "in review" ||
    normalized === "pending validation" ||
    normalized === "medium"
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (
    normalized === "expired" ||
    normalized === "overdue" ||
    normalized === "non-compliant" ||
    normalized === "restricted" ||
    normalized === "missing" ||
    normalized === "critical" ||
    normalized === "high"
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
    docCount: projectDocs.length,
    personnelCount: projectPersonnel.length,
    incompleteDocs: projectDocs.filter((doc) => !isCompleteStatus(doc.status)).length,
    nonCompliantPersonnel: projectPersonnel.filter(
      (person) =>
        !person.training_complete ||
        normalizeStatus(person.secure_machine_status) !== "verified" ||
        !["cleared", "verified", "complete", "completed"].includes(
          normalizeStatus(person.rps_screening_status)
        )
    ).length,
  };
}

function getEvidenceStatus(doc: ArtifactRow) {
  if (!doc.status) return "Missing";
  if (isCompleteStatus(doc.status)) return "Complete";
  return "Partial";
}

function getEvidenceTone(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "complete") return "bg-green-50 text-green-700 border-green-200";
  if (normalized === "partial") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function getProjectDisplayName(project: ProjectRow, index: number) {
  if (project.project_name && project.project_name.trim().length > 0) {
    return project.project_name;
  }

  const fallbackNames = [
    "Quantum Navigation",
    "Secure Drone Comms",
    "AI Radar System",
    "Autonomy Research",
    "Protected Data Project",
  ];

  return fallbackNames[index] || `Project ${project.id}`;
}

function isCorrectiveActionClosed(action: CorrectiveActionRow) {
  return ["closed", "complete", "completed", "resolved", "validated"].includes(
    normalizeStatus(action.status)
  );
}

function isCorrectiveActionOverdue(action: CorrectiveActionRow) {
  if (!action.due_date || isCorrectiveActionClosed(action)) return false;

  const dueDate = new Date(action.due_date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
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

  const incidentReportsResult = await supabase
    .from("incident_reports")
    .select(`
      id,
      title,
      incident_status,
      severity,
      incident_type,
      involves_cui,
      involves_itar,
      involves_ear,
      involves_pii,
      cyber_related,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const correctiveActionsResult = await supabase
    .from("corrective_actions")
    .select(`
      id,
      title,
      source_type,
      source_reference,
      related_control,
      related_project,
      related_incident_id,
      severity,
      status,
      owner,
      due_date,
      completed_date,
      created_at
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const artifacts: ArtifactRow[] = (artifactsResult.data ?? []) as ArtifactRow[];
  const personnel: PersonnelRow[] = (personnelResult.data ?? []) as PersonnelRow[];
  const complianceTeam: ComplianceTeamRow[] =
    (complianceTeamResult.data ?? []) as ComplianceTeamRow[];
  const complianceTeamTraining: ComplianceTeamTrainingRow[] =
    (complianceTeamTrainingResult.data ?? []) as ComplianceTeamTrainingRow[];
  const cmmcProfile: CmmcProfileRow | null =
    (cmmcProfileResult.data as CmmcProfileRow | null) ?? null;
  const incidentReports: IncidentReportRow[] =
    (incidentReportsResult.data ?? []) as IncidentReportRow[];
  const correctiveActions: CorrectiveActionRow[] =
    (correctiveActionsResult.data ?? []) as CorrectiveActionRow[];

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

  const openIncidentReports = incidentReports.filter((incident) =>
    ["open", "in review", "in progress", "submitted"].includes(
      normalizeStatus(incident.incident_status)
    )
  );

  const draftIncidentReports = incidentReports.filter(
    (incident) => normalizeStatus(incident.incident_status) === "draft"
  );

  const closedIncidentReports = incidentReports.filter((incident) =>
    ["closed", "resolved", "complete", "completed"].includes(
      normalizeStatus(incident.incident_status)
    )
  );

  const highRiskIncidentReports = incidentReports.filter((incident) =>
    ["high", "critical"].includes(normalizeStatus(incident.severity))
  );

  const sensitiveIncidentReports = incidentReports.filter(
    (incident) =>
      incident.involves_cui ||
      incident.involves_itar ||
      incident.involves_ear ||
      incident.involves_pii ||
      incident.cyber_related
  );

  const openCorrectiveActions = correctiveActions.filter(
    (action) => !isCorrectiveActionClosed(action)
  );
  const closedCorrectiveActions = correctiveActions.filter((action) =>
    isCorrectiveActionClosed(action)
  );
  const overdueCorrectiveActions = correctiveActions.filter((action) =>
    isCorrectiveActionOverdue(action)
  );
  const highRiskCorrectiveActions = correctiveActions.filter((action) =>
    ["high", "critical"].includes(normalizeStatus(action.severity))
  );

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
    {
      label: "No open high-risk incidents",
      complete: highRiskIncidentReports.length === 0,
    },
    {
      label: "No overdue corrective actions",
      complete: overdueCorrectiveActions.length === 0,
    },
    {
      label: "No open high-risk corrective actions",
      complete: highRiskCorrectiveActions.length === 0,
    },
  ];

  const completedReadinessChecks = readinessChecks.filter((check) => check.complete).length;
  const readinessPercent = formatPercent(
    completedReadinessChecks,
    readinessChecks.length
  );

  const projectReadiness = projects.map((project, index) => ({
    ...project,
    displayName: getProjectDisplayName(project, index),
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
    .slice(0, 5)
    .map((artifact) => ({
      ...artifact,
      evidenceStatus: getEvidenceStatus(artifact),
    }));

  const criticalActions: CriticalAction[] = [
    ...overdueCorrectiveActions.slice(0, 2).map((action) => ({
      label: `Resolve overdue corrective action: ${action.title || "Untitled action"}`,
      action: "Resolve",
      href: "/corrective-actions",
      severity: "Critical" as const,
      owner: action.owner || "Unassigned",
    })),
    ...highRiskCorrectiveActions.slice(0, 2).map((action) => ({
      label: `Review high-risk corrective action: ${action.title || "Untitled action"}`,
      action: "Review",
      href: "/corrective-actions",
      severity: "Critical" as const,
      owner: action.owner || "Unassigned",
    })),
    ...highRiskIncidentReports.slice(0, 2).map((incident) => ({
      label: `Review high-risk incident: ${incident.title || "Untitled incident"}`,
      action: "Review Incident",
      href: `/incident-reporting/${incident.id}`,
      severity: "Critical" as const,
      owner: "Compliance / Security",
    })),
    ...evidenceGaps.slice(0, 3).map((artifact) => ({
      label: `Upload evidence for ${artifact.title || "missing item"}`,
      action: "Upload Evidence",
      href:
        artifact.project_id != null ? `/projects/${artifact.project_id}` : "/cmmc-compliance",
      severity: "Critical" as const,
      owner: artifact.project_id != null ? `Project ${artifact.project_id}` : "Compliance",
    })),
    ...personnelTrainingIncomplete.slice(0, 2).map((person) => ({
      label: `Resolve training for ${displayPersonName(person)}`,
      action: "Resolve Training",
      href: "/personnel",
      severity: "High" as const,
      owner: displayPersonName(person),
    })),
    ...personnelSecureMachineIncomplete.slice(0, 2).map((person) => ({
      label: `Verify secure machine for ${displayPersonName(person)}`,
      action: "Verify Machine",
      href:
        person.project_id != null ? `/projects/${person.project_id}` : "/personnel",
      severity: "High" as const,
      owner: displayPersonName(person),
    })),
  ].slice(0, 5);

  const topRisks: RiskItem[] = [
    ...(overdueCorrectiveActions.length > 0
      ? [
          {
            label: `${overdueCorrectiveActions.length} overdue corrective action(s) require immediate attention`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(highRiskCorrectiveActions.length > 0
      ? [
          {
            label: `${highRiskCorrectiveActions.length} high-risk POA&M / corrective action item(s) remain open`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(highRiskIncidentReports.length > 0
      ? [
          {
            label: `${highRiskIncidentReports.length} high-risk incident report(s) require review`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(sensitiveIncidentReports.length > 0
      ? [
          {
            label: `${sensitiveIncidentReports.length} incident report(s) involve CUI, export control, PII, or cyber concerns`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(personnelSecureMachineIncomplete.length > 0
      ? [
          {
            label: `${personnelSecureMachineIncomplete.length} unverified secure machine assignment(s)`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(personnelTrainingIncomplete.length > 0
      ? [
          {
            label: `${personnelTrainingIncomplete.length} personnel training item(s) incomplete`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(personnelRpsIncomplete.length > 0
      ? [
          {
            label: `${personnelRpsIncomplete.length} personnel screening item(s) incomplete`,
            risk: "High Risk" as const,
          },
        ]
      : []),
    ...(pendingProjectDocs.length > 0
      ? [
          {
            label: `${pendingProjectDocs.length} evidence/document item(s) not audit-ready`,
            risk: "Medium Risk" as const,
          },
        ]
      : []),
    ...(incompleteControls.length > 0
      ? [
          {
            label: `${incompleteControls.length} CMMC control area(s) still incomplete`,
            risk: "Medium Risk" as const,
          },
        ]
      : []),
  ].slice(0, 5);

  const actionAlerts: ActionAlert[] = [
    ...(overdueCorrectiveActions.length > 0
      ? [
          {
            label: `${overdueCorrectiveActions.length} corrective action item(s) are overdue`,
            action: "Resolve Actions",
            href: "/corrective-actions",
            tone: "red" as const,
          },
        ]
      : []),
    ...(openCorrectiveActions.length > 0
      ? [
          {
            label: `${openCorrectiveActions.length} POA&M / corrective action item(s) remain open`,
            action: "View Actions",
            href: "/corrective-actions",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(highRiskIncidentReports.length > 0
      ? [
          {
            label: `${highRiskIncidentReports.length} high-risk incident report(s) require review`,
            action: "Review Incidents",
            href: "/incident-reporting",
            tone: "red" as const,
          },
        ]
      : []),
    ...(openIncidentReports.length > 0
      ? [
          {
            label: `${openIncidentReports.length} incident report(s) remain open`,
            action: "View Incidents",
            href: "/incident-reporting",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(pendingProjectDocs.length > 0
      ? [
          {
            label: `${pendingProjectDocs.length} project document(s) still incomplete or pending`,
            action: "Upload Evidence",
            href: "/cmmc-compliance",
            tone: "red" as const,
          },
        ]
      : []),
    ...(personnelTrainingIncomplete.length > 0
      ? [
          {
            label: `${personnelTrainingIncomplete.length} personnel record(s) missing completed training`,
            action: "Manage Training",
            href: "/personnel",
            tone: "red" as const,
          },
        ]
      : []),
    ...(personnelRpsIncomplete.length > 0
      ? [
          {
            label: `${personnelRpsIncomplete.length} personnel record(s) missing completed restricted party screening`,
            action: "Review Screenings",
            href: "/personnel",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(personnelCitizenshipIncomplete.length > 0
      ? [
          {
            label: `${personnelCitizenshipIncomplete.length} personnel record(s) missing citizenship verification`,
            action: "Verify Personnel",
            href: "/personnel",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(personnelSecureMachineIncomplete.length > 0
      ? [
          {
            label: `${personnelSecureMachineIncomplete.length} personnel record(s) missing verified secure machine assignment`,
            action: "Verify Machines",
            href: "/personnel",
            tone: "red" as const,
          },
        ]
      : []),
    ...(incompleteComplianceTeamTraining.length > 0
      ? [
          {
            label: `${incompleteComplianceTeamTraining.length} compliance team member(s) missing completed training coverage`,
            action: "Review Team",
            href: "/compliance-team",
            tone: "blue" as const,
          },
        ]
      : []),
  ].slice(0, 8);

  const readinessMessage =
    readinessPercent === 0
      ? "Configuration is in progress. Complete key compliance records to establish baseline readiness."
      : `${completedReadinessChecks} of ${readinessChecks.length} tracked status checks complete`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Action Center</h1>
          <p className="mt-1 text-slate-600">
            Immediate view of organizational readiness, critical actions, risks, evidence gaps, incidents, and corrective actions.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Quick Stats</div>
          <div className="mt-2 grid grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold text-slate-900">{activeProjects.length}</div>
              <div className="text-xs text-slate-500">Active Projects</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{personnel.length}</div>
              <div className="text-xs text-slate-500">Personnel</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">110</div>
              <div className="text-xs text-slate-500">CMMC Controls</div>
            </div>
          </div>
        </div>
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
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {item.label}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-red-600">{item.severity}</span>
                        {item.owner ? (
                          <span className="text-slate-400">• Owner: {item.owner}</span>
                        ) : null}
                      </div>
                    </div>

                    <Link
                      href={item.href}
                      className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      {item.action}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/corrective-actions"
            className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View remediation actions →
          </Link>
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

            <div className="mt-5 max-w-xs text-center text-sm text-slate-500">
              {readinessMessage}
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
                  <div className="flex items-center gap-3 text-sm text-slate-900">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <span>{risk.label}</span>
                  </div>

                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {risk.risk}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/cmmc-compliance/reports"
            className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all risks →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
            <Link href="/projects" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="text-4xl font-bold text-slate-900">{activeProjects.length}</div>
          <div className="mt-1 text-sm text-slate-500">Active projects</div>

          <div className="mt-4 space-y-3">
            {projectReadiness.slice(0, 3).map((project) => (
              <div key={project.id} className="rounded-xl border border-slate-200 p-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm font-medium text-slate-900 hover:text-blue-600"
                >
                  {project.displayName}
                </Link>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${project.readiness.percent}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {project.readiness.percent}% ready
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Evidence</h2>
            <Link href="/cmmc-compliance/policies" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="text-4xl font-bold text-red-600">{evidenceGaps.length}</div>
          <div className="mt-1 text-sm text-slate-500">Open evidence gaps</div>

          <div className="mt-4 space-y-3">
            {evidenceGaps.slice(0, 3).map((gap) => (
              <div key={gap.id} className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-900">
                  {gap.title || "Missing Evidence"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {gap.artifact_type || "Evidence Item"}
                </div>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getEvidenceTone(
                    gap.evidenceStatus
                  )}`}
                >
                  {gap.evidenceStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Personnel</h2>
            <Link href="/personnel" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold text-red-600">
                {personnelTrainingIncomplete.length}
              </div>
              <div className="text-sm text-slate-500">Training incomplete</div>
            </div>

            <div>
              <div className="text-4xl font-bold text-amber-600">
                {personnelSecureMachineIncomplete.length}
              </div>
              <div className="text-sm text-slate-500">Machine gaps</div>
            </div>

            <div>
              <div className="text-4xl font-bold text-blue-600">
                {personnel.length === 0
                  ? "0%"
                  : `${formatPercent(
                      personnel.length - personnelTrainingIncomplete.length,
                      personnel.length
                    )}%`}
              </div>
              <div className="text-sm text-slate-500">Training coverage</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Incidents</h2>
            <Link href="/incident-reporting" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold text-blue-600">
                {openIncidentReports.length}
              </div>
              <div className="text-sm text-slate-500">Open incidents</div>
            </div>

            <div>
              <div className="text-4xl font-bold text-red-600">
                {highRiskIncidentReports.length}
              </div>
              <div className="text-sm text-slate-500">High risk</div>
            </div>

            <div>
              <div className="text-4xl font-bold text-amber-600">
                {sensitiveIncidentReports.length}
              </div>
              <div className="text-sm text-slate-500">Controlled concerns</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">POA&amp;M</h2>
            <Link href="/corrective-actions" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold text-blue-600">
                {openCorrectiveActions.length}
              </div>
              <div className="text-sm text-slate-500">Open actions</div>
            </div>

            <div>
              <div className="text-4xl font-bold text-red-600">
                {overdueCorrectiveActions.length}
              </div>
              <div className="text-sm text-slate-500">Overdue</div>
            </div>

            <div>
              <div className="text-4xl font-bold text-amber-600">
                {highRiskCorrectiveActions.length}
              </div>
              <div className="text-sm text-slate-500">High risk</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Alerts & Required Actions</h2>
            <Link
              href="/cmmc-compliance/reports"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Alerts
            </Link>
          </div>

          {actionAlerts.length === 0 ? (
            <div className="text-sm text-slate-500">No active alerts.</div>
          ) : (
            <div className="space-y-3">
              {actionAlerts.map((alert, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0 text-sm text-slate-700">{alert.label}</div>

                  <Link
                    href={alert.href}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-white ${
                      alert.tone === "red"
                        ? "bg-red-600 hover:bg-red-700"
                        : alert.tone === "amber"
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {alert.action}
                  </Link>
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
              Compliance Hub
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
              <div className="text-slate-700">Incident Reports</div>
              <div className="text-right text-slate-900">
                {openIncidentReports.length} open / {incidentReports.length} total
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">POA&M / Corrective Actions</div>
              <div className="text-right text-slate-900">
                {openCorrectiveActions.length} open / {correctiveActions.length} total
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="text-slate-700">Overdue Corrective Actions</div>
              <div className="text-right text-slate-900">
                {overdueCorrectiveActions.length} overdue / {closedCorrectiveActions.length} closed
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

      {(draftIncidentReports.length > 0 || openCorrectiveActions.length > 0) && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-900">
          {draftIncidentReports.length > 0 && (
            <div>
              You currently have {draftIncidentReports.length} draft incident report
              {draftIncidentReports.length === 1 ? "" : "s"} that may need review or completion.
            </div>
          )}

          {openCorrectiveActions.length > 0 && (
            <div className={draftIncidentReports.length > 0 ? "mt-2" : ""}>
              You currently have {openCorrectiveActions.length} open POA&amp;M / corrective action
              item{openCorrectiveActions.length === 1 ? "" : "s"} requiring tracking.
            </div>
          )}
        </div>
      )}
    </div>
  );
}