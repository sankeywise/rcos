import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type CmmcDocument = {
  id: number;
  document_name: string;
  document_type: string | null;
  control_family_code: string | null;
  status: string | null;
  owner: string | null;
  last_updated: string | null;
};

type CmmcFamily = {
  code: string;
  name: string;
  total_controls: number;
  sort_order: number;
};

type ProjectRow = {
  id: number;
  project_name: string | null;
  sponsor: string | null;
  status: string | null;
  classification: string | null;
  environment: string | null;
  export_control_type: string | null;
};

type ProjectComplianceItem = {
  id: number;
  project_id: number;
  item_name: string;
  item_type: string | null;
  control_family_code: string | null;
  related_control: string | null;
  status: string | null;
  owner: string | null;
  due_date: string | null;
  requires_evidence: boolean | null;
  evidence_status: string | null;
  evidence_reference: string | null;
  sensitivity_level: string | null;
};

type ProjectIntakeReview = {
  id: number;
  project_id: number | null;
  project_title: string | null;
  sponsor: string | null;
  principal_investigator: string | null;
  review_status: string | null;
  review_owner: string | null;
  review_date: string | null;
  involves_cui: boolean | null;
  involves_itar: boolean | null;
  involves_ear: boolean | null;
  involves_noforn: boolean | null;
  involves_foreign_nationals: boolean | null;
  involves_controlled_technical_data: boolean | null;
  involves_secure_enclave: boolean | null;
  requires_tcp: boolean | null;
  requires_rps: boolean | null;
  requires_cmmc_review: boolean | null;
  requires_secure_machine_access: boolean | null;
  requires_fso_review: boolean | null;
  requires_iso_review: boolean | null;
  requires_eco_review: boolean | null;
  final_determination: string | null;
  created_at: string | null;
};

type PersonnelRow = {
  id: number;
  project_id: number | null;
  name: string | null;
  full_name: string | null;
  training_complete: boolean | null;
  citizenship_status: string | null;
  rps_screening_status: string | null;
  secure_machine_name: string | null;
  secure_machine_status: string | null;
};

type IncidentReport = {
  id: number;
  title: string | null;
  project_name: string | null;
  incident_status: string | null;
  severity: string | null;
  involves_cui: boolean | null;
  involves_itar: boolean | null;
  involves_ear: boolean | null;
  involves_pii: boolean | null;
  cyber_related: boolean | null;
  created_at: string | null;
};

type CorrectiveAction = {
  id: number;
  title: string | null;
  status: string | null;
  severity: string | null;
  owner: string | null;
  due_date: string | null;
  related_project: string | null;
  related_control: string | null;
  source_type: string | null;
};

type CmmcProfile = {
  sprs_score: number | null;
  sprs_last_updated: string | null;
  cmmc_level_target: string | null;
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
    "not applicable",
    "final",
  ].includes(normalizeStatus(value));
}

function getBadgeClass(value?: string | null) {
  const normalized = normalizeStatus(value);

  if (isCompleteStatus(value)) {
    return "bg-green-100 text-green-700";
  }

  if (
    [
      "draft",
      "pending",
      "in progress",
      "open",
      "partial",
      "in review",
      "requires review",
      "pending validation",
      "medium",
      "referenced",
      "provided",
      "moderate risk",
    ].includes(normalized)
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (
    [
      "missing",
      "overdue",
      "expired",
      "non-compliant",
      "high",
      "critical",
      "not started",
      "not provided",
      "high risk",
      "restricted",
      "not approved",
    ].includes(normalized)
  ) {
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

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function isCorrectiveActionClosed(action: CorrectiveAction) {
  return ["closed", "complete", "completed", "resolved", "validated"].includes(
    normalizeStatus(action.status)
  );
}

function isCorrectiveActionOverdue(action: CorrectiveAction) {
  if (!action.due_date || isCorrectiveActionClosed(action)) return false;

  const dueDate = new Date(action.due_date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
}

function isProjectItemOverdue(item: ProjectComplianceItem) {
  if (!item.due_date || isCompleteStatus(item.status)) return false;

  const dueDate = new Date(item.due_date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
}

function displayPersonName(person: PersonnelRow) {
  return person.full_name || person.name || "Unnamed Person";
}

function getProjectName(project: ProjectRow, index: number) {
  if (project.project_name && project.project_name.trim().length > 0) {
    return project.project_name;
  }

  return `Unnamed Project ${project.id || index + 1}`;
}

function getIntakeRiskLevel(review: ProjectIntakeReview) {
  const flags = [
    review.involves_cui,
    review.involves_itar,
    review.involves_ear,
    review.involves_noforn,
    review.involves_foreign_nationals,
    review.involves_controlled_technical_data,
    review.involves_secure_enclave,
    review.requires_tcp,
    review.requires_cmmc_review,
  ].filter(Boolean).length;

  if (flags >= 5) return "High Risk";
  if (flags >= 2) return "Moderate Risk";
  return "Low Risk";
}

function isIntakeFinal(review: ProjectIntakeReview) {
  return ["final", "approved", "complete", "completed", "cleared"].includes(
    normalizeStatus(review.review_status)
  );
}

export default async function AuditModePage() {
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
    return <div className="p-6 text-red-600">No organization membership found.</div>;
  }

  const orgId = membership.organization_id;

  const familiesResult = await supabase
    .from("cmmc_control_families")
    .select("code, name, total_controls, sort_order")
    .order("sort_order", { ascending: true });

  const documentsResult = await supabase
    .from("cmmc_documents")
    .select("id, document_name, document_type, control_family_code, status, owner, last_updated")
    .eq("organization_id", orgId)
    .order("document_name", { ascending: true });

  const projectsResult = await supabase
    .from("projects")
    .select("id, project_name, sponsor, status, classification, environment, export_control_type")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const projectComplianceItemsResult = await supabase
    .from("project_compliance_items")
    .select("id, project_id, item_name, item_type, control_family_code, related_control, status, owner, due_date, requires_evidence, evidence_status, evidence_reference, sensitivity_level")
    .eq("organization_id", orgId)
    .order("project_id", { ascending: true })
    .order("id", { ascending: true });

  const projectIntakeReviewsResult = await supabase
    .from("project_intake_reviews")
    .select("id, project_id, project_title, sponsor, principal_investigator, review_status, review_owner, review_date, involves_cui, involves_itar, involves_ear, involves_noforn, involves_foreign_nationals, involves_controlled_technical_data, involves_secure_enclave, requires_tcp, requires_rps, requires_cmmc_review, requires_secure_machine_access, requires_fso_review, requires_iso_review, requires_eco_review, final_determination, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const personnelResult = await supabase
    .from("personnel")
    .select("id, project_id, name, full_name, training_complete, citizenship_status, rps_screening_status, secure_machine_name, secure_machine_status")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const incidentsResult = await supabase
    .from("incident_reports")
    .select("id, title, project_name, incident_status, severity, involves_cui, involves_itar, involves_ear, involves_pii, cyber_related, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const actionsResult = await supabase
    .from("corrective_actions")
    .select("id, title, status, severity, owner, due_date, related_project, related_control, source_type")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const profileResult = await supabase
    .from("cmmc_compliance_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  const families: CmmcFamily[] = (familiesResult.data ?? []) as CmmcFamily[];
  const documents: CmmcDocument[] = (documentsResult.data ?? []) as CmmcDocument[];
  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const projectComplianceItems: ProjectComplianceItem[] =
    (projectComplianceItemsResult.data ?? []) as ProjectComplianceItem[];
  const projectIntakeReviews: ProjectIntakeReview[] =
    (projectIntakeReviewsResult.data ?? []) as ProjectIntakeReview[];
  const personnel: PersonnelRow[] = (personnelResult.data ?? []) as PersonnelRow[];
  const incidents: IncidentReport[] = (incidentsResult.data ?? []) as IncidentReport[];
  const correctiveActions: CorrectiveAction[] = (actionsResult.data ?? []) as CorrectiveAction[];
  const profile: CmmcProfile | null = (profileResult.data as CmmcProfile | null) ?? null;

  const totalControls = families.reduce((sum, item) => sum + item.total_controls, 0) || 110;

  const completeDocuments = documents.filter((doc) => isCompleteStatus(doc.status));
  const openDocuments = documents.filter((doc) => !isCompleteStatus(doc.status));

  const projectItemsComplete = projectComplianceItems.filter((item) =>
    isCompleteStatus(item.status)
  );
  const projectItemsOpen = projectComplianceItems.filter(
    (item) => !isCompleteStatus(item.status)
  );
  const projectItemsOverdue = projectComplianceItems.filter((item) =>
    isProjectItemOverdue(item)
  );
  const projectEvidenceMissing = projectComplianceItems.filter(
    (item) =>
      item.requires_evidence &&
      !["provided", "referenced", "verified", "not applicable"].includes(
        normalizeStatus(item.evidence_status)
      )
  );

  const draftOrInReviewIntakes = projectIntakeReviews.filter((review) =>
    ["draft", "pending", "in review", "requires review"].includes(
      normalizeStatus(review.review_status)
    )
  );

  const finalizedIntakes = projectIntakeReviews.filter((review) =>
    isIntakeFinal(review)
  );

  const highRiskIntakes = projectIntakeReviews.filter(
    (review) => getIntakeRiskLevel(review) === "High Risk"
  );

  const moderateRiskIntakes = projectIntakeReviews.filter(
    (review) => getIntakeRiskLevel(review) === "Moderate Risk"
  );

  const intakesRequiringEco = projectIntakeReviews.filter(
    (review) => review.requires_eco_review && !isIntakeFinal(review)
  );

  const intakesRequiringIso = projectIntakeReviews.filter(
    (review) => review.requires_iso_review && !isIntakeFinal(review)
  );

  const intakesRequiringFso = projectIntakeReviews.filter(
    (review) => review.requires_fso_review && !isIntakeFinal(review)
  );

  const intakesRequiringCmmc = projectIntakeReviews.filter(
    (review) => review.requires_cmmc_review && !isIntakeFinal(review)
  );

  const intakesRequiringTcp = projectIntakeReviews.filter(
    (review) => review.requires_tcp && !isIntakeFinal(review)
  );

  const intakesRequiringSecureMachine = projectIntakeReviews.filter(
    (review) => review.requires_secure_machine_access && !isIntakeFinal(review)
  );

  const personnelTrainingComplete = personnel.filter((person) => person.training_complete);
  const personnelTrainingIncomplete = personnel.filter((person) => !person.training_complete);

  const personnelScreeningIncomplete = personnel.filter(
    (person) =>
      !["cleared", "verified", "complete", "completed"].includes(
        normalizeStatus(person.rps_screening_status)
      )
  );

  const personnelMachineIncomplete = personnel.filter(
    (person) =>
      !person.secure_machine_name ||
      normalizeStatus(person.secure_machine_status) !== "verified"
  );

  const openIncidents = incidents.filter((incident) =>
    ["open", "in review", "in progress", "submitted", "draft"].includes(
      normalizeStatus(incident.incident_status)
    )
  );

  const highRiskIncidents = incidents.filter((incident) =>
    ["high", "critical"].includes(normalizeStatus(incident.severity))
  );

  const sensitiveIncidents = incidents.filter(
    (incident) =>
      incident.involves_cui ||
      incident.involves_itar ||
      incident.involves_ear ||
      incident.involves_pii ||
      incident.cyber_related
  );

  const openActions = correctiveActions.filter((action) => !isCorrectiveActionClosed(action));
  const overdueActions = correctiveActions.filter((action) => isCorrectiveActionOverdue(action));
  const highRiskActions = correctiveActions.filter((action) =>
    ["high", "critical"].includes(normalizeStatus(action.severity))
  );

  const controlStatusCards = [
    { label: "SSP", status: profile?.ssp_status || "Draft" },
    { label: "POA&M", status: profile?.poam_status || "Draft" },
    { label: "Incident Response", status: profile?.incident_response_status || "Draft" },
    { label: "Access Control", status: profile?.access_control_status || "Draft" },
    { label: "Audit Logging", status: profile?.audit_logging_status || "Draft" },
    { label: "Media Protection", status: profile?.media_protection_status || "Draft" },
    { label: "Training Program", status: profile?.training_program_status || "Draft" },
    { label: "Vendor Management", status: profile?.vendor_management_status || "Draft" },
    { label: "Scoping", status: profile?.scoping_status || "Draft" },
  ];

  const completeControlAreas = controlStatusCards.filter((card) =>
    isCompleteStatus(card.status)
  );

  const readinessChecks = [
    Boolean(profile),
    typeof profile?.sprs_score === "number",
    completeControlAreas.length === controlStatusCards.length,
    documents.length > 0 && openDocuments.length === 0,
    projects.length > 0,
    projectIntakeReviews.length > 0,
    highRiskIntakes.length === 0,
    intakesRequiringEco.length === 0,
    intakesRequiringIso.length === 0,
    intakesRequiringFso.length === 0,
    projectComplianceItems.length > 0,
    projectItemsOverdue.length === 0,
    projectEvidenceMissing.length === 0,
    personnel.length > 0 && personnelTrainingIncomplete.length === 0,
    personnel.length > 0 && personnelScreeningIncomplete.length === 0,
    personnel.length > 0 && personnelMachineIncomplete.length === 0,
    highRiskIncidents.length === 0,
    overdueActions.length === 0,
    highRiskActions.length === 0,
  ];

  const readinessScore = percent(
    readinessChecks.filter(Boolean).length,
    readinessChecks.length
  );

  const familyDocumentCounts: Record<string, number> = {};
  const familyOpenDocumentCounts: Record<string, number> = {};

  documents.forEach((doc) => {
    const code = doc.control_family_code || "UN";
    familyDocumentCounts[code] = (familyDocumentCounts[code] || 0) + 1;

    if (!isCompleteStatus(doc.status)) {
      familyOpenDocumentCounts[code] = (familyOpenDocumentCounts[code] || 0) + 1;
    }
  });

  const projectItemMap: Record<number, ProjectComplianceItem[]> = {};
  projectComplianceItems.forEach((item) => {
    if (!projectItemMap[item.project_id]) {
      projectItemMap[item.project_id] = [];
    }
    projectItemMap[item.project_id].push(item);
  });

  const auditBlockers = [
    ...(openDocuments.length > 0
      ? [`${openDocuments.length} policy/document item(s) are not complete`]
      : []),
    ...(highRiskIntakes.length > 0
      ? [`${highRiskIntakes.length} high-risk project intake review(s) require routing`]
      : []),
    ...(draftOrInReviewIntakes.length > 0
      ? [`${draftOrInReviewIntakes.length} project intake review(s) are still draft or in review`]
      : []),
    ...(intakesRequiringEco.length > 0
      ? [`${intakesRequiringEco.length} intake review(s) require ECO review`]
      : []),
    ...(intakesRequiringIso.length > 0
      ? [`${intakesRequiringIso.length} intake review(s) require ISO review`]
      : []),
    ...(intakesRequiringFso.length > 0
      ? [`${intakesRequiringFso.length} intake review(s) require FSO review`]
      : []),
    ...(projectItemsOpen.length > 0
      ? [`${projectItemsOpen.length} project compliance item(s) are open`]
      : []),
    ...(projectItemsOverdue.length > 0
      ? [`${projectItemsOverdue.length} project compliance item(s) are overdue`]
      : []),
    ...(projectEvidenceMissing.length > 0
      ? [`${projectEvidenceMissing.length} project evidence reference(s) are missing`]
      : []),
    ...(personnelTrainingIncomplete.length > 0
      ? [`${personnelTrainingIncomplete.length} personnel training item(s) are incomplete`]
      : []),
    ...(personnelScreeningIncomplete.length > 0
      ? [`${personnelScreeningIncomplete.length} personnel screening item(s) are incomplete`]
      : []),
    ...(personnelMachineIncomplete.length > 0
      ? [`${personnelMachineIncomplete.length} secure machine assignment(s) are missing or unverified`]
      : []),
    ...(highRiskIncidents.length > 0
      ? [`${highRiskIncidents.length} high-risk incident report(s) require review`]
      : []),
    ...(overdueActions.length > 0
      ? [`${overdueActions.length} corrective action item(s) are overdue`]
      : []),
    ...(highRiskActions.length > 0
      ? [`${highRiskActions.length} high-risk corrective action item(s) remain open`]
      : []),
    ...(completeControlAreas.length < controlStatusCards.length
      ? [`${controlStatusCards.length - completeControlAreas.length} CMMC control area status item(s) are incomplete`]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Mode</h1>
          <p className="mt-1 text-slate-600">
            Assessor-style view of readiness, project intake, project compliance, policies, incidents, personnel, and corrective actions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Action Center
          </Link>

          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm">
            Export Audit Package
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Audit Readiness</div>
          <div className="mt-3 text-5xl font-bold text-blue-600">{readinessScore}%</div>
          <div className="mt-2 text-sm text-slate-500">
            {readinessChecks.filter(Boolean).length} of {readinessChecks.length} checks complete
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Intake Reviews</div>
          <div className="mt-3 text-5xl font-bold text-slate-900">{projectIntakeReviews.length}</div>
          <div className="mt-2 text-sm text-slate-500">{finalizedIntakes.length} finalized</div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">High-Risk Intake</div>
          <div className="mt-3 text-5xl font-bold text-red-600">{highRiskIntakes.length}</div>
          <div className="mt-2 text-sm text-slate-500">Requires routing</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Project Items</div>
          <div className="mt-3 text-5xl font-bold text-slate-900">{projectComplianceItems.length}</div>
          <div className="mt-2 text-sm text-slate-500">{projectItemsComplete.length} complete</div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Audit Blockers</div>
          <div className="mt-3 text-5xl font-bold text-red-600">{auditBlockers.length}</div>
          <div className="mt-2 text-sm text-slate-500">Requires attention</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Open POA&M</div>
          <div className="mt-3 text-5xl font-bold text-amber-600">{openActions.length}</div>
          <div className="mt-2 text-sm text-slate-500">{overdueActions.length} overdue</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Audit Blockers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Items that may prevent the organization from being audit-ready.
          </p>

          {auditBlockers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              No major audit blockers detected.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {auditBlockers.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                  <div>{item}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">SPRS / SSP / POA&M Snapshot</h2>

          <div className="mt-4 space-y-4 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">CMMC Target</span>
              <span className="font-medium text-slate-900">{profile?.cmmc_level_target || "Level 2"}</span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">SPRS Score</span>
              <span className="font-medium text-slate-900">{profile?.sprs_score ?? "—"}</span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">SPRS Updated</span>
              <span className="font-medium text-slate-900">{formatDate(profile?.sprs_last_updated)}</span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">Assessment Status</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(profile?.assessment_status)}`}>
                {profile?.assessment_status || "Draft"}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">SSP</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(profile?.ssp_status)}`}>
                {profile?.ssp_status || "Draft"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">POA&M</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(profile?.poam_status)}`}>
                {profile?.poam_status || "Draft"}
              </span>
            </div>
          </div>

          <Link
            href="/cmmc-compliance/sprs-ssp-poam"
            className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Manage SPRS / SSP / POA&M
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Project Intake / Classification Review</h2>
            <p className="mt-1 text-sm text-slate-500">
              Audit view of intake determinations, routing requirements, and controlled research flags.
            </p>
          </div>

          <Link
            href="/project-intake"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Open Intake
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Reviews</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{projectIntakeReviews.length}</div>
          </div>

          <div className="rounded-xl border border-green-200 p-4">
            <div className="text-sm text-slate-500">Finalized</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{finalizedIntakes.length}</div>
          </div>

          <div className="rounded-xl border border-yellow-200 p-4">
            <div className="text-sm text-slate-500">Draft / In Review</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{draftOrInReviewIntakes.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">High Risk</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{highRiskIntakes.length}</div>
          </div>

          <div className="rounded-xl border border-amber-200 p-4">
            <div className="text-sm text-slate-500">CMMC Review</div>
            <div className="mt-2 text-3xl font-bold text-amber-600">{intakesRequiringCmmc.length}</div>
          </div>

          <div className="rounded-xl border border-amber-200 p-4">
            <div className="text-sm text-slate-500">TCP Required</div>
            <div className="mt-2 text-3xl font-bold text-amber-600">{intakesRequiringTcp.length}</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Routing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Determination</th>
                <th className="px-4 py-3">Report</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {projectIntakeReviews.slice(0, 10).map((review) => {
                const risk = getIntakeRiskLevel(review);

                return (
                  <tr key={review.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">
                        {review.project_title || "Untitled Intake"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {review.sponsor || "No sponsor"} • PI {review.principal_investigator || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(risk)}`}>
                        {risk}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {review.requires_eco_review && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                            ECO
                          </span>
                        )}
                        {review.requires_iso_review && (
                          <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700">
                            ISO
                          </span>
                        )}
                        {review.requires_fso_review && (
                          <span className="rounded-full bg-slate-900 px-2 py-1 text-xs text-white">
                            FSO
                          </span>
                        )}
                        {review.requires_cmmc_review && (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                            CMMC
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(review.review_status)}`}>
                        {review.review_status || "Draft"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {review.final_determination || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <Link
                        href={`/project-intake/${review.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {projectIntakeReviews.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No project intake reviews found.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Project-Level Audit Readiness</h2>
            <p className="mt-1 text-sm text-slate-500">
              Project-specific readiness using project compliance items, personnel, incidents, and remediation data.
            </p>
          </div>

          <Link
            href="/project-compliance"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Open Project Workspace
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No projects found.
            </div>
          ) : (
            projects.map((project, index) => {
              const projectName = getProjectName(project, index);
              const items = projectItemMap[project.id] || [];
              const complete = items.filter((item) => isCompleteStatus(item.status)).length;
              const readiness = percent(complete, items.length);
              const openItems = items.filter((item) => !isCompleteStatus(item.status));
              const overdueItems = items.filter((item) => isProjectItemOverdue(item));
              const evidenceMissing = items.filter(
                (item) =>
                  item.requires_evidence &&
                  !["provided", "referenced", "verified", "not applicable"].includes(
                    normalizeStatus(item.evidence_status)
                  )
              );

              const projectPersonnel = personnel.filter((person) => person.project_id === project.id);
              const projectPersonnelGaps = projectPersonnel.filter(
                (person) =>
                  !person.training_complete ||
                  !["cleared", "verified", "complete", "completed"].includes(
                    normalizeStatus(person.rps_screening_status)
                  ) ||
                  !person.secure_machine_name ||
                  normalizeStatus(person.secure_machine_status) !== "verified"
              );

              const projectIncidents = incidents.filter((incident) =>
                normalizeStatus(incident.project_name).includes(normalizeStatus(projectName))
              );

              const projectActions = correctiveActions.filter((action) =>
                normalizeStatus(action.related_project).includes(normalizeStatus(projectName))
              );

              return (
                <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{projectName}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {project.sponsor || "No sponsor"} • {project.status || "Pending"} •{" "}
                        {project.classification || "Classification TBD"} •{" "}
                        {project.export_control_type || "Export TBD"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">{readiness}%</div>
                      <div className="text-xs text-slate-500">Project readiness</div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${readiness}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="font-semibold text-slate-900">{items.length}</div>
                      <div className="text-xs text-slate-500">Items</div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="font-semibold text-red-600">{openItems.length}</div>
                      <div className="text-xs text-slate-500">Open</div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="font-semibold text-red-600">{overdueItems.length}</div>
                      <div className="text-xs text-slate-500">Overdue</div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="font-semibold text-amber-600">{evidenceMissing.length}</div>
                      <div className="text-xs text-slate-500">Evidence Refs Missing</div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="font-semibold text-red-600">{projectPersonnelGaps.length}</div>
                      <div className="text-xs text-slate-500">Personnel Gaps</div>
                    </div>
                  </div>

                  {(projectIncidents.length > 0 || projectActions.length > 0) && (
                    <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      {projectIncidents.length} incident(s) and {projectActions.length} corrective action(s) reference this project.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">CMMC Control Families</h2>
          <p className="mt-1 text-sm text-slate-500">
            Control family coverage with mapped policies and open items.
          </p>

          <div className="mt-4 space-y-2">
            {families.map((family) => (
              <div
                key={family.code}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
              >
                <div>
                  <div className="font-medium text-slate-900">
                    {family.code} — {family.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {familyDocumentCounts[family.code] || 0} mapped document(s)
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {family.total_controls}
                  </div>
                  <div className="text-xs text-slate-500">
                    {familyOpenDocumentCounts[family.code] || 0} open
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Policy / Evidence Matrix</h2>
              <p className="mt-1 text-sm text-slate-500">
                Assessor-facing summary of key policies and readiness status.
              </p>
            </div>

            <Link
              href="/cmmc-compliance/policies"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View Policies
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Policy / Document</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.slice(0, 10).map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{doc.document_name}</div>
                      <div className="text-xs text-slate-500">{doc.document_type || "Policy"}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{doc.control_family_code || "—"}</td>
                    <td className="px-4 py-4 text-slate-700">{doc.owner || "Unassigned"}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(doc.status)}`}>
                        {doc.status || "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(doc.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {documents.length === 0 && (
            <div className="mt-4 text-sm text-slate-500">No policy records found.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Personnel Readiness</h2>
            <Link href="/personnel" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-600">Training Complete</span>
              <span className="font-medium text-slate-900">
                {personnelTrainingComplete.length} / {personnel.length}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-600">Screening Gaps</span>
              <span className="font-medium text-red-600">{personnelScreeningIncomplete.length}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Machine Gaps</span>
              <span className="font-medium text-red-600">{personnelMachineIncomplete.length}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {personnelTrainingIncomplete.slice(0, 4).map((person) => (
              <div key={person.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                {displayPersonName(person)} — training incomplete
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Incident Review</h2>
            <Link href="/incident-reporting" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-600">Open Incidents</span>
              <span className="font-medium text-slate-900">{openIncidents.length}</span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-600">High Risk</span>
              <span className="font-medium text-red-600">{highRiskIncidents.length}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Sensitive / Controlled</span>
              <span className="font-medium text-amber-600">{sensitiveIncidents.length}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {incidents.slice(0, 4).map((incident) => (
              <Link
                key={incident.id}
                href={`/incident-reporting/${incident.id}`}
                className="block rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{incident.title || "Untitled Incident"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {incident.severity || "Medium"} • {incident.incident_status || "Draft"}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">POA&M Review</h2>
            <Link href="/corrective-actions" className="text-sm font-medium text-blue-600">
              View
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-600">Open Actions</span>
              <span className="font-medium text-slate-900">{openActions.length}</span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-600">Overdue</span>
              <span className="font-medium text-red-600">{overdueActions.length}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-600">High Risk</span>
              <span className="font-medium text-amber-600">{highRiskActions.length}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {correctiveActions.slice(0, 4).map((action) => (
              <div key={action.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-900">{action.title || "Untitled Action"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {action.status || "Open"} • Due {formatDate(action.due_date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Audit Mode is intended to provide an assessor-style readiness view. Sensitive evidence,
        CUI, enclave diagrams, vulnerability reports, firewall configurations, SSP internals, and
        technical configurations should remain in approved secure repositories and be referenced
        through RCOS rather than uploaded directly.
      </div>
    </div>
  );
}