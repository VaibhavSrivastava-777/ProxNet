"use client";

import { useState } from "react";
import { JobForm } from "./JobForm";
import { JobFeed } from "./JobFeed";
import { JobInbox } from "./JobInbox";
import { SuggestedJobs } from "./SuggestedJobs";

export function JobsClient() {
  const [activeTab, setActiveTab] = useState<"feed" | "suggested" | "inbox">("suggested");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="animate-fadeIn">
      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "suggested" ? "active" : ""}`}
            onClick={() => setActiveTab("suggested")}
          >
            Suggested Jobs ✨
          </button>
          <button
            className={`tab ${activeTab === "feed" ? "active" : ""}`}
            onClick={() => setActiveTab("feed")}
          >
            Community Feed
          </button>
          <button
            className={`tab ${activeTab === "inbox" ? "active" : ""}`}
            onClick={() => setActiveTab("inbox")}
          >
            Your Chats
          </button>
        </div>
      </div>

      {activeTab === "suggested" && (
        <SuggestedJobs />
      )}
      
      {activeTab === "feed" && (
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-5">
            <JobForm onPosted={() => setRefreshKey(prev => prev + 1)} />
          </div>
          <div className="md:col-span-7">
            <JobFeed refreshKey={refreshKey} />
          </div>
        </div>
      )}
      
      {activeTab === "inbox" && (
        <JobInbox />
      )}
    </div>
  );
}
