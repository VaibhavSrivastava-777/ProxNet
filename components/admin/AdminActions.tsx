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
      const data = await res.json();
      if (res.ok) {
        alert(`Reminders sent successfully to ${data.sent} users.`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to send reminders");
    }
    setLoadingReminders(false);
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
          {loadingScrape ? "Scraping..." : "Scrape ATS Jobs"}
        </button>
      </div>
    </div>
  );
}
