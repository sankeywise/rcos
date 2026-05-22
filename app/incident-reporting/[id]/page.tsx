import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import PrintButton from "./print-button";

type IncidentReport = {
  id: number;
  title: string;
  incident_status: string | null;
  severity: string | null;
  incident_type: string | null;
  discovered_date: string | null;
  discovered_time: string | null;
  reported_by: string | null;
  department: string | null;
  project_name: string | null;

  involves_cui: boolean;
  involves_itar: boolean;
  involves_ear: boolean;
  involves_pii: boolean;
  cyber_related: boolean;
  unauthorized_access: boolean;
  wrong_recipient: boolean;
  downloaded_printed_transferred: boolean;

  what_happened: string | null;
  how_discovered: string | null;
  who_involved: string | null;
  affected_system_or_environment: string | null;
  information_involved: string | null;

  immediate_actions: string | null;
  access_revoked: boolean;
  it_security_notified: boolean;
  iso_notified: boolean;
  fso_notified: boolean;
  eco_notified: boolean;
  sponsor_notified: boolean;
  file_deleted_or_quarantined: boolean;
  evidence_preserved: boolean;

  affected_records_count: string | null;
  affected_data_type: string | null;
  affected_project_or_sponsor: string | null;
  potential_reporting_obligation: string | null;
  follow_up_required: boolean;

  root_cause: string | null;
  corrective_action_required: string | null;
  corrective_action_owner: string | null;
  corrective_action_due_date: string | null;
  closure_notes: string | null;
  evidence_location: string | null;
  created_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function yesNo(value: boolean) {
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
  value: boolean;
}) {
  return <Field label={label} value={yesNo(value)} />;
}

export default async function IncidentReportDetailPage({
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
    .from("incident_reports")
    .select("*")
    .eq("id", Number(id))
    .eq("organization_id", membership.organization_id)
    .single();

  if (error || !data) {
    return (
      <div className="p-6 text-red-600">
        Incident report not found.
      </div>
    );
  }

  const report = data as IncidentReport;

  return (
    <div className="space-y-6 print:bg-white">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Incident Report
            </h1>

            <p className="mt-1 text-slate-600">{report.title}</p>
          </div>

          <div className="flex gap-2 print:hidden">
            <Link
              href="/incident-reporting"
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
          Basic Information
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Incident Title" value={report.title} />
          <Field label="Status" value={report.incident_status} />
          <Field label="Severity" value={report.severity} />
          <Field label="Incident Type" value={report.incident_type} />
          <Field label="Date Discovered" value={formatDate(report.discovered_date)} />
          <Field label="Time Discovered" value={report.discovered_time} />
          <Field label="Reported By" value={report.reported_by} />
          <Field label="Department" value={report.department} />
          <Field label="Project / Award" value={report.project_name} />
          <Field label="Created" value={formatDate(report.created_at)} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Classification Flags
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <BooleanField label="Involves CUI" value={report.involves_cui} />
          <BooleanField label="Involves ITAR" value={report.involves_itar} />
          <BooleanField label="Involves EAR" value={report.involves_ear} />
          <BooleanField label="Involves PII" value={report.involves_pii} />
          <BooleanField label="Cyber Related" value={report.cyber_related} />
          <BooleanField
            label="Unauthorized Access"
            value={report.unauthorized_access}
          />
          <BooleanField
            label="Wrong Recipient / Misdelivery"
            value={report.wrong_recipient}
          />
          <BooleanField
            label="Downloaded / Printed / Transferred"
            value={report.downloaded_printed_transferred}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Incident Description
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="What Happened" value={report.what_happened} />
          <Field label="How It Was Discovered" value={report.how_discovered} />
          <Field label="Who Was Involved" value={report.who_involved} />
          <Field
            label="Affected System / Environment"
            value={report.affected_system_or_environment}
          />
          <Field
            label="Information Involved"
            value={report.information_involved}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Containment / Response
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field
            label="Immediate Actions Taken"
            value={report.immediate_actions}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <BooleanField label="Access Revoked" value={report.access_revoked} />
          <BooleanField
            label="IT / Security Notified"
            value={report.it_security_notified}
          />
          <BooleanField label="ISO Notified" value={report.iso_notified} />
          <BooleanField label="FSO Notified" value={report.fso_notified} />
          <BooleanField label="ECO Notified" value={report.eco_notified} />
          <BooleanField
            label="Sponsor / POC Notified"
            value={report.sponsor_notified}
          />
          <BooleanField
            label="File / Email Deleted or Quarantined"
            value={report.file_deleted_or_quarantined}
          />
          <BooleanField
            label="Evidence Preserved"
            value={report.evidence_preserved}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Impact Assessment
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Affected Records / Files"
            value={report.affected_records_count}
          />
          <Field
            label="Affected Data Type"
            value={report.affected_data_type}
          />
          <Field
            label="Affected Project / Sponsor"
            value={report.affected_project_or_sponsor}
          />
          <Field
            label="Potential Reporting Obligation"
            value={report.potential_reporting_obligation}
          />
          <BooleanField
            label="Follow-Up Required"
            value={report.follow_up_required}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-xl font-semibold text-slate-900">
          Corrective Action
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="Root Cause" value={report.root_cause} />
          <Field
            label="Corrective Action Required"
            value={report.corrective_action_required}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Corrective Action Owner"
            value={report.corrective_action_owner}
          />
          <Field
            label="Corrective Action Due Date"
            value={formatDate(report.corrective_action_due_date)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="Closure Notes" value={report.closure_notes} />
          <Field
            label="Evidence Location / Reference"
            value={report.evidence_location}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 print:hidden">
        This report is intended as an internal compliance incident report.
        Sensitive evidence should remain in the appropriate secure system or
        enclave repository and be referenced here by location or ticket number.
      </div>
    </div>
  );
}