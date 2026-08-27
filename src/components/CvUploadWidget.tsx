"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CvUploadWidget({ jobId }: { jobId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ filename: string; error?: string }[] | null>(null);

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setResults(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    const res = await fetch(`/api/jobs/${jobId}/applications`, {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";

    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
      router.refresh();
    } else {
      setResults([{ filename: "Upload", error: "Something went wrong. Please try again." }]);
    }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-1 font-display font-semibold">Upload CVs</h3>
      <p className="mb-3 text-sm text-muted">
        Upload one or more PDF/DOCX files. Each CV is extracted, scored, and explained
        automatically.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        className="input mb-3 file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent-hover"
      />

      {files.length > 0 && (
        <p className="mb-3 text-xs text-muted">{files.length} file(s) selected</p>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading || files.length === 0}
        className="btn-primary"
      >
        {uploading ? "Processing…" : "Upload & qualify"}
      </button>

      {results && (
        <ul className="mt-4 space-y-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className={r.error ? "text-danger" : "text-success"}>
              {r.filename}: {r.error || "processed"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
