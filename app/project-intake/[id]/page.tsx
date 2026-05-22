import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import PrintButton from "./print-button";

type IntakeReview = {
  id: number;
  project_id: number | null;
  project_title: string;
  sponsor: string | null;
  principal_investigator: string | null;
  department: string | null;

  review_status: string | null;
  review_owner: string | null;
  review_date: string | null;

  involves_dod: boolean | null;
  involves_federal_sponsor: boolean | null;
  involves_cui: boolean | null;
  involves_export_control: boolean | null;
  involves_itar: boolean | null;
  involves_ear: boolean | null;
  involves_noforn: boolean | null;
  involves_foreign_nationals: boolean | null;
  involves_international_collaboration: boolean | null;
  involves_controlled_technical_data: boolean | null;
  involves_secure_enclave: boolean | null;

  requires_tcp: boolean | null;
  requires_rps: boolean | null;
  requires_cmmc_review: boolean | null;
  requires_secure_machine_access: boolean | null;
  requires_fso_review: boolean | null;
  requires_iso_review: boolean | null;
  requires_eco_review: boolean | null;

  cui_category: string | null;
  export_control_summary: string | null;
  data_handling_summary: string | null;
  foreign_national_summary: string | null;
  secure_environment_summary: string | null;
  risk_summary: string | null;
  recommended_action: string | null;
  final_determination: string | null;
  determination_notes: string | null;

  created_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function yesNo(value?: boolean | null) {
  return value ? "Yes" : "No";
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
        {value || "—"}
      </div>
    </div>
  );
}

function BooleanField({
  label,
  value,
}: {
  label: string;
  value?: boolean | null;
}) {
  return <Field label={label} value={yesNo(value)} />;
}

function riskLevel(review: IntakeReview) {
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

function riskBadgeClass(value: string) {
  if (value === "High Risk") return "bg-red-100 text-red-700";
  if (value === "Moderate Risk") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

export default async function ProjectIntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
      <div className="p-6 text-red-600">
        No organization membership found.
      </div>
    );
  }

  const { data, error } = await supabase
    .from("project_intake_reviews")
    .select("*")
    .eq("id", Number(id))
    .eq("organization_id", membership.organization_id)
    .single();

  if (error || !data) {
    return (
      <div className="p-6 text-red-600">
        Project intake review not found.
      </div>
    );
  }

  const review = data as IntakeReview;
  const risk = riskLevel(review);

  return (
    <div className="space-y-6 print:bg-white">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Project Intake Determination Report
            </h1>
            <p className="mt-1 text-slate-600">{review.project_title}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${riskBadgeClass(risk)}`}>
                {risk}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {review.review_status || "Draft"}
              </span>

              {review.involves_cui && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                  CUI
                </span>
              )}

              {review.involves_itar && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                  ITAR
                </span>
              )}

              {review.involves_ear && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                  EAR
                </span>
              )}

              {review.involves_noforn && (
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                  NOFORN
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 print:hidden">
            <Link
              href="/project-intake"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </Link>

            <PrintButton />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Project Information
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Project Title" value={review.project_title} />
          <Field label="Sponsor" value={review.sponsor} />
          <Field label="Principal Investigator" value={review.principal_investigator} />
          <Field label="Department" value={review.department} />
          <Field label="Review Owner" value={review.review_owner} />
          <Field label="Review Date" value={formatDate(review.review_date)} />
          <Field label="Created" value={formatDate(review.created_at)} />
          <Field label="Linked Project ID" value={review.project_id ? String(review.project_id) : "—"} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Classification Indicators
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <BooleanField label="Involves DoD" value={review.involves_dod} />
          <BooleanField label="Federal Sponsor" value={review.involves_federal_sponsor} />
          <BooleanField label="Involves CUI" value={review.involves_cui} />
          <BooleanField label="Export Control Concern" value={review.involves_export_control} />
          <BooleanField label="ITAR" value={review.involves_itar} />
          <BooleanField label="EAR" value={review.involves_ear} />
          <BooleanField label="NOFORN" value={review.involves_noforn} />
          <BooleanField label="Foreign Nationals Involved" value={review.involves_foreign_nationals} />
          <BooleanField label="International Collaboration" value={review.involves_international_collaboration} />
          <BooleanField label="Controlled Technical Data" value={review.involves_controlled_technical_data} />
          <BooleanField label="Secure Enclave Required" value={review.involves_secure_enclave} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Required Reviews / Safeguards
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <BooleanField label="Technology Control Plan Required" value={review.requires_tcp} />
          <BooleanField label="Restricted Party Screening Required" value={review.requires_rps} />
          <BooleanField label="CMMC Review Required" value={review.requires_cmmc_review} />
          <BooleanField label="Secure Machine Access Required" value={review.requires_secure_machine_access} />
          <BooleanField label="FSO Review Required" value={review.requires_fso_review} />
          <BooleanField label="ISO Review Required" value={review.requires_iso_review} />
          <BooleanField label="ECO Review Required" value={review.requires_eco_review} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Review Summaries
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="CUI Category" value={review.cui_category} />
          <Field label="Export Control Summary" value={review.export_control_summary} />
          <Field label="Data Handling Summary" value={review.data_handling_summary} />
          <Field label="Foreign National Summary" value={review.foreign_national_summary} />
          <Field label="Secure Environment Summary" value={review.secure_environment_summary} />
          <Field label="Risk Summary" value={review.risk_summary} />
          <Field label="Recommended Action" value={review.recommended_action} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Final Determination
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="System-Rated Risk Level" value={risk} />
          <Field label="Final Determination" value={review.final_determination} />
          <Field label="Determination Notes" value={review.determination_notes} />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 print:hidden">
        This determination report is intended to capture routing decisions and compliance review metadata.
        Sensitive evidence, CUI contents, enclave architecture, controlled technical data, vulnerability information,
        and configuration details should remain in approved secure repositories.
      </div>
    </div>
  );
}