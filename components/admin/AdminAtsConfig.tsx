"use client";

import { useEffect, useState } from "react";
import { isIndianOrIndianRemote } from "@/lib/scrapers/utils";

interface AtsConfig {
  id: string;
  company_name: string;
  provider: string;
  board_token_or_url: string;
  created_at: string;
  last_scraped_at?: string;
  scrape_notes?: string;
}

export function AdminAtsConfig() {
  const [configs, setConfigs] = useState<AtsConfig[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [provider, setProvider] = useState("custom");
  const [boardToken, setBoardToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "mapped" | "unmapped">("all");

  // Modal UI states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeAuditLog, setActiveAuditLog] = useState<{
    companyName: string;
    lastScraped?: string;
    notes?: string;
    isError: boolean;
  } | null>(null);

  // Dry run result state
  const [dryRunResults, setDryRunResults] = useState<{
    companyName: string;
    jobs: any[];
    error?: string;
  } | null>(null);

  // Scraping states per company ID
  const [scrapingStates, setScrapingStates] = useState<Record<string, {
    stage: 'idle' | 'identifying' | 'scraping' | 'success' | 'error';
    message?: string;
    found?: number;
    added?: number;
  }>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const res = await fetch("/api/admin/ats");
      const data = await res.json();
      if (data.configs) setConfigs(data.configs);
      if (data.availableCompanies) {
        setAvailableCompanies(data.availableCompanies);
        if (data.availableCompanies.length > 0 && !companyName) {
          setCompanyName(data.availableCompanies[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName) {
      alert("Please select a company");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName, provider, board_token_or_url: boardToken }),
      });
      const data = await res.json();
      if (data.config) {
        setConfigs([data.config, ...configs]);
        // Remove the added company from available list
        const updatedAvailable = availableCompanies.filter(c => c !== companyName);
        setAvailableCompanies(updatedAvailable);
        if (updatedAvailable.length > 0) {
          setCompanyName(updatedAvailable[0]);
        } else {
          setCompanyName("");
        }
        setBoardToken("");
        setIsAddModalOpen(false); // Close Modal
      } else {
        alert(data.error || "Failed to add ATS config");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving config");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this config?")) return;
    try {
      await fetch(`/api/admin/ats?id=${id}`, { method: "DELETE" });
      const deletedConfig = configs.find(c => c.id === id);
      setConfigs(configs.filter((c) => c.id !== id));
      if (deletedConfig) {
        // Add back to available companies
        const newAvailable = [...availableCompanies, deletedConfig.company_name].sort();
        setAvailableCompanies(newAvailable);
        if (!companyName) {
          setCompanyName(deletedConfig.company_name);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete");
    }
  }

  async function handleDiscover(targetCompany?: string) {
    const compToDiscover = targetCompany || companyName;
    if (!compToDiscover) {
      alert("Please select or enter a company name to discover.");
      return;
    }

    setDiscovering(true);
    try {
      const res = await fetch("/api/admin/ats/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: compToDiscover })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Auto-discovery failed.");
      }

      if (data.provider) setProvider(data.provider);
      if (data.boardToken) setBoardToken(data.boardToken);

      if (targetCompany) {
        setCompanyName(targetCompany);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to auto-discover configuration.");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleDryRun(companyName: string, isMapped: boolean, itemId: string) {
    if (!isMapped) {
      // Guide user to map first
      setCompanyName(companyName);
      setIsAddModalOpen(true);
      handleDiscover(companyName);
      return;
    }

    setScrapingStates(prev => ({
      ...prev,
      [itemId]: { stage: 'identifying', message: 'Dry run starting...' }
    }));

    try {
      const res = await fetch("/api/admin/scrape-jobs/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Dry run failed");
      }

      setDryRunResults({
        companyName,
        jobs: data.jobs || []
      });

      setScrapingStates(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } catch (err: any) {
      console.error(err);
      setScrapingStates(prev => ({
        ...prev,
        [itemId]: {
          stage: 'error',
          message: err.message || "Dry run failed"
        }
      }));
      setDryRunResults({
        companyName,
        jobs: [],
        error: err.message || "Dry run failed"
      });
    }
  }

  async function handleScrape(companyName: string, isMapped: boolean, itemId: string) {
    if (!isMapped) {
      setCompanyName(companyName);
      setIsAddModalOpen(true);
      handleDiscover(companyName);
      return;
    }

    setScrapingStates(prev => ({
      ...prev,
      [itemId]: { stage: 'scraping' }
    }));

    try {
      const res = await fetch("/api/admin/scrape-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: [companyName] })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Scraping failed");
      }

      const companyStat = data.stats?.[companyName];
      if (companyStat && companyStat.error) {
        throw new Error(companyStat.error);
      }

      setScrapingStates(prev => ({
        ...prev,
        [itemId]: {
          stage: 'success',
          found: companyStat ? companyStat.totalFound : 0,
          added: companyStat ? companyStat.totalAdded : 0
        }
      }));

      // Refresh configs to pull in updated DB scrape notes and dates
      fetchConfigs();

      // Auto clear success state after 10s
      setTimeout(() => {
        setScrapingStates(prev => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
      }, 10000);

    } catch (err: any) {
      console.error(err);
      setScrapingStates(prev => ({
        ...prev,
        [itemId]: {
          stage: 'error',
          message: err.message || "Scraping failed"
        }
      }));
    }
  }

  if (loading) return <div className="p-4 text-center">Loading ATS configs...</div>;

  // Combine mapped and unmapped companies for rendering
  const mappedList = configs.map(c => ({
    id: c.id,
    company_name: c.company_name,
    provider: c.provider,
    board_token_or_url: c.board_token_or_url,
    created_at: c.created_at,
    last_scraped_at: c.last_scraped_at,
    scrape_notes: c.scrape_notes,
    isMapped: true
  }));

  const unmappedList = availableCompanies.map((name) => ({
    id: `unmapped-${name}`,
    company_name: name,
    provider: "none",
    board_token_or_url: "Not Configured",
    created_at: "",
    last_scraped_at: undefined,
    scrape_notes: undefined,
    isMapped: false
  }));

  const allCompaniesToDisplay = [...mappedList, ...unmappedList]
    .sort((a, b) => a.company_name.localeCompare(b.company_name))
    .filter(item => {
      // 1. Search filter
      const matchesSearch = item.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.provider.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Tab filter
      if (filterTab === "mapped") return matchesSearch && item.isMapped;
      if (filterTab === "unmapped") return matchesSearch && !item.isMapped;
      return matchesSearch;
    });

  const totalMapped = mappedList.length;
  const totalUnmapped = unmappedList.length;

  return (
    <div className="card border border-primary/20 bg-surface shadow-sm">
      <div className="p-6">
        
        {/* Metric summary banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-background border border-border p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-primary">{totalMapped + totalUnmapped}</div>
            <div className="text-xs text-text-secondary mt-1">Total Companies</div>
          </div>
          <div className="bg-background border border-border p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-success">{totalMapped}</div>
            <div className="text-xs text-text-secondary mt-1">Mapped ATS</div>
          </div>
          <div className="bg-background border border-border p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-warning">{totalUnmapped}</div>
            <div className="text-xs text-text-secondary mt-1">Unmapped</div>
          </div>
          <div className="bg-background border border-border p-4 rounded-xl text-center flex items-center justify-center">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary w-full py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm"
            >
              <span>+ Add ATS Mapping</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          {/* Navigation Tabs */}
          <div className="flex bg-background border border-border p-1 rounded-lg w-full md:w-auto">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex-1 md:flex-none py-1.5 px-4 text-xs font-semibold rounded-md transition-all ${
                filterTab === "all" ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              All ({totalMapped + totalUnmapped})
            </button>
            <button
              onClick={() => setFilterTab("mapped")}
              className={`flex-1 md:flex-none py-1.5 px-4 text-xs font-semibold rounded-md transition-all ${
                filterTab === "mapped" ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Mapped ({totalMapped})
            </button>
            <button
              onClick={() => setFilterTab("unmapped")}
              className={`flex-1 md:flex-none py-1.5 px-4 text-xs font-semibold rounded-md transition-all ${
                filterTab === "unmapped" ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Unmapped ({totalUnmapped})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search companies..."
              className="input w-full pl-8 py-1.5 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-2.5 top-2.5 text-text-secondary text-sm">🔍</span>
          </div>
        </div>

        {allCompaniesToDisplay.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-border rounded-xl text-text-secondary">
            No companies found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Provider</th>
                  <th>Board Token / URL</th>
                  <th>Last Scraped Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allCompaniesToDisplay.map((item) => {
                  const state = scrapingStates[item.id];
                  
                  // Check error state or previous database notes
                  const hasActiveError = state?.stage === 'error' || 
                                        (!state && item.scrape_notes?.toLowerCase().startsWith("failed"));

                  const hasActiveSuccess = state?.stage === 'success' ||
                                          (!state && item.last_scraped_at && !item.scrape_notes?.toLowerCase().startsWith("failed"));

                  return (
                    <tr key={item.id} className={`hover:bg-surface-secondary/40 transition-colors ${!item.isMapped ? "opacity-80" : ""}`}>
                      <td className="font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          <span>{item.company_name}</span>
                          {!item.isMapped && (
                            <span className="badge bg-warning-bg text-warning text-[10px] border border-warning/20 font-bold px-2 py-0.5 rounded-full">
                              Unmapped
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {item.isMapped ? (
                          <span className={`badge uppercase text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                            item.provider === 'greenhouse' ? 'bg-green-100 text-green-800 border border-green-200' : 
                            item.provider === 'lever' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            item.provider === 'workday' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' :
                            'bg-surface border border-border text-text-secondary'
                          }`}>
                            {item.provider}
                          </span>
                        ) : (
                          <span className="text-xs text-text-tertiary">None</span>
                        )}
                      </td>
                      <td className="font-mono text-xs max-w-xs truncate text-text-secondary" title={item.board_token_or_url}>
                        {item.board_token_or_url}
                      </td>
                      <td>
                        {/* Interactive click-for-audit-log display */}
                        {state?.stage === 'identifying' && (
                          <span className="text-xs text-primary font-medium flex items-center gap-1.5">
                            <span className="animate-ping rounded-full h-2 w-2 bg-primary"></span> Identifying...
                          </span>
                        )}
                        {state?.stage === 'scraping' && (
                          <span className="text-xs text-accent font-medium flex items-center gap-1.5">
                            <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-accent border-t-transparent"></span> Scraping...
                          </span>
                        )}
                        {!state && !item.last_scraped_at && (
                          <span className="text-xs text-text-tertiary">-</span>
                        )}

                        {/* Success Status (Clickable to open Log Modal) */}
                        {hasActiveSuccess && (
                          <button
                            onClick={() => setActiveAuditLog({
                              companyName: item.company_name,
                              lastScraped: item.last_scraped_at,
                              notes: item.scrape_notes || `Jobs queried: ${state?.found || 'Unknown'} | Mapped: ${state?.added || 'Unknown'}`,
                              isError: false
                            })}
                            className="btn btn-ghost p-0 text-xs text-success font-semibold flex items-center gap-1 hover:underline text-success"
                          >
                            <span>✅ Scraped</span>
                            <span className="text-[10px] text-text-tertiary font-mono">
                              ({item.last_scraped_at ? new Date(item.last_scraped_at).toLocaleDateString() : 'Just now'})
                            </span>
                          </button>
                        )}

                        {/* Error Status (Clickable to open Log Modal) */}
                        {hasActiveError && (
                          <button
                            onClick={() => setActiveAuditLog({
                              companyName: item.company_name,
                              lastScraped: item.last_scraped_at,
                              notes: state?.message || item.scrape_notes || "Job pulling execution failed.",
                              isError: true
                            })}
                            className="btn btn-ghost p-0 text-xs text-error font-semibold flex items-center gap-1 hover:underline text-error"
                          >
                            <span>⚠️ Error Log</span>
                          </button>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleScrape(item.company_name, item.isMapped, item.id)}
                            disabled={state?.stage === 'identifying' || state?.stage === 'scraping'}
                            className="btn btn-ghost hover:bg-surface-hover py-1 px-3 text-xs h-8 whitespace-nowrap text-text-primary"
                          >
                            Scrape
                          </button>
                          <button
                            onClick={() => handleDryRun(item.company_name, item.isMapped, item.id)}
                            disabled={state?.stage === 'identifying' || state?.stage === 'scraping'}
                            className="btn btn-secondary border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50 py-1 px-3 text-xs h-8 whitespace-nowrap"
                          >
                            Test
                          </button>
                          {item.isMapped ? (
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={state?.stage === 'identifying' || state?.stage === 'scraping'}
                              className="text-error hover:text-red-700 hover:underline text-xs font-semibold px-2 py-1"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-text-tertiary text-xs cursor-not-allowed select-none px-2 py-1">Delete</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modern Modal to ADD ATS MAPPING */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-primary/20 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scaleUp">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background/55 sticky top-0">
              <div>
                <h3 className="text-lg font-bold text-text-primary">✨ Add Company ATS Mapping</h3>
                <p className="text-xs text-text-secondary mt-1">Configure job board details for automated pulling.</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-secondary hover:text-text-primary text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="p-6 space-y-4 text-left">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block flex justify-between items-center">
                  <span>ProxNet Company Name</span>
                  {companyName && (
                    <button
                      type="button"
                      onClick={() => handleDiscover()}
                      disabled={discovering}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      {discovering ? "Discovering..." : "✨ Auto-Discover"}
                    </button>
                  )}
                </label>
                <select
                  className="input w-full py-2 text-sm"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  disabled={availableCompanies.length === 0}
                >
                  {availableCompanies.length === 0 && <option value="">No companies available</option>}
                  {availableCompanies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">ATS Provider</label>
                <select className="input w-full py-2 text-sm" value={provider} onChange={(e) => {
                  setProvider(e.target.value);
                  setBoardToken("");
                }}>
                  <option value="custom">Custom (Auto-Detect from URL)</option>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                  <option value="workday">Workday</option>
                  <option value="workable">Workable</option>
                  <option value="breezy">Breezy</option>
                  <option value="recruitee">Recruitee</option>
                  <option value="smartrecruiters">SmartRecruiters</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">
                  {provider === "custom" || provider === "workday" ? "Sample Job URL / API Endpoint" : "Board Token"}
                </label>
                <input
                  type="text"
                  placeholder={
                    provider === "workday" ? "e.g. accenture.wd3.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs" :
                    provider === "custom" ? "e.g. https://jobs.lever.co/netflix/123" : "e.g. netflix"
                  }
                  className="input w-full py-2 text-sm"
                  value={boardToken}
                  onChange={(e) => setBoardToken(e.target.value)}
                  required
                />
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary py-2 text-sm"
                  disabled={saving || availableCompanies.length === 0}
                >
                  {saving ? "Adding..." : "Add Mapping"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Modal to view AUDIT SCAPE LOG */}
      {activeAuditLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-primary/20 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scaleUp">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background/55">
              <div>
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>📊 Scrape Audit Log:</span>
                  <span className="text-primary font-mono">{activeAuditLog.companyName}</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">Details of the latest scrape execution window.</p>
              </div>
              <button 
                onClick={() => setActiveAuditLog(null)}
                className="text-text-secondary hover:text-text-primary text-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background border border-border p-3 rounded-lg">
                  <div className="text-xs text-text-secondary">Execution Status</div>
                  <div className={`text-sm font-bold mt-0.5 ${activeAuditLog.isError ? "text-error" : "text-success"}`}>
                    {activeAuditLog.isError ? "❌ FAILED" : "✅ SUCCESSFUL"}
                  </div>
                </div>
                <div className="bg-background border border-border p-3 rounded-lg">
                  <div className="text-xs text-text-secondary">Execution Date</div>
                  <div className="text-sm font-bold text-text-primary mt-0.5">
                    {activeAuditLog.lastScraped ? new Date(activeAuditLog.lastScraped).toLocaleString() : "Just now"}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-text-secondary mb-1">Execution Details / Output Notes</div>
                <div className={`p-4 rounded-lg border font-mono text-xs leading-relaxed max-h-48 overflow-y-auto ${
                  activeAuditLog.isError ? "bg-red-50 text-red-900 border-red-200" : "bg-green-50 text-green-900 border-green-200"
                }`}>
                  {activeAuditLog.notes || "No additional execution logs captured."}
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveAuditLog(null)}
                  className="btn btn-primary text-sm px-5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dry Run Test Results Modal */}
      {dryRunResults && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-primary/20 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scaleUp">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background/55 sticky top-0">
              <div>
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>🔬 Test (Dry Run) Results:</span>
                  <span className="text-primary font-mono">{dryRunResults.companyName}</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Limited fetch (Max 2 jobs) bypasses timeframes and databases to test integration connection.
                </p>
              </div>
              <button 
                onClick={() => setDryRunResults(null)}
                className="text-text-secondary hover:text-text-primary text-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {dryRunResults.error ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-medium">
                  ⚠️ {dryRunResults.error}
                </div>
              ) : dryRunResults.jobs.length === 0 ? (
                <div className="text-center p-8 text-text-secondary text-sm">
                  No jobs returned. Scraper resolved successfully, but no postings were parsed from the endpoint.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 inline-block">
                    ✓ Found {dryRunResults.jobs.length} sample postings successfully!
                  </p>
                  <div className="grid gap-4">
                    {dryRunResults.jobs.map((job, idx) => (
                      <div key={idx} className="border border-border p-4 rounded-xl bg-background hover:border-primary/20 transition-all text-left">
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <h4 className="font-bold text-text-primary text-sm">{job.title}</h4>
                          <span className="text-[10px] font-bold tracking-wide bg-surface border border-border px-2 py-0.5 rounded-full text-text-secondary uppercase">
                            {job.source}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary flex flex-wrap gap-4 mb-3">
                          <div>📍 <span className="font-semibold text-text-primary">{job.location}</span></div>
                          <div>📅 Posted: <span className="font-semibold text-text-primary">{new Date(job.posted_at).toLocaleDateString()}</span></div>
                          <div>🔗 <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">View Posting</a></div>
                        </div>
                        <div className="text-xs text-text-secondary bg-surface p-3 rounded-lg border border-border max-h-24 overflow-y-auto font-sans leading-relaxed whitespace-pre-line text-left">
                          {job.description || "No description text extracted."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-background/55 flex justify-end">
              <button 
                onClick={() => setDryRunResults(null)}
                className="btn btn-primary px-5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
