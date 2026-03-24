"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useState } from "react";

type Props = {
  artifactId: number;
  filePath: string | null;
};

export default function DeleteArtifactButton({
  artifactId,
  filePath,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this artifact?"
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from("artifacts")
          .remove([filePath]);

        if (storageError) {
          throw new Error(`Storage delete failed: ${storageError.message}`);
        }
      }

      const { error: dbError } = await supabase
        .from("artifacts")
        .delete()
        .eq("id", artifactId);

      if (dbError) {
        throw new Error(`Artifact delete failed: ${dbError.message}`);
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete artifact.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}