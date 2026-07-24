"use client";

import { useState, useEffect } from "react";
import { JobForm } from "./JobForm";
import { JobFeed } from "./JobFeed";
import { SuggestedJobs } from "./SuggestedJobs";

export function JobsClient() {
  const [activeTab, setActiveTab] = useState<"board" | "suggested">("suggested");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // Listen for edit and request events from feed
  useEffect(() => {
    const handleEdit = (e: any) => {
      setEditData(e.detail);
      setShowComposer(true);
    };
    const handleRequestReferral = (e: any) => {
      const job = e.detail;
      setEditData({
        type: "seeker",
        role: job.role,
        company: job.company,
        skills: job.skills || ""
      });
      setShowComposer(true);
    };
    window.addEventListener("editJobPost", handleEdit);
    window.addEventListener("requestReferral", handleRequestReferral);
    return () => {
      window.removeEventListener("editJobPost", handleEdit);
      window.removeEventListener("requestReferral", handleRequestReferral);
    };
  }, []);


  return (
    <div className="animate-fadeIn">
      {/* Top Bar: Tabs + Inbox Icon */}
      <div className="flex justify-between items-center mb-6">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "board" ? "active" : ""}`}
            onClick={() => setActiveTab("board")}
          >
            Jobs Board 💼
          </button>
          <button
            className={`tab ${activeTab === "suggested" ? "active" : ""}`}
            onClick={() => setActiveTab("suggested")}
          >
            AI Matches ✨
          </button>
        </div>

      </div>

      {/* Composer Overlay */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <JobForm
            initialData={editData}
            onPosted={() => {
              setShowComposer(false);
              setEditData(null);
              setRefreshKey(prev => prev + 1);
            }}
            onCancel={() => {
              setShowComposer(false);
              setEditData(null);
            }}
          />
        </div>
      )}

      {/* Board Tab */}
      {activeTab === "board" && (
        <div className="space-y-6">
          {/* Post CTA */}
          <div className="flex justify-end">
            <button
              onClick={() => { setEditData(null); setShowComposer(true); }}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Post a Job / Referral
            </button>
          </div>
          <JobFeed refreshKey={refreshKey} />
        </div>
      )}

      {/* AI Matches Tab */}
      {activeTab === "suggested" && (
        <SuggestedJobs />
      )}
    </div>
  );
}
