import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type CmmcProfile = {
  id: number;
  organization_id: string;
  enclave_name: string | null;
  cmmc_level_target: string | null;
  sprs_score: number | null;
  sprs_last_updated: string | null;
  assessment_status: string | null;
  ssp_status: string | null;
  poam_status: string | null;
  notes: string | null;
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

export default async function SprsSspPoamPage() {
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
    .from("cmmc_compliance_profiles")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  const profile: CmmcProfile | null = (data as CmmcProfile | null) ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">SPRS / SSP / POA&M</h1>
        <p className="mt-1 text-slate-600">
          Track SPRS score, System Security Plan status, POA&M status, target CMMC level, and assessment readiness.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">SPRS Score</div>
          <div className="mt-2 text-5xl font-bold text-slate-900">{profile?.sprs_score ?? "—"}</div>
          <div className="mt-2 text-xs text-slate-500">
            Last updated {formatDate(profile?.sprs_last_updated)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">SSP Status</div>
          <div className="mt-4">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${getBadgeClass(
                profile?.ssp_status
              )}`}
            >
              {profile?.ssp_status || "Draft"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">POA&M Status</div>
          <div className="mt-4">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${getBadgeClass(
                profile?.poam_status
              )}`}
            >
              {profile?.poam_status || "Draft"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Assessment Profile</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">CMMC Target</div>
            <div className="mt-1 font-semibold text-slate-900">
              {profile?.cmmc_level_target || "Level 2"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Assessment Status</div>
            <div className="mt-1 font-semibold text-slate-900">
              {profile?.assessment_status || "In Progress"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Enclave Name</div>
            <div className="mt-1 font-semibold text-slate-900">
              {profile?.enclave_name || "Not entered"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Notes</div>
            <div className="mt-1 text-sm text-slate-700">{profile?.notes || "No notes entered."}</div>
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