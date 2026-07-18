"use client";

import useSWR from "swr";
import { useState } from "react";
import { InviteShareSheet } from "./InviteShareSheet";
import { ContactImporter } from "./ContactImporter";
import type { Badge, Tier } from "@/lib/network-score";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface InviteData {
  inviteCode: string;
  points: number;
  tier: Tier;
  nextTier: Tier | null;
  progressPercent: number;
  pointsToNext: number;
  totalSignups: number;
  activeInvitees: number;
  localityCount: number;
  recentPoints: Array<{
    id: string;
    points: number;
    reason: string;
    created_at: string;
  }>;
  badges: Badge[];
  hasStreak: boolean;
}

const REASON_LABELS: Record<string, string> = {
  INVITE_SIGNUP: "A neighbor joined through your invite",
  INVITEE_FIRST_POST: "Your invitee asked their first question",
  INVITEE_FIRST_REFERRAL: "Your invitee offered a job referral",
  SECOND_DEGREE_SIGNUP: "Your network tree grew (2nd degree)",
  WEEKLY_STREAK: "Weekly share streak bonus",
  LOCALITY_MILESTONE: "Your area hit a new milestone",
};

export function GrowClient() {
  const { data, isLoading, mutate } = useSWR<InviteData>("/api/invite", fetcher);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [importMode, setImportMode] = useState<"phone" | "google" | undefined>(undefined);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8 animate-fadeIn" style={{ paddingBottom: "6rem" }}>
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)", marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: "var(--radius-lg)", marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  const estimatedTotal = Math.max(50, data.localityCount + 38);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8 animate-fadeIn" style={{ paddingBottom: "6rem" }}>
      {/* ── Section 1: Locality Progress Hero ── */}
      <div
        className="card"
        style={{
          padding: "28px 24px",
          marginBottom: 20,
          background: "linear-gradient(135deg, var(--color-primary), #004182)",
          color: "white",
          borderRadius: "var(--radius-lg)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle dot pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjEiLz48L3N2Zz4=")`,
            backgroundSize: "20px 20px",
            opacity: 0.3,
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 24 }}>🏘️</span>
            <h2 className="text-h2 m-0" style={{ color: "white" }}>Your Local Network</h2>
          </div>

          {/* Progress bar */}
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: 12,
              height: 28,
              marginBottom: 12,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "linear-gradient(90deg, #34d399, #10b981)",
                borderRadius: 12,
                height: "100%",
                width: `${Math.min(100, Math.round(((data.localityCount + 1) / estimatedTotal) * 100))}%`,
                transition: "width 1s ease-out",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                {data.localityCount + 1}
              </span>
            </div>
          </div>

          <p className="text-body-sm m-0" style={{ color: "rgba(255,255,255,0.85)", marginBottom: 16 }}>
            <strong>{data.localityCount + 1}</strong> of ~{estimatedTotal} professionals mapped in your 2km radius.{" "}
            {estimatedTotal - data.localityCount - 1 > 0 &&
              `${estimatedTotal - data.localityCount - 1} more are likely nearby — help them discover what they're missing.`}
          </p>

          {/* Tier badge */}
          <div
            className="flex items-center gap-3"
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
            }}
          >
            <span style={{ fontSize: 32 }}>{data.tier.badge}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{data.tier.name}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                {data.points} pts
                {data.nextTier
                  ? ` • ${data.pointsToNext} pts to ${data.nextTier.name}`
                  : " • Max Tier!"}
              </div>
              {data.nextTier && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    height: 6,
                    marginTop: 6,
                    width: 140,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "#fbbf24",
                      height: "100%",
                      width: `${data.progressPercent}%`,
                      borderRadius: 6,
                      transition: "width 0.8s ease-out",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Emotional Trigger Cards — "Why THEY Need This" ── */}
      <div style={{ marginBottom: 20 }}>
        <h3 className="text-h3 mb-3" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>💡</span> Someone you know needs this
        </h3>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            {
              emoji: "🚗",
              text: "Your friend drives alone to the same office as a neighbor. They could save ₹3,000/month.",
              channel: "whatsapp" as const,
              cta: "Share via WhatsApp",
            },
            {
              emoji: "💼",
              text: "A startup 200m from your friend is hiring for their exact skillset. They don't know.",
              channel: "linkedin" as const,
              cta: "Share via LinkedIn",
            },
            {
              emoji: "🏠",
              text: "Your cousin just moved to a new apartment. They know no one. ProxNet changes that.",
              channel: "sms" as const,
              cta: "Share via SMS",
            },
            {
              emoji: "🤝",
              text: "There's a community of professionals in their building they've never met. You can fix that.",
              channel: "copy" as const,
              cta: "Copy Link",
            },
          ].map((card) => (
            <div
              key={card.channel}
              className="card"
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                borderRadius: "var(--radius-md)",
                transition: "transform 0.15s, box-shadow 0.15s",
                cursor: "pointer",
              }}
              onClick={() => setShowShareSheet(true)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              <div>
                <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>{card.emoji}</span>
                <p className="text-body-sm m-0" style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  &ldquo;{card.text}&rdquo;
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: "100%", fontSize: 12, padding: "8px 12px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareSheet(true);
                }}
              >
                {card.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Find People You Know ── */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: "var(--radius-lg)" }}>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: 22 }}>📇</span>
          <h3 className="text-h3 m-0">Find People You Know</h3>
        </div>
        <p className="text-body-sm m-0 mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Import your contacts to see who from your circle might benefit from ProxNet.
          We&apos;ll never contact anyone without your explicit permission. 🔒
        </p>

        {!showContacts ? (
          <div className="flex gap-3">
            <button
              className="btn btn-primary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={() => {
                setImportMode("phone");
                setShowContacts(true);
              }}
            >
              <span>📱</span> Phone Contacts
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
              onClick={() => {
                setImportMode("google");
                setShowContacts(true);
              }}
            >
              <span>📧</span> Google Contacts
            </button>
          </div>
        ) : (
          <ContactImporter
            inviteCode={data.inviteCode}
            defaultMode={importMode}
            onClose={() => {
              setShowContacts(false);
              setImportMode(undefined);
            }}
          />
        )}
      </div>

      {/* ── Section 4: Points & Impact Dashboard ── */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: "var(--radius-lg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: 22 }}>🏆</span>
          <h3 className="text-h3 m-0">Your Network Impact</h3>
        </div>

        {/* Stat counters */}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { value: data.totalSignups, label: "People Joined" },
            { value: data.activeInvitees, label: "Active Users" },
            { value: data.points, label: "Pts Earned" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                textAlign: "center",
                padding: "16px 8px",
                background: "var(--color-surface-secondary)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div
                className="text-h1"
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {stat.value}
              </div>
              <div className="text-caption" style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        {data.recentPoints.length > 0 && (
          <div>
            <h4 className="text-body font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Recent Activity
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.recentPoints.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3"
                  style={{
                    padding: "10px 14px",
                    background: "var(--color-surface-secondary)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: "3px solid var(--color-success)",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: "var(--color-success)",
                      fontSize: 14,
                      minWidth: 50,
                    }}
                  >
                    +{entry.points}
                  </span>
                  <div>
                    <div className="text-body-sm" style={{ fontWeight: 500 }}>
                      {REASON_LABELS[entry.reason] || entry.reason}
                    </div>
                    <div className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
                      {formatTimeAgo(entry.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.recentPoints.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "24px 16px",
              background: "var(--color-surface-secondary)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>🌱</span>
            <p className="text-body-sm m-0">
              No activity yet. Share your invite link to start growing your network!
            </p>
          </div>
        )}
      </div>

      {/* ── Section 5: Achievement Badges ── */}
      <div className="card" style={{ padding: 20, borderRadius: "var(--radius-lg)" }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: 22 }}>🎖️</span>
          <h3 className="text-h3 m-0">Achievements</h3>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { id: "first_neighbor", icon: "🏠", name: "First Neighbor", desc: "First invite signup" },
            { id: "streak_master", icon: "🔥", name: "Streak Master", desc: "3+ shares in one week" },
            { id: "tree_planter", icon: "🌳", name: "Tree Planter", desc: "5+ active invitees" },
            { id: "matchmaker", icon: "🎯", name: "Matchmaker", desc: "Invitee got a match" },
            { id: "building_pioneer", icon: "🏗️", name: "Pioneer", desc: "First in your complex" },
            { id: "network_effect", icon: "🌐", name: "Network Effect", desc: "2nd degree growth" },
          ].map((badge) => {
            const isEarned = data.badges.some((b) => b.id === badge.id);
            return (
              <div
                key={badge.id}
                style={{
                  textAlign: "center",
                  padding: "16px 8px",
                  background: isEarned
                    ? "var(--color-accent-subtle)"
                    : "var(--color-surface-secondary)",
                  borderRadius: "var(--radius-md)",
                  opacity: isEarned ? 1 : 0.45,
                  transition: "all 0.3s ease",
                  border: isEarned
                    ? "1px solid var(--color-accent)"
                    : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: 28, display: "block", marginBottom: 4 }}>{badge.icon}</span>
                <div className="text-caption font-semibold" style={{ lineHeight: 1.3 }}>
                  {badge.name}
                </div>
                <div
                  className="text-caption"
                  style={{ color: "var(--color-text-secondary)", fontSize: 10, marginTop: 2 }}
                >
                  {badge.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Share Button */}
      <button
        onClick={() => setShowShareSheet(true)}
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 40,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--color-primary), #004182)",
          color: "white",
          border: "none",
          boxShadow: "0 4px 16px rgba(0,101,191,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(0,101,191,0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,101,191,0.4)";
        }}
        title="Share Invite Link"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {/* Share Sheet Modal */}
      {showShareSheet && (
        <InviteShareSheet
          inviteCode={data.inviteCode}
          onClose={() => {
            setShowShareSheet(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}
