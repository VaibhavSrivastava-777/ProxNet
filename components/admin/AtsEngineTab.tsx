"use client";

import React, { useState, useEffect, useCallback } from "react";

interface AtsConfigItem {
  id: string;
  company_name: string;
  provider: string;
  board_token_or_url: string;
  total_jobs_found?: number;
  last_scraped_at?: string | null;
  scrape_notes?: string | null;
}

interface AtsEngineTabProps {
  unmappedCompanies: { name: string; userCount: number }[];
  onRefresh: () => Promise<void>;
}

export function AtsEngineTab({ unmappedCompanies, onRefresh }: AtsEngineTabProps) {
  const [configs, setConfigs] = useState<AtsConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [discoveringCompany, setDiscoveringCompany] = useState<string | null>(null);
  const [seedingBatch, setSeedingBatch] = useState(false);

  // Manual Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newProvider, setNewProvider] = useState("custom");
  const [newBoard, setNewBoard] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Scraper Run State
  const [runningScraper, setRunningScraper] = useState(false);
  const [scraperLog, setScraperLog] = useState<string | null>(null);

  const fetchAtsConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ats");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } catch (e) {
      console.error("Failed to load ATS configs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAtsConfigs();
  }, [fetchAtsConfigs]);

  // 1-Click Discover Single Company
  async function handleDiscoverSingle(companyName: string) {
    setDiscoveringCompany(companyName);
    try {
      const res = await fetch("/api/admin/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Success! Discovered and configured ${data.config?.provider || "ATS"} board for "${companyName}".`);
        await fetchAtsConfigs();
        await onRefresh();
      } else {
        alert(`Could not auto-discover ATS for "${companyName}": ${data.error || "No public board detected"}`);
      }
    } catch (e: any) {
      alert(`Discovery error: ${e.message || e}`);
    } finally {
      setDiscoveringCompany(null);
    }
  }

  // Batch Auto-Discover & Seed
  async function handleBatchSeed() {
    setSeedingBatch(true);
    try {
      const res = await fetch("/api/admin/seed-ats", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Seeding complete!");
        await fetchAtsConfigs();
        await onRefresh();
      } else {
        alert(`Seeding failed: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Seeding error: ${e.message || e}`);
    } finally {
      setSeedingBatch(false);
    }
  }

  // Manual Add Form Submit
  async function handleAddConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompany.trim()) return;

    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: newCompany.trim(),
          provider: newProvider,
          board_token_or_url: newBoard.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewCompany("");
        setNewBoard("");
        await fetchAtsConfigs();
        await onRefresh();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Save error: ${e.message || e}`);
    } finally {
      setSavingConfig(false);
    }
  }

  // Delete ATS Config
  async function handleDeleteConfig(id: string, companyName: string) {
    if (!confirm(`Delete ATS configuration for "${companyName}"?`)) return;
    try {
      const res = await fetch(`/api/admin/ats?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAtsConfigs();
        await onRefresh();
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Delete error: ${e.message || e}`);
    }
  }

  // Trigger 3-Agent Scraper Pipeline
  async function handleTriggerScraper(companyName?: string) {
    setRunningScraper(true);
    setScraperLog(null);
    try {
      const body = companyName ? { companies: [companyName] } : {};
      const res = await fetch("/api/admin/scrape-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setScraperLog(`Scraper Run Complete: Added ${data.totalAdded || 0} jobs in ${(data.durationMs / 1000).toFixed(1)}s.`);
        await fetchAtsConfigs();
        await onRefresh();
      } else {
        setScraperLog(`Scraper Error: ${data.error || "Failed to execute"}`);
      }
    } catch (e: any) {
      setScraperLog(`Scraper Error: ${e.message || e}`);
    } finally {
      setRunningScraper(false);
    }
  }

  // Filtered configs
  const filteredConfigs = configs.filter((c) => {
    const matchesSearch = c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.board_token_or_url || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = providerFilter === "all" || c.provider.toLowerCase() === providerFilter.toLowerCase();
    return matchesSearch && matchesProvider;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border-light)] shadow-[var(--shadow-sm)]">
        <div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">ATS & Job Pipeline Engine</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Manage career boards, auto-discover ATS scrapers, and sync fresh peer job listings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleBatchSeed}
            disabled={seedingBatch}
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
          >
            {seedingBatch ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Seeding...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Auto-Discover All Unmapped</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleTriggerScraper()}
            disabled={runningScraper}
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
          >
            {runningScraper ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Run Scraper Pipeline</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm text-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add ATS Board</span>
          </button>
        </div>
      </div>

      {scraperLog && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs font-mono flex items-center justify-between animate-fadeIn">
          <span>{scraperLog}</span>
          <button onClick={() => setScraperLog(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Optimal Network Coverage Banner */}
      {unmappedCompanies.length === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="font-semibold">Network ATS Coverage Optimal:</span>
            <span>All registered user companies are actively mapped to ATS scrapers or verified for direct candidate referrals.</span>
          </div>
        </div>
      )}

      {/* Action Center: Unmapped Network Companies */}
      {unmappedCompanies.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-amber-500/30 rounded-2xl p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge badge-warning text-xs font-bold px-2 py-0.5 rounded-full">
                  Action Needed ({unmappedCompanies.length})
                </span>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Unmapped Network Companies
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                These companies belong to registered users in ProxNet, but do not have an active ATS scraper mapped yet.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {unmappedCompanies.map((c) => (
              <div
                key={c.name}
                className="bg-[var(--color-surface-hover)]/60 border border-[var(--color-border-light)] p-3 rounded-xl flex items-center justify-between gap-2"
              >
                <div className="truncate">
                  <div className="font-semibold text-xs text-[var(--color-text-primary)] truncate" title={c.name}>
                    {c.name}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-tertiary)]">
                    {c.userCount} user{c.userCount > 1 ? "s" : ""} at this company
                  </div>
                </div>

                <button
                  onClick={() => handleDiscoverSingle(c.name)}
                  disabled={discoveringCompany === c.name}
                  className="btn btn-ghost btn-sm text-[11px] px-2 py-1 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface)] shrink-0 border border-[var(--color-primary-subtle)]"
                >
                  {discoveringCompany === c.name ? "Searching..." : "⚡ Auto-Detect"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configured ATS Boards Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Configured ATS Boards ({filteredConfigs.length})
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Target job boards actively scraped for peer candidate matching.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm text-xs w-44"
            />

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="select select-sm text-xs"
            >
              <option value="all">All Providers</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="ashby">Ashby</option>
              <option value="smartrecruiters">SmartRecruiters</option>
              <option value="workday">Workday</option>
              <option value="oracle">Oracle</option>
              <option value="custom">Custom URL</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-lg w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border-light)]">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)]">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Company</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Provider</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Token / Career URL</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Jobs Found</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Last Scraped</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {filteredConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                      No ATS boards match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredConfigs.slice(0, 50).map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--color-surface-hover)]/40 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-[var(--color-text-primary)]">
                        {c.company_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="badge badge-accent text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                          {c.provider}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-secondary)] font-mono max-w-[200px] truncate" title={c.board_token_or_url}>
                        {c.board_token_or_url || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-[var(--color-text-primary)]">
                        {c.total_jobs_found || 0}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-tertiary)]">
                        {c.last_scraped_at ? new Date(c.last_scraped_at).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-2">
                        <button
                          onClick={() => handleTriggerScraper(c.company_name)}
                          disabled={runningScraper}
                          className="text-[var(--color-primary)] hover:underline font-semibold"
                        >
                          Scrape
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(c.id, c.company_name)}
                          className="text-[var(--color-error)] hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Add Company ATS Board</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">✕</button>
            </div>

            <form onSubmit={handleAddConfig} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Zerodha, Stripe"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="input input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">ATS Strategy / Provider</label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  className="select select-sm w-full text-xs"
                >
                  <option value="custom">Custom Career URL (AI extraction)</option>
                  <option value="greenhouse">Greenhouse (boards.greenhouse.io)</option>
                  <option value="lever">Lever (jobs.lever.co)</option>
                  <option value="ashby">Ashby (jobs.ashbyhq.com)</option>
                  <option value="smartrecruiters">SmartRecruiters</option>
                  <option value="workday">Workday</option>
                  <option value="oracle">Oracle HCM</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Board Token or Career URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. 'stripe' or 'https://careers.company.com'"
                  value={newBoard}
                  onChange={(e) => setNewBoard(e.target.value)}
                  className="input input-sm w-full text-xs font-mono"
                />
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                  Leave empty if you want our AI agent to auto-discover the career URL.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border-light)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="btn btn-primary btn-sm text-xs"
                >
                  {savingConfig ? "Saving..." : "Save Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
