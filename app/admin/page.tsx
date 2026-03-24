import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, tenant_role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!membership) {
    redirect("/");
  }

  if (membership.tenant_role !== "tenant_admin") {
    redirect("/");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.organization_id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Admin</h1>
        <p className="text-slate-500 mt-1">
          Manage system configuration and compliance settings for{" "}
          <span className="font-medium text-slate-700">
            {organization?.name || "your organization"}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Training Requirements
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Configure required compliance training.
          </p>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Configure Training
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Artifact Policies
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Define required documentation.
          </p>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Manage Policies
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            System Controls
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Configure organization-level compliance settings.
          </p>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Review Settings
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800">
          System Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Classification
            </label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 bg-white">
              <option>CUI</option>
              <option>Export Controlled</option>
              <option>Proprietary</option>
              <option>Public</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Compliance Review Cycle
            </label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 bg-white">
              <option>Annual</option>
              <option>Semi-Annual</option>
              <option>Quarterly</option>
              <option>Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Document Retention
            </label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 bg-white">
              <option>1 Year</option>
              <option>3 Years</option>
              <option>5 Years</option>
              <option>7 Years</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}