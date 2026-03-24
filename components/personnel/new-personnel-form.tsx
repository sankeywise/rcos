"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

type ProjectOption = {
  id: number;
  name: string;
};

type NewPersonnelFormProps = {
  organizationId: string;
  projects: ProjectOption[];
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
  trainingName: string;
  completedOn: string;
  certificateFile: File | null;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function NewPersonnelForm({
  organizationId,
  projects,
}: NewPersonnelFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [projectId, setProjectId] = useState("");
  const [citizenshipStatus, setCitizenshipStatus] = useState("");
  const [additionalScreeningStatus, setAdditionalScreeningStatus] =
    useState("not_started");
  const [additionalScreeningDate, setAdditionalScreeningDate] = useState("");
  const [rpsScreeningStatus, setRpsScreeningStatus] =
    useState("not_started");
  const [rpsScreeningDate, setRpsScreeningDate] = useState("");

  const [trainingInputs, setTrainingInputs] = useState<TrainingInput[]>(
    REQUIRED_TRAININGS.map((trainingName) => ({
      trainingName,
      completedOn: "",
      certificateFile: null,
    }))
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
      if (training.certificateFile && !training.completedOn) {
        setErrorMessage(
          `Please enter a completion date for ${training.trainingName} before uploading a certificate.`
        );
        setSaving(false);
        return;
      }
    }

    const personnelPayload = {
      organization_id: organizationId,
      project_id: projectId ? Number(projectId) : null,
      name,
      role,
      citizenship_status: citizenshipStatus || null,
      additional_screening_status: additionalScreeningStatus || null,
      additional_screening_date: additionalScreeningDate || null,
      rps_screening_status: rpsScreeningStatus || null,
      rps_screening_date: rpsScreeningDate || null,
    };

    const { data: createdPersonnel, error: personnelError } = await supabase
      .from("personnel")
      .insert(personnelPayload)
      .select("id")
      .single();

    if (personnelError || !createdPersonnel) {
      setErrorMessage(personnelError?.message || "Failed to create personnel.");
      setSaving(false);
      return;
    }

    const personnelId = createdPersonnel.id;

    for (const training of trainingInputs) {
      if (!training.completedOn && !training.certificateFile) {
        continue;
      }

      let certificatePath: string | null = null;
      let certificateFileName: string | null = null;

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

      const { error: trainingError } = await supabase
        .from("personnel_training_records")
        .upsert({
          personnel_id: personnelId,
          training_name: training.trainingName,
          completed_on: training.completedOn || null,
          certificate_path: certificatePath,
          certificate_file_name: certificateFileName,
        });

      if (trainingError) {
        setErrorMessage(
          `Failed to save training record for ${training.trainingName}: ${trainingError.message}`
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Upload Completed Certificate
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
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Due date is automatically set to one year after the completion date.
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
          {saving ? "Saving..." : "Save Personnel"}
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