import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type ProjectRow = {
  id: number;
  project_name: string | null;
  sponsor: string | null;
};

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

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function normalizeStatus(value?: string | null) {
  return String(value || "").toLowerCase();
}

function getBadgeClass(value?: string | null) {
  const normalized = normalizeStatus(value);

  if (
    ["complete", "completed", "approved", "cleared", "closed", "final"].includes(
      normalized
    )
  ) {
    return "bg-green-100 text-green-700";
  }

  if (["draft", "pending", "in review", "requires review"].includes(normalized)) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (["high risk", "restricted", "not approved"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
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

export default async function ProjectIntakePage() {
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

  const projectsResult = await supabase
    .from("projects")
    .select("id, project_name, sponsor")
    .eq("organization_id", orgId)
    .order("id", { ascending: true });

  const reviewsResult = await supabase
    .from("project_intake_reviews")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const projects: ProjectRow[] = (projectsResult.data ?? []) as ProjectRow[];
  const reviews: IntakeReview[] = (reviewsResult.data ?? []) as IntakeReview[];

  const draftReviews = reviews.filter(
    (review) => normalizeStatus(review.review_status) === "draft"
  );

  const inReview = reviews.filter((review) =>
    ["pending", "in review", "requires review"].includes(
      normalizeStatus(review.review_status)
    )
  );

  const highRiskReviews = reviews.filter((review) => riskLevel(review) === "High Risk");

  const finalReviews = reviews.filter((review) =>
    ["complete", "completed", "approved", "cleared", "final"].includes(
      normalizeStatus(review.review_status)
    )
  );

  async function createIntakeReview(formData: FormData) {
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

    const projectTitle = String(formData.get("project_title") || "").trim();

    if (!projectTitle) {
      throw new Error("Project title is required.");
    }

    const involvesCui = checkboxValue(formData, "involves_cui");
    const involvesItar = checkboxValue(formData, "involves_itar");
    const involvesEar = checkboxValue(formData, "involves_ear");
    const involvesNoforn = checkboxValue(formData, "involves_noforn");
    const involvesForeignNationals = checkboxValue(
      formData,
      "involves_foreign_nationals"
    );
    const involvesInternationalCollaboration = checkboxValue(
      formData,
      "involves_international_collaboration"
    );
    const involvesControlledTechnicalData = checkboxValue(
      formData,
      "involves_controlled_technical_data"
    );
    const involvesSecureEnclave = checkboxValue(formData, "involves_secure_enclave");

    const requiresTcp =
      checkboxValue(formData, "requires_tcp") ||
      involvesItar ||
      involvesNoforn ||
      involvesForeignNationals;

    const requiresRps =
      checkboxValue(formData, "requires_rps") ||
      involvesForeignNationals ||
      involvesInternationalCollaboration;

    const requiresCmmcReview =
      checkboxValue(formData, "requires_cmmc_review") ||
      involvesCui ||
      involvesControlledTechnicalData ||
      involvesSecureEnclave;

    const requiresSecureMachineAccess =
      checkboxValue(formData, "requires_secure_machine_access") ||
      involvesCui ||
      involvesSecureEnclave;

    const requiresFsoReview =
      checkboxValue(formData, "requires_fso_review") || involvesNoforn || involvesCui;

    const requiresIsoReview =
      checkboxValue(formData, "requires_iso_review") ||
      involvesCui ||
      involvesSecureEnclave ||
      requiresCmmcReview;

    const requiresEcoReview =
      checkboxValue(formData, "requires_eco_review") ||
      involvesItar ||
      involvesEar ||
      involvesForeignNationals ||
      involvesControlledTechnicalData;

    const flags = [
      involvesCui,
      involvesItar,
      involvesEar,
      involvesNoforn,
      involvesForeignNationals,
      involvesControlledTechnicalData,
      involvesSecureEnclave,
      requiresTcp,
      requiresCmmcReview,
    ].filter(Boolean).length;

    const automaticRisk =
      flags >= 5 ? "High Risk" : flags >= 2 ? "Moderate Risk" : "Low Risk";

    const recommendedAction =
      automaticRisk === "High Risk"
        ? "Route for ECO, ISO, and FSO review before project authorization."
        : automaticRisk === "Moderate Risk"
        ? "Route for compliance review and confirm required safeguards before project authorization."
        : "Low-risk intake based on current answers; retain review record and monitor for changes.";

    const { data, error } = await supabase
      .from("project_intake_reviews")
      .insert({
        organization_id: membership.organization_id,
        project_id: String(formData.get("project_id") || "").trim()
          ? Number(formData.get("project_id"))
          : null,

        project_title: projectTitle,
        sponsor: String(formData.get("sponsor") || "").trim() || null,
        principal_investigator:
          String(formData.get("principal_investigator") || "").trim() || null,
        department: String(formData.get("department") || "").trim() || null,

        review_status: String(formData.get("review_status") || "Draft").trim(),
        review_owner: String(formData.get("review_owner") || "").trim() || null,
        review_date: String(formData.get("review_date") || "").trim() || null,

        involves_dod: checkboxValue(formData, "involves_dod"),
        involves_federal_sponsor: checkboxValue(
          formData,
          "involves_federal_sponsor"
        ),
        involves_cui: involvesCui,
        involves_export_control:
          checkboxValue(formData, "involves_export_control") || involvesItar || involvesEar,
        involves_itar: involvesItar,
        involves_ear: involvesEar,
        involves_noforn: involvesNoforn,
        involves_foreign_nationals: involvesForeignNationals,
        involves_international_collaboration: involvesInternationalCollaboration,
        involves_controlled_technical_data: involvesControlledTechnicalData,
        involves_secure_enclave: involvesSecureEnclave,

        requires_tcp: requiresTcp,
        requires_rps: requiresRps,
        requires_cmmc_review: requiresCmmcReview,
        requires_secure_machine_access: requiresSecureMachineAccess,
        requires_fso_review: requiresFsoReview,
        requires_iso_review: requiresIsoReview,
        requires_eco_review: requiresEcoReview,

        cui_category: String(formData.get("cui_category") || "").trim() || null,
        export_control_summary:
          String(formData.get("export_control_summary") || "").trim() || null,
        data_handling_summary:
          String(formData.get("data_handling_summary") || "").trim() || null,
        foreign_national_summary:
          String(formData.get("foreign_national_summary") || "").trim() || null,
        secure_environment_summary:
          String(formData.get("secure_environment_summary") || "").trim() || null,

        risk_summary:
          String(formData.get("risk_summary") || "").trim() ||
          `Automatic intake risk: ${automaticRisk}`,

        recommended_action:
          String(formData.get("recommended_action") || "").trim() || recommendedAction,

        final_determination:
          String(formData.get("final_determination") || "").trim() || automaticRisk,

        determination_notes:
          String(formData.get("determination_notes") || "").trim() || null,

        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/project-intake");
    revalidatePath("/");
    revalidatePath("/audit-mode");

    if (data?.id) {
      redirect(`/project-intake/${data.id}`);
    }

    redirect("/project-intake");
  }

  async function deleteIntakeReview(formData: FormData) {
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

    const reviewId = String(formData.get("review_id") || "").trim();

    if (!reviewId) {
      throw new Error("Review ID is required.");
    }

    const { error } = await supabase
      .from("project_intake_reviews")
      .delete()
      .eq("id", Number(reviewId))
      .eq("organization_id", membership.organization_id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/project-intake");
    revalidatePath("/");
    revalidatePath("/audit-mode");

    redirect("/project-intake");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Project Intake</h1>
          <p className="mt-1 text-slate-600">
            Classification workflow for CUI, ITAR, EAR, NOFORN, foreign national
            access, secure enclave, and CMMC applicability.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to Action Center
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Total Reviews</div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {reviews.length}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Draft / In Review</div>
          <div className="mt-2 text-4xl font-bold text-yellow-600">
            {draftReviews.length + inReview.length}
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">High Risk</div>
          <div className="mt-2 text-4xl font-bold text-red-600">
            {highRiskReviews.length}
          </div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Finalized</div>
          <div className="mt-2 text-4xl font-bold text-green-600">
            {finalReviews.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            New Project Intake Review
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use metadata and summaries only. Do not enter controlled technical
            details, CUI contents, enclave diagrams, vulnerability data, or sensitive
            configuration information.
          </p>

          <form action={createIntakeReview} className="mt-6 space-y-7">
            <section>
              <h3 className="text-lg font-semibold text-slate-900">
                Project Information
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Existing Project
                  </label>
                  <select
                    name="project_id"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Not linked</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_name || `Project ${project.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Review Status
                  </label>
                  <select
                    name="review_status"
                    defaultValue="Draft"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Pending">Pending</option>
                    <option value="In Review">In Review</option>
                    <option value="Requires Review">Requires Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Final">Final</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Project Title
                  </label>
                  <input
                    name="project_title"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Project title"
                  />
                </div>

                <input
                  name="sponsor"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Sponsor"
                />

                <input
                  name="principal_investigator"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Principal Investigator"
                />

                <input
                  name="department"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Department"
                />

                <input
                  name="review_owner"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Review owner"
                />

                <input
                  type="date"
                  name="review_date"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">
                Classification Questions
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ["involves_dod", "Does this involve DoD?"],
                  ["involves_federal_sponsor", "Does this involve a federal sponsor?"],
                  ["involves_cui", "Does this involve CUI?"],
                  ["involves_export_control", "Does this involve export control?"],
                  ["involves_itar", "Does this involve ITAR?"],
                  ["involves_ear", "Does this involve EAR?"],
                  ["involves_noforn", "Does this involve NOFORN restrictions?"],
                  ["involves_foreign_nationals", "Are foreign nationals involved?"],
                  [
                    "involves_international_collaboration",
                    "International collaboration involved?",
                  ],
                  [
                    "involves_controlled_technical_data",
                    "Controlled technical data involved?",
                  ],
                  ["involves_secure_enclave", "Secure enclave required or expected?"],
                  ["requires_tcp", "Technology Control Plan required?"],
                  ["requires_rps", "Restricted party screening required?"],
                  ["requires_cmmc_review", "CMMC review required?"],
                  ["requires_secure_machine_access", "Secure machine access required?"],
                  ["requires_fso_review", "FSO review required?"],
                  ["requires_iso_review", "ISO review required?"],
                  ["requires_eco_review", "ECO review required?"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <input type="checkbox" name={name} className="h-4 w-4" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">
                Review Summaries
              </h3>

              <div className="mt-4 space-y-4">
                <input
                  name="cui_category"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="CUI category, if known. Example: CUI//SP-EXPT, CTI, PRVCY, etc."
                />

                <textarea
                  name="export_control_summary"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Export control summary. Avoid sensitive technical details."
                />

                <textarea
                  name="data_handling_summary"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Data handling summary. Example: must remain in secure enclave; no remote access."
                />

                <textarea
                  name="foreign_national_summary"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Foreign national access summary."
                />

                <textarea
                  name="secure_environment_summary"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Secure environment summary. Do not include enclave architecture details."
                />

                <textarea
                  name="risk_summary"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Risk summary."
                />

                <textarea
                  name="recommended_action"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Recommended action."
                />

                <select
                  name="final_determination"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Final determination will be auto-suggested if blank</option>
                  <option value="Low Risk">Low Risk</option>
                  <option value="Moderate Risk">Moderate Risk</option>
                  <option value="High Risk">High Risk</option>
                  <option value="Approved">Approved</option>
                  <option value="Requires Review">Requires Review</option>
                  <option value="Restricted">Restricted</option>
                  <option value="Not Approved">Not Approved</option>
                </select>

                <textarea
                  name="determination_notes"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Determination notes."
                />
              </div>
            </section>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Intake Review
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Intake Review Register
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Classification and routing history for controlled research review.
          </p>

          {reviews.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No project intake reviews created yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {reviews.map((review) => {
                const risk = riskLevel(review);

                return (
                  <div key={review.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {review.project_title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {review.sponsor || "No sponsor"} • PI{" "}
                          {review.principal_investigator || "Not entered"} • Created{" "}
                          {formatDate(review.created_at)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskBadgeClass(
                            risk
                          )}`}
                        >
                          {risk}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
                            review.review_status
                          )}`}
                        >
                          {review.review_status || "Draft"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {review.involves_cui && (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                          CUI
                        </span>
                      )}

                      {review.involves_itar && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          ITAR
                        </span>
                      )}

                      {review.involves_ear && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                          EAR
                        </span>
                      )}

                      {review.involves_noforn && (
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                          NOFORN
                        </span>
                      )}

                      {review.requires_tcp && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          TCP
                        </span>
                      )}

                      {review.requires_cmmc_review && (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                          CMMC Review
                        </span>
                      )}

                      {review.requires_secure_machine_access && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Secure Machine
                        </span>
                      )}
                    </div>

                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <div>
                        <span className="font-medium">Recommended Action:</span>{" "}
                        {review.recommended_action || "—"}
                      </div>

                      <div className="mt-2">
                        <span className="font-medium">Final Determination:</span>{" "}
                        {review.final_determination || "—"}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 p-3">
                        ECO Review: {review.requires_eco_review ? "Yes" : "No"}
                      </div>

                      <div className="rounded-lg border border-slate-200 p-3">
                        ISO Review: {review.requires_iso_review ? "Yes" : "No"}
                      </div>

                      <div className="rounded-lg border border-slate-200 p-3">
                        FSO Review: {review.requires_fso_review ? "Yes" : "No"}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/project-intake/${review.id}`}
                        className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        View / Print Determination
                      </Link>

                      <form action={deleteIntakeReview}>
                        <input type="hidden" name="review_id" value={review.id} />
                        <button
                          type="submit"
                          className="inline-flex rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Delete Review
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Project Intake is intended to capture routing decisions, risk indicators,
        and review metadata. Do not enter controlled technical data, CUI contents,
        enclave diagrams, vulnerabilities, or sensitive configuration details.
      </div>
    </div>
  );
}