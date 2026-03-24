"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type ProjectOption = {
  id: number;
  name: string;
};

type InitialTrainingRecord = {
  id?: number;
  trainingName: string;
  completedOn: string;
  dueOn: string;
  existingCertificatePath: string;
  existingCertificateFileName: string;
};

type EditPersonnelFormProps = {
  personnelId: number;
  organizationId: string;
  projects: ProjectOption[];
  initialData: {
    name: string;
    role: string;
    projectId: string;
    citizenshipStatus: string;
    additionalScreeningStatus: string;
    additionalScreeningDate: string;
    rpsScreeningStatus: string;
    rpsScreeningDate: string;
    trainingRecords: InitialTrainingRecord[];
  };
};

const REQUIRED_TRAININGS = [
  "Insider Threat",
  "Counterintelligence",
  "CUI Training",
  "OPSEC",
  "Cybersecurity Awareness",
] as const;

const ROLE_OPTIONS = [
  "Principal Investigator",
  "Co-PI",
  "Student",
] as const;

type TrainingInput = {
  id?: number;
  trainingName: string;
  completedOn: string;
  dueOn: string;
  existingCertificatePath: string;
  existingCertificateFileName: string;
  certificateFile: File | null;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function EditPersonnelForm({
  personnelId,
  organizationId,
  projects,
  initialData,
}: EditPersonnelFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initialData.name);
  const [role, setRole] = useState(initialData.role);
  const [projectId, setProjectId] = useState(initialData.projectId);
  const [citizenshipStatus, setCitizenshipStatus] = useState(
    initialData.citizenshipStatus
  );
  const [additionalScreeningStatus, setAdditionalScreeningStatus] = useState(
    initialData.additionalScreeningStatus
  );
  const [additionalScreeningDate, setAdditionalScreeningDate] = useState(
    initialData.additionalScreeningDate
  );
  const [rpsScreeningStatus, setRpsScreeningStatus] = useState(
    initialData.rpsScreeningStatus
  );
  const [rpsScreeningDate, setRpsScreeningDate] = useState(
    initialData.rpsScreeningDate
  );

  const mergedTrainingInputs = useMemo(() => {
    return REQUIRED_TRAININGS.map((trainingName) => {
      const existing = initialData.trainingRecords.find(
        (record) => record.trainingName === trainingName
      );

      return {
        id: existing?.id,
        trainingName,
        completedOn: existing?.completedOn || "",
        dueOn: existing?.dueOn || "",
        existingCertificatePath: existing?.existingCertificatePath || "",
        existingCertificateFileName: existing?.existingCertificateFileName || "",
        certificateFile: null,
      };
    });
  }, [initialData.trainingRecords]);

  const [trainingInputs, setTrainingInputs] = useState<TrainingInput[]>(
    mergedTrainingInputs
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateTrainingDate(trainingName: string, value: string) {
    setTrainingInputs((current) =>
      current.map((training) =>
        training.trainingName === trainingName
          ? { ...training, completedOn: value }
          : training
      )
    );
  }

  function updateTrainingFile(trainingName: string, file: File | null) {
    setTrainingInputs((current) =>
      current.map((training) =>
        training.trainingName === trainingName
          ? { ...training, certificateFile: file }
          : training
      )
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");

    if (!role) {
      setErrorMessage("Please select a role.");
      setSaving(false);
      return;
    }

    for (const training of trainingInputs) {
      if (
        (training.certificateFile || training.existingCertificatePath) &&
        !training.completedOn
      ) {
        setErrorMessage(
          `Please enter a completion date for ${training.trainingName}.`
        );
        setSaving(false);
        return;
      }
    }

    const { error: personnelError } = await supabase
      .from("personnel")
      .update({
        project_id: projectId ? Number(projectId) : null,
        name,
        role,
        citizenship_status: citizenshipStatus || null,
        additional_screening_status: additionalScreeningStatus || null,
        additional_screening_date: additionalScreeningDate || null,
        rps_screening_status: rpsScreeningStatus || null,
        rps_screening_date: rpsScreeningDate || null,
      })
      .eq("id", personnelId)
      .eq("organization_id", organizationId);

    if (personnelError) {
      setErrorMessage(personnelError.message);
      setSaving(false);
      return;
    }

    for (const training of trainingInputs) {
      let certificatePath = training.existingCertificatePath || null;
      let certificateFileName = training.existingCertificateFileName || null;

      if (training.certificateFile) {
        const file = training.certificateFile;
        const safeTrainingName = slugify(training.trainingName);
        const path = `${organizationId}/${personnelId}/${safeTrainingName}-${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("training-certificates")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setErrorMessage(
            `Failed to upload certificate for ${training.trainingName}: ${uploadError.message}`
          );
          setSaving(false);
          return;
        }

        certificatePath = path;
        certificateFileName = file.name;
      }

      const shouldDeleteRecord =
        !training.completedOn &&
        !certificatePath &&
        !certificateFileName &&
        !!training.id;

      if (shouldDeleteRecord) {
        const { error: deleteTrainingError } = await supabase
          .from("personnel_training_records")
          .delete()
          .eq("id", training.id);

        if (deleteTrainingError) {
          setErrorMessage(
            `Failed to remove training record for ${training.trainingName}: ${deleteTrainingError.message}`
          );
          setSaving(false);
          return;
        }

        continue;
      }

      if (!training.completedOn && !certificatePath && !certificateFileName) {
        continue;
      }

      const { error: upsertTrainingError } = await supabase
        .from("personnel_training_records")
        .upsert(
          {
            personnel_id: personnelId,
            training_name: training.trainingName,
            completed_on: training.completedOn || null,
            certificate_path: certificatePath,
            certificate_file_name: certificateFileName,
          },
          {
            onConflict: "personnel_id,training_name",
          }
        );

      if (upsertTrainingError) {
        setErrorMessage(
          `Failed to update training record for ${training.trainingName}: ${upsertTrainingError.message}`
        );
        setSaving(false);
        return;
      }
    }

    router.push("/personnel");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select role</option>
            {ROLE_OPTIONS.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleOption}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Citizenship / Immigration Status
          </label>
          <select
            value={citizenshipStatus}
            onChange={(e) => setCitizenshipStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select status</option>
            <option value="us_citizen">U.S. Citizen</option>
            <option value="lawful_permanent_resident">
              Lawful Permanent Resident
            </option>
            <option value="green_card_holder">Green Card Holder</option>
            <option value="visa_holder">Visa Holder</option>
            <option value="foreign_national">Foreign National</option>
            <option value="dual_citizen">Dual Citizen</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Screening Status (Contractors / External Only)
          </label>
          <select
            value={additionalScreeningStatus}
            onChange={(e) => setAdditionalScreeningStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="not_started">Not Started</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Screening Date
          </label>
          <input
            type="date"
            value={additionalScreeningDate}
            onChange={(e) => setAdditionalScreeningDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Restricted Party Screening Status
          </label>
          <select
            value={rpsScreeningStatus}
            onChange={(e) => setRpsScreeningStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="not_started">Not Started</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Restricted Party Screening Date
          </label>
          <input
            type="date"
            value={rpsScreeningDate}
            onChange={(e) => setRpsScreeningDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Annual Required Training
        </h2>

        <div className="space-y-4">
          {trainingInputs.map((training) => (
            <div
              key={training.trainingName}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="font-medium text-slate-800 mb-3">
                {training.trainingName}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={training.completedOn}
                    onChange={(e) =>
                      updateTrainingDate(training.trainingName, e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Due Again
                  </label>
                  <input
                    type="text"
                    value={training.dueOn || "Calculated automatically after save"}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Replace / Upload Certificate
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateTrainingFile(
                        training.trainingName,
                        e.target.files?.[0] || null
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                Current Certificate:{" "}
                <span className="font-medium">
                  {training.existingCertificateFileName || "Not Uploaded"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-slate-500">
          When you update a completion date, the due-again date is automatically set to one year later.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/personnel")}
          className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}