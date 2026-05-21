import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type PolicyDocument = {
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

  if (["complete", "approved", "verified", "audit ready"].includes(normalized)) {
    return "bg-green-100 text-green-700";
  }

  if (["partial", "pending", "in progress"].includes(normalized)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["missing", "expired"].includes(normalized)) {
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

export default async function PoliciesPage() {
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

  const policies: PolicyDocument[] = (data ?? []) as PolicyDocument[];

  const missingCount = policies.filter(
    (p) => String(p.status || "").toLowerCase() === "missing"
  ).length;

  const draftCount = policies.filter(
    (p) => String(p.status || "").toLowerCase() === "draft"
  ).length;

  const approvedCount = policies.filter((p) =>
    ["approved", "complete", "verified"].includes(
      String(p.status || "").toLowerCase()
    )
  ).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Policies</h1>

        <p className="mt-1 text-slate-600">
          Centralized policy and procedural documentation mapped to CMMC
          control families and readiness status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Missing Policies</div>

          <div className="mt-2 text-4xl font-bold text-red-600">
            {missingCount}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Draft Policies</div>

          <div className="mt-2 text-4xl font-bold text-yellow-600">
            {draftCount}
          </div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Approved Policies</div>

          <div className="mt-2 text-4xl font-bold text-green-600">
            {approvedCount}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">
            Policy Library
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4">Policy</th>
                <th className="px-6 py-4">Control Area</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Owner</th>
                <th className="px-6 py-4">Updated</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {policies.map((policy) => (
                <tr
                  key={policy.id}
                  className="transition hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {policy.document_name}
                    </div>

                    <div className="text-sm text-slate-500">
                      {policy.document_type || "Policy"}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      {policy.control_family_code || "N/A"}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getBadgeClass(
                        policy.status
                      )}`}
                    >
                      {policy.status || "Draft"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {policy.owner || "Unassigned"}
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {formatDate(policy.last_updated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}