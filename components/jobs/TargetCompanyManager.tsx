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
  const [scrapingAll, setScrapingAll] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState("");
  const [updatingUrl, setUpdatingUrl] = useState(false);
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

  const handleRunFullScrape = async () => {
    setScrapingAll(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user-target-companies/scrape", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          text: `⚡ Full scrape & match complete! Discovered ${data.totalScraped} active jobs across ${data.totalCompanies} target companies (${data.totalSaved} saved).`,
          type: "success",
        });
        await fetchTargets();
        if (onCompaniesChanged) onCompaniesChanged();
      } else {
        throw new Error(data.error || "Scrape failed");
      }
    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to execute scrape.",
        type: "error",
      });
    } finally {
      setScrapingAll(false);
    }
  };

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
        const count = data.jobs_scraped ?? 0;
        const saved = data.jobs_saved ?? count;

        if (data.needs_url) {
          setMessage({
            text: `⚠️ ${companyToAdd} added! We could not auto-detect the ATS board. Please click "Add URL" on the chip to supply their careers page.`,
            type: "error",
          });
        } else if (count > 0) {
          setMessage({
            text: `⚡ Successfully scraped ${count} active opening${count > 1 ? "s" : ""} (${saved} saved) for ${companyToAdd} (${data.ats_provider}) in real-time!`,
            type: "success",
          });
        } else {
          setMessage({
            text: `Target company ${companyToAdd} recorded (${data.ats_provider}). ${data.message || ""}`,
            type: "success",
          });
        }

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

  const handleUpdateCompanyUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !editUrlInput.trim()) return;

    setUpdatingUrl(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user-target-companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: editingCompany,
          careers_url: editUrlInput.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          text: data.jobs_scraped > 0
            ? `⚡ Scraped ${data.jobs_scraped} active openings (${data.jobs_saved} saved) for ${editingCompany}!`
            : `Updated careers URL for ${editingCompany}. ${data.message || ""}`,
          type: "success",
        });
        setEditingCompany(null);
        setEditUrlInput("");
        await fetchTargets();
        if (onCompaniesChanged) onCompaniesChanged();
      } else {
        throw new Error(data.error || "Failed to update URL");
      }
    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to update careers URL",
        type: "error",
      });
    } finally {
      setUpdatingUrl(false);
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={scrapingAll}
            onClick={(e) => {
              e.stopPropagation();
              handleRunFullScrape();
            }}
            className="px-2.5 py-1 bg-[var(--color-primary)] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer border-none shadow-xs"
            title="Scrape all target companies right now"
          >
            {scrapingAll ? (
              <>
                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Scraping...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span className="hidden sm:inline">Run Scrape & Match</span>
                <span className="sm:hidden">Scrape</span>
              </>
            )}
          </button>

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
      </div>

      {/* Target Company Chips Preview (Collapsed or Expanded) */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {companies.map((c) => {
          const isNeedsUrl = c.scrape_status === "no_ats" || c.scrape_status === "needs_url" || (!c.careers_url && c.ats_provider === "none");
          const isFailed = c.scrape_status === "failed";
          const isSuccess = c.total_jobs_found > 0 || c.scrape_status === "success";

          return (
            <div
              key={c.id || c.company_name}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isNeedsUrl
                  ? "bg-amber-500/10 border border-amber-500/30 text-[var(--color-text)]"
                  : isFailed
                  ? "bg-red-500/10 border border-red-500/30 text-[var(--color-text)]"
                  : "bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-[var(--color-text)]"
              } hover:border-[var(--color-primary)]/40 group`}
            >
              <span>{c.company_name}</span>

              {isSuccess && c.total_jobs_found > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.2 rounded-full">
                  {c.total_jobs_found} {c.total_jobs_found === 1 ? "job" : "jobs"}
                </span>
              )}

              {isNeedsUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCompany(c.company_name);
                    setEditUrlInput(c.careers_url || "");
                    setIsExpanded(true);
                  }}
                  className="text-[10px] font-bold text-amber-700 bg-amber-500/20 px-1.5 py-0.5 rounded hover:bg-amber-500/30 transition-colors border-none cursor-pointer"
                  title="Click to add careers URL"
                >
                  + Add URL
                </button>
              )}

              {isFailed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCompany(c.company_name);
                    setEditUrlInput(c.careers_url || "");
                    setIsExpanded(true);
                  }}
                  className="text-[10px] font-bold text-red-600 bg-red-500/15 px-1.5 py-0.5 rounded hover:bg-red-500/25 transition-colors border-none cursor-pointer"
                  title="Scrape failed. Click to verify or change URL."
                >
                  Fix URL
                </button>
              )}

              {c.match_count > 0 && (
                <span className="text-[10px] font-bold text-[#E56B42] bg-[#E56B42]/10 px-1.5 py-0.2 rounded-full" title={`${c.match_count} roles matching your profile`}>
                  {c.match_count} matches
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
          );
        })}
      </div>

      {/* Inline Careers URL Update Bar */}
      {editingCompany && (
        <form onSubmit={handleUpdateCompanyUrl} className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row items-center gap-2 animate-fadeIn">
          <div className="flex-1 flex flex-col gap-0.5 w-full">
            <span className="text-[11px] font-bold text-amber-700">
              Provide Direct Careers URL for <span className="underline">{editingCompany}</span>:
            </span>
            <input
              type="url"
              placeholder="e.g., https://boards.greenhouse.io/xyz, https://jobs.lever.co/xyz, or https://company.com/careers"
              value={editUrlInput}
              onChange={(e) => setEditUrlInput(e.target.value)}
              disabled={updatingUrl}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-500/30 bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-amber-600"
              required
              autoFocus
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="submit"
              disabled={updatingUrl || !editUrlInput.trim()}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer flex items-center gap-1"
            >
              {updatingUrl ? "Scraping..." : "⚡ Save & Scrape"}
            </button>
            <button
              type="button"
              disabled={updatingUrl}
              onClick={() => {
                setEditingCompany(null);
                setEditUrlInput("");
              }}
              className="px-2.5 py-1.5 bg-transparent text-[var(--color-text-secondary)] text-xs font-semibold rounded-lg hover:bg-[var(--color-surface-secondary)] border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
