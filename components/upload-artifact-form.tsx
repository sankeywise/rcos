"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Props = {
  organizationId: number;
  projectId: number;
};

export default function UploadArtifactForm({
  organizationId,
  projectId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [artifactType, setArtifactType] = useState("");
  const [status, setStatus] = useState("Pending");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title || !artifactType || !file) {
      setError("Title, document type, and file are required.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setSaving(false);
        return;
      }

      const { data: insertedArtifact, error: insertError } = await supabase
        .from("artifacts")
        .insert([
          {
            organization_id: organizationId,
            project_id: projectId,
            title,
            artifact_type: artifactType,
            status,
            uploaded_by: user.email || "Authenticated User",
            uploaded_by_user_id: user.id,
          },
        ])
        .select()
        .single();

      if (insertError || !insertedArtifact) {
        throw new Error(insertError?.message || "Failed to create document record.");
      }

      const safeFileName = file.name.replace(/\s+/g, "_");
      const filePath = `${organizationId}/${projectId}/${insertedArtifact.id}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("artifacts")
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: updateError } = await supabase
        .from("artifacts")
        .update({ file_path: filePath })
        .eq("id", insertedArtifact.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setTitle("");
      setArtifactType("");
      setStatus("Pending");
      setFile(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">
        Upload Document
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            placeholder="AI Radar TCP"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Document Type
          </label>
          <select
            value={artifactType}
            onChange={(e) => setArtifactType(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white"
            required
          >
            <option value="">Select type</option>
            <option value="Technology Control Plan">Technology Control Plan</option>
            <option value="NDA">NDA</option>
            <option value="Export Review">Export Review</option>
            <option value="Training Record">Training Record</option>
            <option value="SSP Evidence">SSP Evidence</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white"
          >
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Signed">Signed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            File
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white"
            required
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Uploading..." : "Upload Document"}
        </button>
      </form>
    </div>
  );
}