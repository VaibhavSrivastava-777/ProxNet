"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserTable } from "@/components/admin/UserTable";
import { AdminLogout } from "@/components/admin/AdminLogout";
import { SupabaseSetupBanner } from "@/components/admin/SupabaseSetupBanner";
import { AdminActions } from "@/components/admin/AdminActions";

type TabType = "overview" | "users";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [stats, setStats] = useState<{
    users: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
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
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 animate-fadeIn" style={{ minHeight: "100vh" }}>
      
      {/* Top Banner Banner */}
      <div className="mb-4">
        <SupabaseSetupBanner />
      </div>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-primary-subtle)] shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-h2 font-bold tracking-tight text-[var(--color-text-primary)] m-0 flex items-center gap-2">
              <span>Admin Workspace</span>
              <span className="badge badge-accent text-xs px-2.5 py-0.5 rounded-full font-bold">Admin</span>
            </h1>
            <p className="text-body-sm text-[var(--color-text-secondary)] mt-1">Manage users and system actions.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="btn btn-ghost btn-sm hover:bg-[var(--color-surface-hover)]">
            Back to site
          </Link>
          <AdminLogout />
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Navigation Sidebar/Pills */}
        <aside className="w-full lg:w-64 shrink-0 bg-[var(--color-surface)] border border-[var(--color-border-light)] p-3 rounded-2xl shadow-[var(--shadow-sm)] space-y-1">
          <div className="hidden lg:block px-3 py-2 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
            Navigation
          </div>
          
          {/* Scrollable on Mobile, Stacked on Desktop */}
          <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible no-scrollbar -mx-3 px-3 lg:mx-0 lg:px-0 gap-1.5 pb-2 lg:pb-0">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "overview"
                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "users"
                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A9.642 9.642 0 0018 20c1.371 0 2.684-.28 3.879-.783M15 8.25a3 3 0 11-6 0 3 3 0 016 0zM8.625 15.429a3.375 3.375 0 00-3.375 3.375 9.75 9.75 0 00.912 4.113M11.378 14.885a11.53 11.53 0 014.244 0M11.378 14.885a3.375 3.375 0 00-3.375 3.375M11.378 14.885V18a3.375 3.375 0 003.375 3.375H18" />
              </svg>
              <span>User Management</span>
            </button>
          </nav>
        </aside>

        {/* Dynamic content area */}
        <main className="flex-1 w-full space-y-6">
          
          {/* Tab 1: Overview Dashboard */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Quick stats panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] p-5 rounded-2xl shadow-[var(--shadow-sm)] text-left">
                  <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Total Users</div>
                  <div className="text-3xl font-extrabold text-[var(--color-text-primary)] mt-2">
                    {loadingStats ? (
                      <span className="inline-block h-6 w-12 bg-[var(--color-surface-secondary)] animate-pulse rounded"></span>
                    ) : (
                      stats?.users
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Actions Module */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="p-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface-hover)] text-left">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">⚡ System Broadcast</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Preview and run background notifications and profile completion prompts.</p>
                </div>
                <div className="p-6">
                  <AdminActions />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Users Panel */}
          {activeTab === "users" && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] p-6 rounded-2xl shadow-[var(--shadow-sm)] animate-fadeIn text-left">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">User Database</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mb-6">Create new accounts, edit profiles, or block users.</p>
              <UserTable />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
