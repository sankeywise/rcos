import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import PrintButton from "./print-button";

type ProjectRow = {
  id: number;
  project_name: string | null;
  sponsor: string | null;
  status: string | null;
  classification: string | null;
  environment: string | null;
  export_control_type: string | null;
};

type ProjectIntakeReview = {
  id: number;
  project_title: string | null;
  sponsor: string | null;
  principal_investigator: string | null;
  review_status: string | null;
  final_determination: string | null;
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
  created_at: string | null;
};

type ProjectComplianceItem = {
  id: number;
  project_id: number;
  item_name: string | null;
  item_type: string | null;
  status: string | null;
  owner: string | null;
  due_date: string | null;
  requires_evidence: boolean | null;
  evidence_status: string | null;
};

type CmmcDocument = {
  id: number;
  document_name: string;
  document_type: string | null;
  control_family_code: string | null;
  status: string | null;
  owner: string | null;
  last_updated: string | null;
};

type PersonnelRow = {
  id: number;
  name: string | null;
  full_name: string | null;
  project_id: number | null;
  training_complete: boolean | null;
  citizenship_status: string | null;
  rps_screening_status: string | null;
  secure_machine_name: string | null;
  secure_machine_status: string | null;
};

type IncidentReport = {
  id: number;
  title: string | null;
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
};

type CmmcProfile = {
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

function getProjectName(project: ProjectRow) {
  return project.project_name && project.project_name.trim().length > 0
    ? project.project_name
    : `Unnamed Project ${project.id}`;
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

function Badge({ value }: { value?: string | null }) {
  const normalized = normalizeStatus(value);

  let classes = "bg-slate-100 text-slate-700";

  if (isCompleteStatus(value)) {
    classes = "bg-green-100 text-green-700";
  } else if (
    [
      "draft",
      "pending",
      "in progress",
      "open",
      "partial",
      "in review",
      "requires review",
      "moderate risk",
      "provided",
      "referenced",
    ].includes(normalized)
  ) {
    classes = "bg-yellow-100 text-yellow-700";
  } else if (
    [
      "missing",
      "overdue",
      "expired",
      "non-compliant",
      "high",
      "critical",
      "high risk",
      "not approved",
      "restricted",
      "not started",
      "not provided",
    ].includes(normalized)
  ) {
    classes = "bg-red-100 text-red-700";
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {value || "—"}
    </span>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid print:shadow-none">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AuditPackagePage() {
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

  const projectsResult = await supabase
    .from("projects")
    .select("id, project_name, sponsor, status, classification, environment, export_control_type")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const intakeResult = await supabase
    .from("project_intake_reviews")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const complianceItemsResult = await supabase
    .from("project_compliance_items")
    .select("id, project_id, item_name, item_type, status, owner, due_date, requires_evidence, evidence_status")
    .eq("organization_id", orgId)
    .order("project_id", { ascending: true });

  const documentsResult = await supabase
    .from("cmmc_documents")
    .select("id, document_name, document_type, control_family_code, status, owner, last_updated")
    .eq("organization_id", orgId)
    .order("document_name", { ascending: true });

  const personnelResult = await supabase
    .from("personnel")
    .select("id, name, full_name, project_id, training_complete, citizenship_status, rps_screening_status, secure_machine_name, secure_machine_status")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const incidentsResult = await supabase
    .from("incident_reports")
    .select("id, title, incident_status, severity, involves_cui, involves_itar, involves_ear, involves_pii, cyber_related, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const actionsResult = await supabase
    .from("corrective_actions")
    .select("id, title, status, severity, owner, due_date")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const profileResult = await supabase
    .from("cmmc_compliance_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const intakeReviews: ProjectIntakeReview[] =
    (intakeResult.data ?? []) as ProjectIntakeReview[];
  const complianceItems: ProjectComplianceItem[] =
    (complianceItemsResult.data ?? []) as ProjectComplianceItem[];
  const documents: CmmcDocument[] = (documentsResult.data ?? []) as CmmcDocument[];
  const personnel: PersonnelRow[] = (personnelResult.data ?? []) as PersonnelRow[];
  const incidents: IncidentReport[] = (incidentsResult.data ?? []) as IncidentReport[];
  const correctiveActions: CorrectiveAction[] =
    (actionsResult.data ?? []) as CorrectiveAction[];
  const profile: CmmcProfile | null = (profileResult.data as CmmcProfile | null) ?? null;

  const finalizedIntakes = intakeReviews.filter((review) => isIntakeFinal(review));
  const draftOrInReviewIntakes = intakeReviews.filter((review) =>
    ["draft", "pending", "in review", "requires review"].includes(
      normalizeStatus(review.review_status)
    )
  );
  const highRiskIntakes = intakeReviews.filter(
    (review) => getIntakeRiskLevel(review) === "High Risk"
  );

  const completeDocuments = documents.filter((doc) => isCompleteStatus(doc.status));
  const openDocuments = documents.filter((doc) => !isCompleteStatus(doc.status));

  const completeComplianceItems = complianceItems.filter((item) =>
    isCompleteStatus(item.status)
  );
  const openComplianceItems = complianceItems.filter(
    (item) => !isCompleteStatus(item.status)
  );
  const overdueComplianceItems = complianceItems.filter((item) =>
    isProjectItemOverdue(item)
  );
  const missingEvidenceReferences = complianceItems.filter(
    (item) =>
      item.requires_evidence &&
      !["provided", "referenced", "verified", "not applicable"].includes(
        normalizeStatus(item.evidence_status)
      )
  );

  const trainingComplete = personnel.filter((person) => person.training_complete);
  const trainingIncomplete = personnel.filter((person) => !person.training_complete);
  const screeningIncomplete = personnel.filter(
    (person) =>
      !["cleared", "verified", "complete", "completed"].includes(
        normalizeStatus(person.rps_screening_status)
      )
  );
  const machineIncomplete = personnel.filter(
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

  const openActions = correctiveActions.filter(
    (action) => !isCorrectiveActionClosed(action)
  );
  const overdueActions = correctiveActions.filter((action) =>
    isCorrectiveActionOverdue(action)
  );
  const highRiskActions = correctiveActions.filter((action) =>
    ["high", "critical"].includes(normalizeStatus(action.severity))
  );

  const checks = [
    Boolean(profile),
    typeof profile?.sprs_score === "number",
    isCompleteStatus(profile?.ssp_status),
    isCompleteStatus(profile?.poam_status),
    isCompleteStatus(profile?.incident_response_status),
    isCompleteStatus(profile?.access_control_status),
    intakeReviews.length > 0,
    highRiskIntakes.length === 0,
    draftOrInReviewIntakes.length === 0,
    documents.length > 0 && openDocuments.length === 0,
    projects.length > 0,
    complianceItems.length > 0,
    overdueComplianceItems.length === 0,
    missingEvidenceReferences.length === 0,
    personnel.length > 0 && trainingIncomplete.length === 0,
    personnel.length > 0 && screeningIncomplete.length === 0,
    personnel.length > 0 && machineIncomplete.length === 0,
    highRiskIncidents.length === 0,
    overdueActions.length === 0,
    highRiskActions.length === 0,
  ];

  const readinessScore = percent(checks.filter(Boolean).length, checks.length);

  const generatedDate = new Date().toLocaleDateString();

  return (
    <div className="space-y-6 print:bg-white">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              RCOS Audit Package
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Controlled Research Readiness Report
            </h1>
            <p className="mt-1 text-slate-600">
              Generated {generatedDate}. This report summarizes readiness metadata,
              intake determinations, project compliance status, personnel readiness,
              incidents, POA&M, and key CMMC posture indicators.
            </p>
          </div>

          <div className="flex gap-2 print:hidden">
            <Link
              href="/audit-mode"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      <ReportSection title="Executive Summary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Readiness</div>
            <div className="mt-2 text-4xl font-bold text-blue-600">{readinessScore}%</div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Projects</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{projects.length}</div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Intake Reviews</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{intakeReviews.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">High-Risk Intake</div>
            <div className="mt-2 text-4xl font-bold text-red-600">{highRiskIntakes.length}</div>
          </div>

          <div className="rounded-xl border border-amber-200 p-4">
            <div className="text-sm text-slate-500">Open POA&M</div>
            <div className="mt-2 text-4xl font-bold text-amber-600">{openActions.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">Overdue Items</div>
            <div className="mt-2 text-4xl font-bold text-red-600">
              {overdueComplianceItems.length + overdueActions.length}
            </div>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="SPRS / SSP / POA&M Snapshot">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">CMMC Target</div>
            <div className="mt-2 font-semibold text-slate-900">
              {profile?.cmmc_level_target || "Level 2"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">SPRS Score</div>
            <div className="mt-2 font-semibold text-slate-900">
              {profile?.sprs_score ?? "—"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">SPRS Last Updated</div>
            <div className="mt-2 font-semibold text-slate-900">
              {formatDate(profile?.sprs_last_updated)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Assessment Status</div>
            <div className="mt-2">
              <Badge value={profile?.assessment_status || "Draft"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">SSP</div>
            <div className="mt-2">
              <Badge value={profile?.ssp_status || "Draft"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">POA&M</div>
            <div className="mt-2">
              <Badge value={profile?.poam_status || "Draft"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Incident Response</div>
            <div className="mt-2">
              <Badge value={profile?.incident_response_status || "Draft"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Scoping</div>
            <div className="mt-2">
              <Badge value={profile?.scoping_status || "Draft"} />
            </div>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="Project Intake / Classification Summary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{intakeReviews.length}</div>
          </div>

          <div className="rounded-xl border border-green-200 p-4">
            <div className="text-sm text-slate-500">Finalized</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{finalizedIntakes.length}</div>
          </div>

          <div className="rounded-xl border border-yellow-200 p-4">
            <div className="text-sm text-slate-500">Draft / In Review</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">
              {draftOrInReviewIntakes.length}
            </div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">High Risk</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{highRiskIntakes.length}</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">PI</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Determination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {intakeReviews.slice(0, 10).map((review) => (
                <tr key={review.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {review.project_title || "Untitled Intake"}
                    </div>
                    <div className="text-xs text-slate-500">{review.sponsor || "No sponsor"}</div>
                  </td>
                  <td className="px-4 py-3">{review.principal_investigator || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge value={getIntakeRiskLevel(review)} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={review.review_status || "Draft"} />
                  </td>
                  <td className="px-4 py-3">{review.final_determination || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {intakeReviews.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No intake reviews found.</div>
          )}
        </div>
      </ReportSection>

      <ReportSection title="Project Compliance Summary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Items</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{complianceItems.length}</div>
          </div>

          <div className="rounded-xl border border-green-200 p-4">
            <div className="text-sm text-slate-500">Complete</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{completeComplianceItems.length}</div>
          </div>

          <div className="rounded-xl border border-yellow-200 p-4">
            <div className="text-sm text-slate-500">Open</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{openComplianceItems.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">Evidence Missing</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{missingEvidenceReferences.length}</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {projects.map((project) => {
            const items = complianceItems.filter((item) => item.project_id === project.id);
            const complete = items.filter((item) => isCompleteStatus(item.status)).length;
            const readiness = percent(complete, items.length);

            return (
              <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{getProjectName(project)}</div>
                    <div className="text-xs text-slate-500">
                      {project.sponsor || "No sponsor"} • {project.classification || "Unclassified"} •{" "}
                      {project.environment || "No environment"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">{readiness}%</div>
                    <div className="text-xs text-slate-500">
                      {complete} of {items.length} complete
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ReportSection>

      <ReportSection title="Policies / CMMC Documents">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Documents</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{documents.length}</div>
          </div>

          <div className="rounded-xl border border-green-200 p-4">
            <div className="text-sm text-slate-500">Complete</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{completeDocuments.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">Open / Draft</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{openDocuments.length}</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.slice(0, 12).map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{doc.document_name}</div>
                    <div className="text-xs text-slate-500">{doc.document_type || "Policy"}</div>
                  </td>
                  <td className="px-4 py-3">{doc.control_family_code || "—"}</td>
                  <td className="px-4 py-3">{doc.owner || "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <Badge value={doc.status || "Draft"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection title="Personnel Readiness">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Personnel</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{personnel.length}</div>
          </div>

          <div className="rounded-xl border border-green-200 p-4">
            <div className="text-sm text-slate-500">Training Complete</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{trainingComplete.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">Screening Gaps</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{screeningIncomplete.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">Machine Gaps</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{machineIncomplete.length}</div>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="Incidents and POA&M">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Open Incidents</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{openIncidents.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">High-Risk Incidents</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{highRiskIncidents.length}</div>
          </div>

          <div className="rounded-xl border border-yellow-200 p-4">
            <div className="text-sm text-slate-500">Open POA&M</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{openActions.length}</div>
          </div>

          <div className="rounded-xl border border-red-200 p-4">
            <div className="text-sm text-slate-500">Overdue POA&M</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{overdueActions.length}</div>
          </div>
        </div>
      </ReportSection>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 print:hidden">
        This audit package is a readiness summary and should not contain CUI, enclave diagrams,
        vulnerabilities, controlled technical details, passwords, configuration details, or other sensitive evidence.
        Store sensitive evidence only in approved secure repositories.
      </div>
    </div>
  );
}