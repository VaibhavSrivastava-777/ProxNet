"use client";

import { useState } from "react";

export function AdminActions() {
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);

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
              if (res.ok) alert(`Scraping complete! Added ${data.totalAdded} new jobs.`);
              else alert(`Error: ${data.error}`);
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
