import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import EditPersonnelForm from "@/components/personnel/edit-personnel-form";

type PageProps = {
  params: {
    id: string;
  };
};

export default async function EditPersonnelPage({ params }: PageProps) {
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

  const orgId = membership.organization_id;
  const personnelId = Number(params.id);

  if (Number.isNaN(personnelId)) {
    redirect("/personnel");
  }

  const { data: person, error: personError } = await supabase
    .from("personnel")
    .select(`
      id,
      organization_id,
      project_id,
      name,
      role,
      citizenship_status,
      citizenship,
      additional_screening_status,
      additional_screening_date,
      rps_screening_status,
      rps_screening_date,
      personnel_training_records (
        id,
        training_name,
        completed_on,
        due_on,
        certificate_path,
        certificate_file_name
      )
    `)
    .eq("id", personnelId)
    .eq("organization_id", orgId)
    .single();

  if (personError || !person) {
    redirect("/personnel");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-slate-900">
          Edit Personnel
        </h1>
        <p className="text-slate-700">
          Update personnel details and annual training records
        </p>
      </div>

      <EditPersonnelForm
        personnelId={person.id}
        organizationId={orgId}
        projects={(projects || []).map((project) => ({
          id: project.id,
          name: project.name,
        }))}
        initialData={{
          name: person.name || "",
          role: person.role || "",
          projectId: person.project_id ? String(person.project_id) : "",
          citizenshipStatus:
            person.citizenship_status || person.citizenship || "",
          additionalScreeningStatus:
            person.additional_screening_status || "not_started",
          additionalScreeningDate:
            person.additional_screening_date || "",
          rpsScreeningStatus:
            person.rps_screening_status || "not_started",
          rpsScreeningDate:
            person.rps_screening_date || "",
          trainingRecords: (person.personnel_training_records || []).map(
            (record: any) => ({
              id: record.id,
              trainingName: record.training_name,
              completedOn: record.completed_on || "",
              dueOn: record.due_on || "",
              existingCertificatePath: record.certificate_path || "",
              existingCertificateFileName:
                record.certificate_file_name || "",
            })
          ),
        }}
      />
    </div>
  );
}