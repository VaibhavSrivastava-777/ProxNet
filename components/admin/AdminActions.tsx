"use client";

import { useState, useEffect } from "react";

export function AdminActions() {
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [cronStatus, setCronStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/ats");
      const data = await res.json();
      if (data.cronStatus) {
        setCronStatus(data.cronStatus);
      } else {
        setCronStatus(null);
      }
    } catch (e) {
      console.error("Failed to fetch cron status:", e);
    } finally {
      setLoadingStatus(false);
    }
  }

  async function handleRunBroadcast() {
    if (!confirm("Run the broadcast logic now? This will send notifications to active users based on the time of day.")) return;
    
    setLoadingBroadcast(true);
    try {
      const res = await fetch("/api/admin/broadcast", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Broadcast triggered successfully. Sent ${data.notificationsSent} notifications (${data.broadcastType}).`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to run broadcast");
    }
    setLoadingBroadcast(false);
  }

  async function handleSendReminders() {
    if (!confirm("Send profile completion reminders to all users with incomplete profiles?")) return;
    
    setLoadingReminders(true);
    try {
      const res = await fetch("/api/admin/remind-profiles", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Reminders sent successfully to ${data.sent} users via in-app notification.`);
        
        if (data.emails && data.emails.length > 0) {
          const bccList = data.emails.join(",");
          const subject = encodeURIComponent("Complete your ProxNet Profile!");
          const body = encodeURIComponent("Hi there,\n\nYou are missing out on local professional networking opportunities because your ProxNet profile is incomplete. Please add your company, job title, and location information to appear on the proximity map network!\n\nBest,\nThe ProxNet Team");
          const mailtoUrl = `mailto:?bcc=${bccList}&subject=${subject}&body=${body}`;
          window.location.href = mailtoUrl;
        }
      } else {
        alert("Failed to send reminders");
      }
    } catch (err) {
      alert("Failed to send reminders");
    } finally {
      setLoadingReminders(false);
    }
  }

  async function handleScrapeJobs() {
    if (!confirm("Start ATS Job Crawl? This will fetch open jobs from known company ATS boards.")) return;
    
    setLoadingScrape(true);
    try {
      const res = await fetch("/api/admin/scrape-jobs", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Scraping complete! Added ${data.totalAdded} new jobs.`);
        fetchStatus();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to run job scrape");
    }
    setLoadingScrape(false);
  }

  return (
    <div className="card mb-6" style={{ padding: "24px" }}>
      {/* Cron Job Info & Status */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="md:col-span-2 p-5 rounded-xl border border-border bg-background shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Automated Crawl Status (Vercel Cron)</h3>
              {cronStatus && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  cronStatus.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cronStatus.status === 'success' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                  {cronStatus.status === 'success' ? 'Active & Healthy' : 'Failing'}
                </span>
              )}
            </div>
            
            {loadingStatus ? (
              <div className="text-sm text-text-tertiary animate-pulse py-2">Loading status details...</div>
            ) : cronStatus ? (
              <div className="flex flex-col gap-3">
                <div className="text-sm text-text-secondary leading-relaxed bg-surface/50 p-3 rounded-lg border border-border/40 font-mono text-xs max-h-[80px] overflow-y-auto">
                  {cronStatus.message}
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-text-tertiary">
                  <span><strong>Last Run:</strong> {new Date(cronStatus.lastRun).toLocaleString()}</span>
                  <span>•</span>
                  <span><strong>Duration:</strong> {(cronStatus.durationMs / 1000).toFixed(2)}s</span>
                  <span>•</span>
                  <span><strong>Scope:</strong> {cronStatus.onlyProxNet ? "Network Companies Only" : "All Companies"}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary py-2">
                No recent crawl run status recorded in database. Run a crawl below to generate the status record.
              </div>
            )}
          </div>
        </div>

        {/* Info FYI Card */}
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Vercel Cron FYI
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              The cron job is active via <code className="bg-surface px-1 py-0.5 rounded text-primary">vercel.json</code> and scheduled to run:
            </p>
            <div className="bg-surface/80 p-2.5 rounded-lg border border-border/40 mb-3 text-xs font-semibold text-text flex items-center justify-between">
              <span>🕒 Daily at 2:00 AM UTC</span>
              <span className="text-text-tertiary font-normal">(7:30 AM IST)</span>
            </div>
            <p className="text-[11px] text-text-tertiary leading-relaxed">
              Verify activation in your <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Vercel Dashboard</a> under <strong className="text-text-secondary">Project Settings &gt; Cron Jobs</strong>. Secured via `CRON_SECRET`.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-h3 mb-4">Quick Actions</h2>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleRunBroadcast}
          disabled={loadingBroadcast}
          className="btn btn-primary"
        >
          {loadingBroadcast ? "Running..." : "Run Broadcast Now"}
        </button>
        <button
          onClick={handleSendReminders}
          disabled={loadingReminders}
          className="btn btn-secondary"
        >
          {loadingReminders ? "Sending..." : "Send Profile Completion Reminders"}
        </button>
        <button
          onClick={handleScrapeJobs}
          disabled={loadingScrape}
          className="btn btn-secondary"
        >
          {loadingScrape ? "Scraping..." : "Scrape ATS Jobs (All)"}
        </button>
        <button
          onClick={async () => {
            if (!confirm("Start ATS Job Crawl for ProxNet companies ONLY?")) return;
            setLoadingScrape(true);
            try {
              const res = await fetch("/api/admin/scrape-jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ onlyProxNet: true })
              });
              const data = await res.json();
              if (res.ok) {
                alert(`Scraping complete! Added ${data.totalAdded} new jobs.`);
                fetchStatus();
              } else {
                alert(`Error: ${data.error}`);
              }
            } catch (e) {
              alert("Failed to run job scrape");
            }
            setLoadingScrape(false);
          }}
          disabled={loadingScrape}
          className="btn btn-primary bg-primary/20 text-primary border border-primary/50"
        >
          {loadingScrape ? "Scraping..." : "Scrape Jobs (ProxNet Only)"}
        </button>
      </div>
    </div>
  );
}
