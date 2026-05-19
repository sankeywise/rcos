import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  return ["complete", "completed", "approved", "signed", "verified", "audit ready"].includes(
    normalizeStatus(value)
  );
}

export default async function CmmcReportsPage() {
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
    return <div className="p-6 text-red-600">No organization membership found.</div>;
  }

  const { data } = await supabase
    .from("cmmc_documents")
    .select("id, status")
    .eq("organization_id", membership.organization_id);

  const documents = data ?? [];
  const complete = documents.filter((doc) => isCompleteStatus(doc.status)).length;
  const open = documents.length - complete;
  const readiness = documents.length === 0 ? 0 : Math.round((complete / documents.length) * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">CMMC Reports</h1>
        <p className="mt-1 text-slate-600">
          Generate readiness reports, evidence gap reports, and audit preparation summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Document Readiness</div>
          <div className="mt-2 text-5xl font-bold text-blue-600">{readiness}%</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Complete Documents</div>
          <div className="mt-2 text-5xl font-bold text-green-600">{complete}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Open Items</div>
          <div className="mt-2 text-5xl font-bold text-red-600">{open}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Available Reports</h2>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div>
              <div className="font-medium text-slate-900">Readiness Summary Report</div>
              <div className="text-sm text-slate-500">Overall compliance readiness and status snapshot.</div>
            </div>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white">
              Generate
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div>
              <div className="font-medium text-slate-900">Evidence Gap Report</div>
              <div className="text-sm text-slate-500">Open evidence gaps by document and control family.</div>
            </div>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white">
              Generate
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div>
              <div className="font-medium text-slate-900">Audit Preparation Report</div>
              <div className="text-sm text-slate-500">Assessor-ready readiness summary and supporting evidence list.</div>
            </div>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white">
              Generate
            </button>
          </div>
        </div>

        <Link
          href="/cmmc-compliance"
          className="mt-6 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Back to CMMC Controls
        </Link>
      </div>
    </div>
  );
}