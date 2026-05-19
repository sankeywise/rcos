import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type ControlFamily = {
  id: number;
  code: string;
  name: string;
  total_controls: number;
  sort_order: number;
};

type CmmcDocument = {
  id: number;
  organization_id: string;
  document_name: string;
  document_type: string | null;
  control_family_code: string | null;
  status: string | null;
  owner: string | null;
  file_path: string | null;
  last_updated: string | null;
  notes: string | null;
  created_at: string | null;
};

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
  incident_response_status: string | null;
  access_control_status: string | null;
  audit_logging_status: string | null;
  media_protection_status: string | null;
  training_program_status: string | null;
  vendor_management_status: string | null;
  scoping_status: string | null;
  notes: string | null;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function isCompleteStatus(value?: string | null) {
  return ["complete", "completed", "approved", "signed", "verified", "audit-ready", "audit ready"].includes(
    normalizeStatus(value)
  );
}

function getBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (isCompleteStatus(status)) {
    return "bg-green-100 text-green-700";
  }

  if (
    normalized === "in progress" ||
    normalized === "pending" ||
    normalized === "partial" ||
    normalized === "review required"
  ) {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized === "missing" || normalized === "overdue" || normalized === "expired") {
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

function getFamilyBadgeClass(code?: string | null) {
  const colors: Record<string, string> = {
    AC: "bg-blue-100 text-blue-700",
    AT: "bg-purple-100 text-purple-700",
    AU: "bg-cyan-100 text-cyan-700",
    CM: "bg-orange-100 text-orange-700",
    IA: "bg-indigo-100 text-indigo-700",
    IR: "bg-slate-100 text-slate-700",
    MA: "bg-stone-100 text-stone-700",
    MP: "bg-red-100 text-red-700",
    PE: "bg-violet-100 text-violet-700",
    PS: "bg-sky-100 text-sky-700",
    RA: "bg-emerald-100 text-emerald-700",
    CA: "bg-amber-100 text-amber-700",
    SC: "bg-teal-100 text-teal-700",
    SI: "bg-rose-100 text-rose-700",
  };

  return colors[String(code || "")] || "bg-slate-100 text-slate-700";
}

function mapProfileStatusToDocumentStatus(documentName: string, profile: CmmcProfile | null) {
  const name = documentName.toLowerCase();

  if (name.includes("system security plan")) return profile?.ssp_status || "Draft";
  if (name.includes("incident")) return profile?.incident_response_status || "Draft";
  if (name.includes("access")) return profile?.access_control_status || "Draft";
  if (name.includes("logging") || name.includes("auditing")) return profile?.audit_logging_status || "Draft";
  if (name.includes("media")) return profile?.media_protection_status || "Draft";
  if (name.includes("training")) return profile?.training_program_status || "Draft";
  if (name.includes("security assessment")) return profile?.scoping_status || "Draft";

  return null;
}

export default async function CMMCCompliancePage() {
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

  const familiesResult = await supabase
    .from("cmmc_control_families")
    .select("*")
    .order("sort_order", { ascending: true });

  const documentsResult = await supabase
    .from("cmmc_documents")
    .select("*")
    .eq("organization_id", orgId)
    .order("document_name", { ascending: true });

  const profileResult = await supabase
    .from("cmmc_compliance_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  const families: ControlFamily[] = (familiesResult.data ?? []) as ControlFamily[];
  const rawDocuments: CmmcDocument[] = (documentsResult.data ?? []) as CmmcDocument[];
  const profile: CmmcProfile | null = (profileResult.data as CmmcProfile | null) ?? null;

  const documents = rawDocuments.map((doc) => {
    const profileMappedStatus = mapProfileStatusToDocumentStatus(doc.document_name, profile);

    return {
      ...doc,
      status: profileMappedStatus || doc.status || "Draft",
    };
  });

  const completeDocuments = documents.filter((doc) => isCompleteStatus(doc.status));
  const inProgressDocuments = documents.filter((doc) =>
    ["in progress", "pending", "partial", "review required"].includes(normalizeStatus(doc.status))
  );
  const missingDocuments = documents.filter((doc) =>
    ["missing", "not started"].includes(normalizeStatus(doc.status))
  );
  const draftDocuments = documents.filter((doc) => normalizeStatus(doc.status) === "draft");

  const totalControls = families.reduce((sum, family) => sum + family.total_controls, 0) || 110;

  const controlStatusCards = [
    { label: "SSP", status: profile?.ssp_status || "Draft" },
    { label: "POA&M", status: profile?.poam_status || "Draft" },
    { label: "Incident Response", status: profile?.incident_response_status || "Draft" },
    { label: "Access Control", status: profile?.access_control_status || "Draft" },
    { label: "Audit Logging", status: profile?.audit_logging_status || "Draft" },
    { label: "Media Protection", status: profile?.media_protection_status || "Draft" },
    { label: "Training Program", status: profile?.training_program_status || "Draft" },
    { label: "Vendor Management", status: profile?.vendor_management_status || "Draft" },
    { label: "Scoping", status: profile?.scoping_status || "Draft" },
  ];

  const completeControlAreas = controlStatusCards.filter((card) => isCompleteStatus(card.status)).length;
  const inProgressControlAreas = controlStatusCards.filter((card) =>
    ["in progress", "pending", "partial", "review required"].includes(normalizeStatus(card.status))
  ).length;
  const notStartedControlAreas = controlStatusCards.length - completeControlAreas - inProgressControlAreas;

  const auditReadyControls = completeControlAreas;
  const inProgressControls = inProgressControlAreas + inProgressDocuments.length;
  const notStartedControls = Math.max(totalControls - auditReadyControls - inProgressControls, 0);
  const overdueControls = missingDocuments.length;

  const readinessPercent =
    totalControls === 0 ? 0 : Math.round((auditReadyControls / totalControls) * 100);

  const familyDocumentCount: Record<string, number> = {};
  documents.forEach((doc) => {
    const code = doc.control_family_code || "UN";
    familyDocumentCount[code] = (familyDocumentCount[code] || 0) + 1;
  });

  async function saveDocumentStatus(formData: FormData) {
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
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      redirect("/");
    }

    const documentId = String(formData.get("document_id") || "").trim();
    const status = String(formData.get("status") || "Draft").trim();
    const owner = String(formData.get("owner") || "").trim() || null;

    if (!documentId) {
      throw new Error("Document is required.");
    }

    const { error } = await supabase
      .from("cmmc_documents")
      .update({
        status,
        owner,
        last_updated: new Date().toISOString().slice(0, 10),
      })
      .eq("id", Number(documentId))
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/cmmc-compliance");
    revalidatePath("/");
  }

  async function addDocument(formData: FormData) {
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
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      redirect("/");
    }

    const documentName = String(formData.get("document_name") || "").trim();
    const documentType = String(formData.get("document_type") || "Policy").trim();
    const controlFamilyCode = String(formData.get("control_family_code") || "").trim();
    const owner = String(formData.get("owner") || "").trim() || null;

    if (!documentName) {
      throw new Error("Document name is required.");
    }

    const { error } = await supabase.from("cmmc_documents").insert({
      organization_id: membership.organization_id,
      document_name: documentName,
      document_type: documentType,
      control_family_code: controlFamilyCode || null,
      status: "Draft",
      owner,
      last_updated: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/cmmc-compliance");
    revalidatePath("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">CMMC Control Readiness</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage core CMMC/NIST documents, control families, readiness status, owners, and evidence gaps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Action Center
          </Link>

          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">Overall Readiness</div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-blue-100">
              <div className="text-xl font-bold text-blue-600">{readinessPercent}%</div>
            </div>
            <div className="text-sm text-slate-500">
              {auditReadyControls} of {totalControls} controls audit-ready
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">Documents</div>
          <div className="mt-5 text-4xl font-bold text-slate-900">{documents.length}</div>
          <div className="mt-1 text-xs text-slate-500">Total documents managed</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">Complete</div>
          <div className="mt-5 text-4xl font-bold text-slate-900">{completeDocuments.length}</div>
          <div className="mt-1 text-xs text-slate-500">Documents complete</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">In Progress</div>
          <div className="mt-5 text-4xl font-bold text-slate-900">{inProgressDocuments.length}</div>
          <div className="mt-1 text-xs text-slate-500">Documents in progress</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">Draft</div>
          <div className="mt-5 text-4xl font-bold text-slate-900">{draftDocuments.length}</div>
          <div className="mt-1 text-xs text-slate-500">Documents still draft</div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">Missing / Overdue</div>
          <div className="mt-5 text-4xl font-bold text-red-600">{overdueControls}</div>
          <div className="mt-1 text-xs text-slate-500">Needs immediate review</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Control Areas
            </button>
            <button className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              All Controls ({totalControls})
            </button>
            <button className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Documents ({documents.length})
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <select className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <option>All Statuses</option>
              <option>Draft</option>
              <option>In Progress</option>
              <option>Complete</option>
              <option>Missing</option>
            </select>

            <input
              placeholder="Search documents..."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />

            <form action={addDocument} className="flex gap-2">
              <input
                type="text"
                name="document_name"
                placeholder="New document"
                className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              />
              <select
                name="control_family_code"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">Area</option>
                {families.map((family) => (
                  <option key={family.code} value={family.code}>
                    {family.code}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_2fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">CMMC Control Areas (14)</h2>

          <div className="mt-4 space-y-2">
            {families.map((family) => (
              <div
                key={family.code}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-7 w-8 items-center justify-center rounded-lg text-xs font-bold ${getFamilyBadgeClass(
                      family.code
                    )}`}
                  >
                    {family.code}
                  </span>
                  <div className="text-sm text-slate-700">{family.name}</div>
                </div>

                <div className="text-sm font-medium text-slate-600">
                  {familyDocumentCount[family.code] || 0} / {family.total_controls}
                </div>
              </div>
            ))}
          </div>

          <button className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50">
            View All Controls ({totalControls})
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Key CMMC / NIST Documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              Core organizational documents mapped to CMMC control areas and readiness status.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Document Name</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.slice(0, 14).map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{doc.document_name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {doc.document_type || "Policy"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${getFamilyBadgeClass(
                          doc.control_family_code
                        )}`}
                      >
                        {doc.control_family_code || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                          doc.status
                        )}`}
                      >
                        {doc.status || "Draft"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-slate-600">{formatDate(doc.last_updated)}</td>
                    <td className="px-4 py-4 text-slate-600">{doc.owner || "Unassigned"}</td>

                    <td className="px-4 py-4">
                      <form action={saveDocumentStatus} className="flex gap-2">
                        <input type="hidden" name="document_id" value={doc.id} />
                        <input type="hidden" name="owner" value={doc.owner || ""} />
                        <select
                          name="status"
                          defaultValue={doc.status || "Draft"}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="Draft">Draft</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Pending">Pending</option>
                          <option value="Complete">Complete</option>
                          <option value="Approved">Approved</option>
                          <option value="Missing">Missing</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Link
              href="/cmmc-compliance"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all documents ({documents.length}) →
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Control Readiness Summary</h2>

            <div className="mt-5 flex items-center justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-[16px] border-slate-200">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{totalControls}</div>
                  <div className="text-xs text-slate-500">Total Controls</div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Audit-Ready</span>
                <span className="font-medium text-slate-900">{auditReadyControls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">In Progress</span>
                <span className="font-medium text-slate-900">{inProgressControls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Not Started</span>
                <span className="font-medium text-slate-900">{notStartedControls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Missing / Overdue</span>
                <span className="font-medium text-red-600">{overdueControls}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>

            <div className="mt-4 space-y-4 text-sm">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="border-b border-slate-100 pb-3 last:border-b-0">
                  <div className="font-medium text-slate-900">Document reviewed</div>
                  <div className="mt-1 text-slate-600">{doc.document_name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Updated {formatDate(doc.last_updated)} by {doc.owner || "Unassigned"}
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/cmmc-compliance"
              className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all activity →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}