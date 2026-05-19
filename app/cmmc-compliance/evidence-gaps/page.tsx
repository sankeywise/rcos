import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type CmmcDocument = {
  id: number;
  organization_id: string;
  document_name: string;
  document_type: string | null;
  control_family_code: string | null;
  status: string | null;
  owner: string | null;
  last_updated: string | null;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  return ["complete", "completed", "approved", "signed", "verified", "audit ready"].includes(
    normalizeStatus(value)
  );
}

function getBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (isCompleteStatus(status)) return "bg-green-100 text-green-700";
  if (normalized === "in progress" || normalized === "pending" || normalized === "partial") {
    return "bg-blue-100 text-blue-700";
  }
  if (normalized === "missing" || normalized === "overdue") return "bg-red-100 text-red-700";

  return "bg-yellow-100 text-yellow-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default async function EvidenceGapsPage() {
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
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("document_name", { ascending: true });

  const documents: CmmcDocument[] = (data ?? []) as CmmcDocument[];

  const evidenceGaps = documents.filter((doc) => !isCompleteStatus(doc.status));
  const missing = evidenceGaps.filter((doc) => normalizeStatus(doc.status) === "missing");
  const partial = evidenceGaps.filter((doc) =>
    ["partial", "pending", "in progress", "draft"].includes(normalizeStatus(doc.status))
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Evidence Gaps</h1>
        <p className="mt-1 text-slate-600">
          Missing, partial, and incomplete evidence across CMMC/NIST readiness documents.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Total Evidence Gaps</div>
          <div className="mt-2 text-4xl font-bold text-red-600">{evidenceGaps.length}</div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Missing</div>
          <div className="mt-2 text-4xl font-bold text-red-600">{missing.length}</div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Partial / Draft</div>
          <div className="mt-2 text-4xl font-bold text-yellow-600">{partial.length}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Open Evidence Items</h2>
          <Link href="/cmmc-compliance" className="text-sm font-medium text-blue-600">
            Back to CMMC Controls
          </Link>
        </div>

        {evidenceGaps.length === 0 ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            No evidence gaps found.
          </div>
        ) : (
          <div className="space-y-3">
            {evidenceGaps.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <div className="font-medium text-slate-900">{doc.document_name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {doc.document_type || "Document"} • Area {doc.control_family_code || "—"} • Owner{" "}
                    {doc.owner || "Unassigned"} • Updated {formatDate(doc.last_updated)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                      doc.status
                    )}`}
                  >
                    {doc.status || "Draft"}
                  </span>

                  <Link
                    href="/cmmc-compliance/documents"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    Upload Evidence
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}