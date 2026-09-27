"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { UserTable } from "@/components/admin/UserTable";
import { AdminLogout } from "@/components/admin/AdminLogout";
import { SupabaseSetupBanner } from "@/components/admin/SupabaseSetupBanner";
import { OperationsCockpit, type DashboardStatsData } from "@/components/admin/OperationsCockpit";
import { AtsEngineTab } from "@/components/admin/AtsEngineTab";
import { BroadcastCommunicationsTab } from "@/components/admin/BroadcastCommunicationsTab";

type TabType = "overview" | "ats" | "users" | "broadcast";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/admin/dashboard-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch dashboard stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const unmappedCount = stats?.unmappedCompanies?.length || 0;
  const missingEmbeddingsCount = stats?.leadingIndicators?.embeddings?.missingCount || 0;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 animate-fadeIn" style={{ minHeight: "100vh" }}>
      {/* Top Banner */}
      <div className="mb-4">
        <SupabaseSetupBanner />
      </div>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-primary-subtle)] shadow-[var(--shadow-md)]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] m-0 flex items-center gap-2.5">
            <span>Operations Cockpit</span>
            <span className="badge badge-accent text-xs px-2.5 py-0.5 rounded-full font-bold">Admin</span>
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Real-time leading indicators, automated ATS pipelines, and candidate conversion actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/" className="btn btn-ghost btn-sm text-xs hover:bg-[var(--color-surface-hover)]">
            Back to site ↗
          </Link>
          <AdminLogout />
        </div>
      </div>

      {/* Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-[var(--color-surface)] border border-[var(--color-border-light)] p-3 rounded-2xl shadow-[var(--shadow-sm)] space-y-1">
          <div className="hidden lg:block px-3 py-2 text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
            Admin Navigation
          </div>

          <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible no-scrollbar -mx-3 px-3 lg:mx-0 lg:px-0 gap-1.5 pb-2 lg:pb-0">
            {/* 1. Operations Cockpit */}
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "overview"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <span>Cockpit</span>
              </div>
              {missingEmbeddingsCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === "overview" ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600"}`}>
                  {missingEmbeddingsCount} action
                </span>
              )}
            </button>

            {/* 2. ATS & Job Pipeline */}
            <button
              onClick={() => setActiveTab("ats")}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "ats"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                </svg>
                <span>ATS &amp; Jobs</span>
              </div>
              {unmappedCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === "ats" ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600"}`}>
                  {unmappedCount}
                </span>
              )}
            </button>

            {/* 3. User Activation */}
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "users"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A9.642 9.642 0 0018 20c1.371 0 2.684-.28 3.879-.783M15 8.25a3 3 0 11-6 0 3 3 0 016 0zM8.625 15.429a3.375 3.375 0 00-3.375 3.375 9.75 9.75 0 00.912 4.113M11.378 14.885a11.53 11.53 0 014.244 0M11.378 14.885a3.375 3.375 0 00-3.375 3.375M11.378 14.885V18a3.375 3.375 0 003.375 3.375H18" />
                </svg>
                <span>User Database</span>
              </div>
            </button>

            {/* 4. Broadcast & Communications */}
            <button
              onClick={() => setActiveTab("broadcast")}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "broadcast"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.455a28.047 28.047 0 01-2.16-6.138m3.825 1.919l-.025-.01m.025.01c.253-.962.584-1.892.985-2.783.247-.55.06-1.21-.463-1.511l-.657-.38c-.551-.318-1.26-.117-1.527.455a28.047 28.047 0 00-2.16 6.138m0 0H7.5m5.34-9.18c1.393-.12 2.795-.12 4.16 0m0 0a9.043 9.043 0 014.5 2.148 9.043 9.043 0 010 6.304 9.043 9.043 0 01-4.5 2.148m0-10.6a20.02 20.02 0 00-4.16 0" />
                </svg>
                <span>Broadcasts</span>
              </div>
            </button>
          </nav>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 w-full space-y-6">
          {/* Tab 1: Operations Cockpit */}
          {activeTab === "overview" && (
            <OperationsCockpit
              stats={stats}
              loading={loadingStats}
              onRefresh={fetchStats}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* Tab 2: ATS & Job Pipeline */}
          {activeTab === "ats" && (
            <AtsEngineTab
              unmappedCompanies={stats?.unmappedCompanies || []}
              onRefresh={fetchStats}
            />
          )}

          {/* Tab 3: Users Panel */}
          {activeTab === "users" && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] p-5 rounded-2xl shadow-[var(--shadow-sm)] animate-fadeIn text-left">
              <div className="mb-4">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">User Activation Database</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Manage accounts, inspect AI match vectors, review geocoded localities, and upload resumes.
                </p>
              </div>
              <UserTable />
            </div>
          )}

          {/* Tab 4: Broadcast Communications */}
          {activeTab === "broadcast" && (
            <BroadcastCommunicationsTab />
          )}
        </main>
      </div>
    </div>
  );
}
