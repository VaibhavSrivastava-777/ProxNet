"use client";

import { useState, useRef } from "react";

interface ResumeCardProps {
  hasResume: boolean;
  resumeUrl?: string | null;
  onResumeUpdated: () => void;
}

export function ResumeCard({ hasResume, resumeUrl, onResumeUpdated }: ResumeCardProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg("Please upload a PDF document (.pdf).");
        setTimeout(() => setErrorMsg(""), 5000);
        return;
      }
      await processFileUpload(file);
    }
  };

  const processFileUpload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please upload a PDF document (.pdf).");
      setTimeout(() => setErrorMsg(""), 5000);
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setUploadStep("Uploading and parsing resume...");

    try {
      // 1. Upload and parse PDF text
      const formData = new FormData();
      formData.append("file", file);

      const parseRes = await fetch("/api/profile/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) {
        const errText = await parseRes.text();
        throw new Error(errText || "Failed to parse resume document.");
      }

      const parseData = await parseRes.json();
      setUploadStep("Updating AI embeddings and automated job alert criteria...");

      // 2. Patch user profile with parsed text and resume URL
      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_url: parseData.resume_url,
          resume_text: parseData.resume_text,
          about: parseData.about || undefined,
          company: parseData.company || undefined,
          job_title: parseData.job_title || undefined,
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Failed to save resume profile changes.");
      }

      setSuccessMsg("Resume updated successfully! Automated job alerts and match scores have been refreshed.");
      setTimeout(() => setSuccessMsg(""), 6000);

      // Trigger re-fetch of jobs & match scores in parent view
      onResumeUpdated();
    } catch (err: unknown) {
      console.error("[ResumeCard] Upload failed:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to process resume. Please try again.";
      setErrorMsg(errMsg);
      setTimeout(() => setErrorMsg(""), 6000);
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Uploading In-Flight Progress State */}
      {uploading && (
        <div className="p-5 rounded-xl border border-primary/40 bg-primary/5 dark:bg-primary/10 flex flex-col items-center justify-center gap-3 animate-pulse shadow-sm">
          <div className="flex items-center gap-2.5 text-primary font-semibold text-sm">
            <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>{uploadStep}</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 text-center">
            Extracting skills, computing vector embeddings, and re-calculating match scores...
          </p>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 mb-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span>✅</span> {successMsg}
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-3 mb-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {/* State A: User does NOT have a resume */}
      {!uploading && !hasResume && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border ${
            isDragOver ? "border-primary bg-primary/20 scale-[1.01]" : "border-primary/30"
          } rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm transition-all animate-fadeInUp`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl sm:text-3xl shrink-0 mt-0.5">📄</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm sm:text-base text-[var(--color-text)] m-0">
                  Upload Resume for Automated Job Alerts & 90%+ Match Accuracy
                </h4>
                <span className="badge bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 font-bold">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 m-0 leading-relaxed max-w-xl">
                Your uploaded resume enables ProxNet to generate automated job alerts, calculate skill fit scores, and match you with internal referrers whenever new jobs are scraped across network companies.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary btn-sm shrink-0 shadow-sm font-semibold flex items-center gap-2 self-stretch sm:self-auto justify-center px-4 py-2 cursor-pointer"
          >
            <span>🚀</span>
            <span>Upload Resume (PDF)</span>
          </button>
        </div>
      )}

      {/* State B: User HAS an active resume */}
      {!uploading && hasResume && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`p-3.5 sm:p-4 rounded-xl border ${
            isDragOver ? "border-primary bg-primary/10" : "border-[var(--color-border-light)] bg-[var(--color-surface)]"
          } shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all animate-fadeIn`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shrink-0">
              <span className="text-base">📄</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[var(--color-text)]">
                  Active Resume Linked
                </span>
                <span className="badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.2 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active for Match Alerts
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] m-0 mt-0.5 leading-snug">
                Powering daily automated job alerts, AI match scoring, and referrer recommendations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
            {resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border-light)] text-[var(--color-text)] border border-[var(--color-border-light)] text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 no-underline"
                title="View uploaded resume PDF"
              >
                <span>👁️</span>
                <span>View</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-sm btn-primary text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Upload an updated resume to replace current file"
            >
              <span>🔄</span>
              <span>Replace Resume</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
