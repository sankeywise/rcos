import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";

async function createProject(formData: FormData) {
  "use server";

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
    throw new Error("No active organization membership found.");
  }

  const name = String(formData.get("name") || "").trim();
  const sponsor = String(formData.get("sponsor") || "").trim();
  const classification = String(formData.get("classification") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const environment = String(formData.get("environment") || "").trim();

  if (!name || !sponsor || !classification || !status || !environment) {
    throw new Error("All fields are required.");
  }

  const { error } = await supabase.from("projects").insert([
    {
      organization_id: membership.organization_id,
      name,
      sponsor,
      classification,
      status,
      environment,
      created_by: user.id,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/projects");
}

export default function NewProjectPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="mb-2">
          <Link
            href="/projects"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Projects
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-800">New Project</h1>
        <p className="text-slate-600 mt-1">
          Create a new controlled research project for this organization
        </p>
      </div>

      <form
        action={createProject}
        className="bg-white rounded-xl shadow p-6 space-y-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Project Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="AI Radar Modernization"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 placeholder:text-slate-400"
            required
          />
        </div>

        <div>
          <label
            htmlFor="sponsor"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Sponsor
          </label>
          <input
            id="sponsor"
            name="sponsor"
            type="text"
            placeholder="DoD, NASA, Army, DARPA"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 placeholder:text-slate-400"
            required
          />
        </div>

        <div>
          <label
            htmlFor="classification"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Classification
          </label>
          <select
            id="classification"
            name="classification"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-white"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select classification
            </option>
            <option value="CUI">CUI</option>
            <option value="ITAR">ITAR</option>
            <option value="Export Controlled">Export Controlled</option>
            <option value="EAR">EAR</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-white"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select status
            </option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="environment"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Environment
          </label>
          <input
            id="environment"
            name="environment"
            type="text"
            placeholder="Secure Lab, Restricted Network, Controlled Facility"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 placeholder:text-slate-400"
            required
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-5 py-3 rounded hover:bg-blue-700"
          >
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}