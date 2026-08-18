"use client";

import { useEffect, useState } from "react";

interface TargetCompany {
  id: string;
  company_name: string;
  careers_url: string;
  ats_provider: string;
  scrape_status: string;
  total_jobs_found: number;
  match_count: number;
}

interface TargetCompanyManagerProps {
  onCompaniesChanged?: () => void;
}

export function TargetCompanyManager({ onCompaniesChanged }: TargetCompanyManagerProps) {
  const [companies, setCompanies] = useState<TargetCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompany, setNewCompany] = useState("");
  const [careerUrl, setCareerUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchTargets = async () => {
    try {
      const res = await fetch("/api/user-target-companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.targetCompanies || []);
      }
    } catch (e) {
      console.error("Failed to load target companies:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim()) return;

    const companyToAdd = newCompany.trim();
    setAdding(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user-target-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyToAdd,
          careers_url: careerUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setNewCompany("");
        setCareerUrl("");
        setMessage({
          text: `Added ${companyToAdd} (${data.ats_provider}) — ${data.jobsSaved || 0} jobs scraped & matched!`,
          type: "success",
        });
        await fetchTargets();
        if (onCompaniesChanged) onCompaniesChanged();
      } else {
        throw new Error(data.error || "Failed to add target company");
      }
    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to add company. Please try again.",
        type: "error",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCompany = async (companyName: string) => {
    setDeleting(companyName);
    setMessage(null);

    try {
      const res = await fetch(`/api/user-target-companies?company=${encodeURIComponent(companyName)}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCompanies(prev => prev.filter(c => c.company_name.toLowerCase().trim() !== companyName.toLowerCase().trim()));
        setMessage({
          text: `Removed ${companyName} from target companies.`,
          type: "success",
        });
        if (onCompaniesChanged) onCompaniesChanged();
      } else {
        throw new Error(data.error || "Failed to remove company");
      }
    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to delete company.",
        type: "error",
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] animate-pulse flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span>Loading Target Companies...</span>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-primary)]/20 bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-primary-subtle)]/20 shadow-xs flex flex-col gap-3 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          <span className="text-base">🏢</span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider m-0">
                Target Companies
              </h4>
              <span className="text-[10px] font-bold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] px-2 py-0.5 rounded-full border border-[var(--color-primary)]/20">
                {companies.length} Targets
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              Scraped daily for roles matching your resume
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
        >
          {isExpanded ? "Collapse" : "Manage & Add"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Target Company Chips Preview (Collapsed or Expanded) */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {companies.map((c) => (
          <div
            key={c.id || c.company_name}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors group"
          >
            <span>{c.company_name}</span>
            {c.match_count > 0 && (
              <span className="text-[10px] font-bold text-[#E56B42] bg-[#E56B42]/10 px-1.5 py-0.2 rounded-full">
                {c.match_count}
              </span>
            )}
            <button
              type="button"
              disabled={deleting === c.company_name}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCompany(c.company_name);
              }}
              className="text-[var(--color-text-tertiary)] hover:text-red-500 transition-colors border-none bg-transparent p-0 cursor-pointer ml-0.5"
              title={`Remove ${c.company_name}`}
            >
              {deleting === c.company_name ? "..." : "×"}
            </button>
          </div>
        ))}
      </div>

      {/* Expandable Management Form */}
      {isExpanded && (
        <div className="pt-3 border-t border-[var(--color-border-light)] flex flex-col gap-3 animate-fadeIn">
          {message && (
            <div className={`p-2.5 rounded-lg text-xs font-medium ${message.type === "success" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-red-500/10 text-red-600 border border-red-500/20"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAddCompany} className="flex flex-col gap-2.5">
            <span className="text-xs font-bold text-[var(--color-text)]">Add Custom Target Company</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Company Name (e.g., Zscaler, Uber, Razorpay)"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                disabled={adding}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                required
              />
              <input
                type="url"
                placeholder="Careers Page URL (optional)"
                value={careerUrl}
                onChange={(e) => setCareerUrl(e.target.value)}
                disabled={adding}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <button
                type="submit"
                disabled={adding || !newCompany.trim()}
                className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0 flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                {adding ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Scraping ATS...
                  </>
                ) : (
                  "+ Add & Scrape"
                )}
              </button>
            </div>
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              ProxNet will automatically discover the company&apos;s ATS board (Lever, Greenhouse, Ashby, Workday, etc.), scrape active India postings, generate vector embeddings, and compute match rates against your resume.
            </span>
          </form>
        </div>
      )}
    </div>
  );
}
