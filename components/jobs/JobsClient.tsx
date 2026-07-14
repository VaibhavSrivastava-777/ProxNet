"use client";

import { useState, useEffect } from "react";
import { JobForm } from "./JobForm";
import { JobFeed } from "./JobFeed";
import { JobInbox } from "./JobInbox";
import { SuggestedJobs } from "./SuggestedJobs";

export function JobsClient() {
  const [activeTab, setActiveTab] = useState<"board" | "suggested">("suggested");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [inboxCount, setInboxCount] = useState(0);

  // Listen for edit events from feed
  useEffect(() => {
    const handleEdit = (e: any) => {
      setEditData(e.detail);
      setShowComposer(true);
    };
    window.addEventListener("editJobPost", handleEdit);
    return () => window.removeEventListener("editJobPost", handleEdit);
  }, []);

  // Fetch inbox count for badge
  useEffect(() => {
    fetch("/api/jobs/inbox")
      .then(res => res.json())
      .then(data => setInboxCount((data.threads || []).length))
      .catch(() => {});
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

        {/* Inbox Icon */}
        <button
          onClick={() => setShowInbox(!showInbox)}
          className={`relative btn btn-ghost btn-sm flex items-center gap-1.5 ${showInbox ? "text-primary" : "text-[var(--color-text-secondary)]"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-sm font-medium hidden sm:inline">Chats</span>
          {inboxCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold flex items-center justify-center">
              {inboxCount > 9 ? "9+" : inboxCount}
            </span>
          )}
        </button>
      </div>

      {/* Inbox Slide-Over */}
      {showInbox && (
        <div className="mb-6 animate-fadeInDown">
          <div className="card p-4 border-t-4 border-primary">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-h4 font-bold flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Your Chats
              </h3>
              <button onClick={() => setShowInbox(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <JobInbox />
          </div>
        </div>
      )}

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
