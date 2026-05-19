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

function getBadgeClass(status?: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (["complete", "completed", "approved", "signed", "verified"].includes(normalized)) {
    return "bg-green-100 text-green-700";
  }

  if (["in progress", "pending", "partial"].includes(normalized)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["missing", "overdue", "expired"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default async function CmmcDocumentsPage() {
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">CMMC Documents</h1>
        <p className="mt-1 text-slate-600">
          Manage policies, procedures, SSP, POA&M, and supporting evidence documents.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Document Library</h2>
          <Link href="/cmmc-compliance" className="text-sm font-medium text-blue-600">
            Back to CMMC Controls
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Document Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{doc.document_name}</td>
                  <td className="px-4 py-4 text-slate-600">{doc.document_type || "Policy"}</td>
                  <td className="px-4 py-4 text-slate-600">{doc.control_family_code || "—"}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                        doc.status
                      )}`}
                    >
                      {doc.status || "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{doc.owner || "Unassigned"}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(doc.last_updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {documents.length === 0 && (
          <div className="mt-4 text-sm text-slate-500">No CMMC documents found.</div>
        )}
      </div>
    </div>
  );
}