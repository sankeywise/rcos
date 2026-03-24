import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import PersonnelTable, {
  PersonnelTableRow,
  TrainingRecord,
} from "../../components/personnel/personnel-table";

const REQUIRED_TRAININGS = [
  "Insider Threat",
  "Counterintelligence",
  "CUI Training",
  "OPSEC",
  "Cybersecurity Awareness",
] as const;

function formatCitizenshipStatus(value?: string | null) {
  if (!value) return "Not Set";

  const normalized = value.toLowerCase();

  if (
    normalized === "us" ||
    normalized === "usa" ||
    normalized === "us_citizen"
  ) {
    return "U.S. Citizen";
  }

  if (normalized === "lawful_permanent_resident") {
    return "Lawful Permanent Resident";
  }

  if (normalized === "green_card_holder") {
    return "Green Card Holder";
  }

  if (normalized === "visa_holder") {
    return "Visa Holder";
  }

  if (normalized === "foreign_national" || normalized === "cn") {
    return "Foreign National";
  }

  if (normalized === "dual_citizen") {
    return "Dual Citizen";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatusLabel(value?: string | null) {
  if (!value) return "Not Started";

  const normalized = value.toLowerCase();

  if (normalized === "completed") return "Completed";
  if (normalized === "in_progress") return "In Progress";
  if (normalized === "pending") return "Pending";
  if (normalized === "not_started") return "Not Started";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type ProjectRelation = { name: string } | { name: string }[] | null;

type TrainingDbRow = {
  training_name: string;
  completed_on: string | null;
  due_on: string | null;
  certificate_path: string | null;
  certificate_file_name: string | null;
};

export default async function PersonnelPage() {
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

  const orgId = membership.organization_id;

  const { data: personnelRows, error } = await supabase
    .from("personnel")
    .select(`
      id,
      name,
      role,
      citizenship,
      citizenship_status,
      additional_screening_status,
      additional_screening_date,
      rps_screening_status,
      rps_screening_date,
      project_id,
      projects (
        name
      ),
      personnel_training_records (
        training_name,
        completed_on,
        due_on,
        certificate_path,
        certificate_file_name
      )
    `)
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-4xl font-bold mb-2 text-slate-900">Personnel</h1>
        <pre className="text-red-600 whitespace-pre-wrap">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }

  const grouped: Record<string, PersonnelTableRow[]> = {};
  const today = new Date().toISOString().slice(0, 10);

  for (const person of personnelRows || []) {
    const projectRelation = person.projects as ProjectRelation;

    const projectName = Array.isArray(projectRelation)
      ? projectRelation[0]?.name || "Unassigned"
      : projectRelation?.name || "Unassigned";

    const trainingDbRows = (person.personnel_training_records ||
      []) as TrainingDbRow[];

    const trainingMap = new Map(
      trainingDbRows.map((record) => [record.training_name, record])
    );

    const trainingRecords: TrainingRecord[] = REQUIRED_TRAININGS.map(
      (trainingName) => {
        const record = trainingMap.get(trainingName);

        if (!record || !record.completed_on) {
          return {
            name: trainingName,
            status: "Not Started",
            completedOn: null,
            dueOn: null,
            certificateFileName: record?.certificate_file_name || null,
          };
        }

        const isOverdue = !!record.due_on && record.due_on < today;

        return {
          name: trainingName,
          status: isOverdue ? "Overdue" : "Current",
          completedOn: record.completed_on,
          dueOn: record.due_on,
          certificateFileName: record.certificate_file_name,
        };
      }
    );

    const allTrainingCurrent = trainingRecords.every(
      (training) => training.status === "Current"
    );

    const additionalScreeningStatus = formatStatusLabel(
      person.additional_screening_status
    );

    const rpsScreeningStatus = formatStatusLabel(person.rps_screening_status);

    const isActive =
      rpsScreeningStatus === "Completed" && allTrainingCurrent;

    const row: PersonnelTableRow = {
      id: person.id,
      name: person.name,
      role: person.role,
      projectName,
      citizenshipStatus: formatCitizenshipStatus(
        person.citizenship_status || person.citizenship
      ),
      additionalScreeningStatus,
      additionalScreeningDate: person.additional_screening_date || null,
      rpsScreeningStatus,
      rpsScreeningDate: person.rps_screening_date || null,
      trainingRecords,
      status: isActive ? "Active" : "Pending Authorization",
    };

    if (!grouped[projectName]) {
      grouped[projectName] = [];
    }

    grouped[projectName].push(row);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-slate-900">Personnel</h1>
          <p className="text-slate-700">
            Authorized individuals with access to controlled research
          </p>
        </div>

        <Link
          href="/personnel/new"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Add Personnel
        </Link>
      </div>

      <div className="space-y-10">
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-slate-500">
            No personnel records found.
          </div>
        ) : (
          Object.entries(grouped).map(([projectName, rows]) => (
            <div key={projectName}>
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">
                {projectName}
              </h2>

              <PersonnelTable rows={rows} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}