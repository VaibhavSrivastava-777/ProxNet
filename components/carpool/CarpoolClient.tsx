"use client";

import { useState } from "react";
import { User } from "@/lib/types";
import { CarpoolForm } from "./CarpoolForm";
import { CarpoolFeed } from "./CarpoolFeed";
import { CarpoolInbox } from "./CarpoolInbox";

export function CarpoolClient({ user }: { user: User }) {
  const [showForm, setShowForm] = useState<boolean | any>(false);
  const [activeTab, setActiveTab] = useState<"feed" | "inbox">("feed");

  if (showForm) {
    const initialData = typeof showForm === "object" ? showForm : undefined;
    return (
      <div className="space-y-6 animate-fadeInUp">
        <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm -ml-3">
          ← Back to Feed
        </button>
        <CarpoolForm user={user} onPostCreated={() => setShowForm(false)} initialData={initialData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="tabs border-b border-[var(--color-border-light)] mb-6 flex">
        <button
          onClick={() => setActiveTab("feed")}
          className={`tab flex-1 py-3 font-medium transition-colors border-b-2 ${
            activeTab === "feed"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          Matches
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          className={`tab flex-1 py-3 font-medium transition-colors border-b-2 ${
            activeTab === "inbox"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          Your Chats
        </button>
      </div>

      <div className="animate-fadeInUp">
        {activeTab === "feed" ? (
          <CarpoolFeed onRequiresPost={(post) => setShowForm(post || true)} />
        ) : (
          <CarpoolInbox />
        )}
      </div>
    </div>
  );
}
