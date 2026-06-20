"use client";

import { useEffect, useState } from "react";

interface AtsConfig {
  id: string;
  company_name: string;
  provider: string;
  board_token_or_url: string;
  created_at: string;
}

export function AdminAtsConfig() {
  const [configs, setConfigs] = useState<AtsConfig[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [provider, setProvider] = useState("greenhouse");
  const [boardToken, setBoardToken] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (loading) return <div className="p-4">Loading ATS config...</div>;

  return (
    <div className="card mt-8 animate-fadeInUp delay-200 border border-primary/20 bg-surface">
      <div className="p-6">
        <h2 className="text-h2 mb-2">Company ATS Mapping</h2>
        <p className="text-body text-text-secondary mb-6">
          Map your ProxNet companies to their exact Greenhouse or Lever board tokens. This bypasses the Apify firehose and lets our scraper pull jobs directly from their ATS for free!
        </p>

        {availableCompanies.length === 0 && configs.length > 0 ? (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
            All ProxNet companies have been mapped! 
          </div>
        ) : (
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 mb-8 bg-background p-4 rounded-lg border border-border">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 block">ProxNet Company Name</label>
              <select
                className="input w-full"
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
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 block">ATS Provider</label>
            <select className="input w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 block">Board Token</label>
            <input
              type="text"
              placeholder="e.g. netflix (from api.lever.co/v0/postings/netflix)"
              className="input w-full"
              value={boardToken}
              onChange={(e) => setBoardToken(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full md:w-auto h-[42px]" disabled={saving}>
              {saving ? "Adding..." : "Add Mapping"}
            </button>
          </div>
        </form>
        )}

        {configs.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-border rounded-lg text-text-secondary">
            No ATS configurations added yet. Add one above!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Provider</th>
                  <th>Board Token</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((conf) => (
                  <tr key={conf.id}>
                    <td className="font-medium">{conf.company_name}</td>
                    <td>
                      <span className={`badge ${conf.provider === 'greenhouse' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {conf.provider}
                      </span>
                    </td>
                    <td className="font-mono text-sm">{conf.board_token_or_url}</td>
                    <td className="text-sm text-text-tertiary">
                      {new Date(conf.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleDelete(conf.id)} className="text-error hover:underline text-sm font-medium">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
