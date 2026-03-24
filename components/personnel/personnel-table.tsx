"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export type TrainingRecord = {
  name: string;
  status: "Current" | "Overdue" | "Pending" | "Not Started";
  completedOn: string | null;
  dueOn: string | null;
  certificateFileName: string | null;
};

export type PersonnelTableRow = {
  id: number;
  name: string;
  role: string;
  projectName: string;
  citizenshipStatus: string;
  additionalScreeningStatus: string;
  additionalScreeningDate: string | null;
  rpsScreeningStatus: string;
  rpsScreeningDate: string | null;
  trainingRecords: TrainingRecord[];
  status: "Active" | "Pending Authorization" | "Inactive";
};

type PersonnelTableProps = {
  rows: PersonnelTableRow[];
};

function getTrainingSummary(records: TrainingRecord[]) {
  const total = records.length;
  const current = records.filter((record) => record.status === "Current").length;
  return `${current}/${total} Current`;
}

function getStatusBadge(status: PersonnelTableRow["status"]) {
  if (status === "Active") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
        Active
      </span>
    );
  }

  if (status === "Pending Authorization") {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
        Pending Authorization
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
      Inactive
    </span>
  );
}

function getTrainingStatusBadge(status: TrainingRecord["status"]) {
  if (status === "Current") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
        Current
      </span>
    );
  }

  if (status === "Overdue") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
        Overdue
      </span>
    );
  }

  if (status === "Pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
        Pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
      Not Started
    </span>
  );
}

function DeletePersonnelButton({
  personnelId,
  personnelName,
}: {
  personnelId: number;
  personnelName: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${personnelName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("personnel")
      .delete()
      .eq("id", personnelId);

    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex items-center rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition disabled:opacity-60"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>

      {errorMessage ? (
        <div className="max-w-[180px] text-xs text-red-600">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

export default function PersonnelTable({ rows }: PersonnelTableProps) {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const projectOptions = useMemo(() => {
    const uniqueProjects = Array.from(
      new Set(rows.map((person) => person.projectName))
    );
    return ["All Projects", ...uniqueProjects];
  }, [rows]);

  const filteredPersonnel = useMemo(() => {
    return rows.filter((person) => {
      const q = search.toLowerCase();

      const matchesSearch =
        person.name.toLowerCase().includes(q) ||
        person.role.toLowerCase().includes(q) ||
        person.citizenshipStatus.toLowerCase().includes(q) ||
        person.projectName.toLowerCase().includes(q);

      const matchesProject =
        projectFilter === "All Projects" || person.projectName === projectFilter;

      const matchesStatus =
        statusFilter === "All Statuses" || person.status === statusFilter;

      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [rows, search, projectFilter, statusFilter]);

  return (
    <>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name, role, project, or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>Pending Authorization</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1760px] text-left border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b text-slate-600">
                <th className="py-4 px-6 font-semibold">Name</th>
                <th className="py-4 px-6 font-semibold">Role</th>
                <th className="py-4 px-6 font-semibold">Project</th>
                <th className="py-4 px-6 font-semibold">
                  Citizenship / Immigration Status
                </th>
                <th className="py-4 px-6 font-semibold">
                  Additional Screening Status
                </th>
                <th className="py-4 px-6 font-semibold">
                  Additional Screening Date
                </th>
                <th className="py-4 px-6 font-semibold">
                  Restricted Party Screening Status
                </th>
                <th className="py-4 px-6 font-semibold">
                  Restricted Party Screening Date
                </th>
                <th className="py-4 px-6 font-semibold">Training</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 px-6 text-slate-500 text-center">
                    No personnel matched your filters.
                  </td>
                </tr>
              ) : (
                filteredPersonnel.map((person) => (
                  <tr
                    key={person.id}
                    className="border-b text-slate-800 align-top hover:bg-slate-50"
                  >
                    <td className="py-5 px-6 font-medium whitespace-nowrap">
                      {person.name}
                    </td>

                    <td className="py-5 px-6">{person.role}</td>

                    <td className="py-5 px-6">{person.projectName}</td>

                    <td className="py-5 px-6">{person.citizenshipStatus}</td>

                    <td className="py-5 px-6">
                      {person.additionalScreeningStatus}
                    </td>

                    <td className="py-5 px-6">
                      {person.additionalScreeningDate || "—"}
                    </td>

                    <td className="py-5 px-6">{person.rpsScreeningStatus}</td>

                    <td className="py-5 px-6">
                      {person.rpsScreeningDate || "—"}
                    </td>

                    <td className="py-5 px-6">
                      <details className="group w-[260px] rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer list-none text-sm font-medium text-slate-800 flex items-center justify-between">
                          <span>{getTrainingSummary(person.trainingRecords)}</span>
                          <span className="text-slate-500 group-open:rotate-180 transition">
                            ▼
                          </span>
                        </summary>

                        <div className="mt-3 space-y-2">
                          {person.trainingRecords.map((training) => (
                            <div
                              key={`${person.id}-${training.name}`}
                              className="rounded-md border border-slate-200 bg-white px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-slate-800">
                                  {training.name}
                                </div>
                                <div>{getTrainingStatusBadge(training.status)}</div>
                              </div>

                              <div className="mt-2 space-y-1 text-xs text-slate-500">
                                <div>Completed: {training.completedOn || "—"}</div>
                                <div>Due Again: {training.dueOn || "—"}</div>
                                <div>
                                  Certificate:{" "}
                                  {training.certificateFileName || "Not Uploaded"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>

                    <td className="py-5 px-6">{getStatusBadge(person.status)}</td>

                    <td className="py-5 px-6">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/personnel/${person.id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                          Edit
                        </Link>

                        <DeletePersonnelButton
                          personnelId={person.id}
                          personnelName={person.name}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}