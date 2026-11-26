"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Company = { key: string; name: string; count: number; logoUrl: string | null };
type Giver = { id: string; name: string; title: string | null; photo: string | null };
type Person = { id: string; full_name: string | null; job_title: string | null; company: string | null } | null;
type Req = {
  id: string;
  seeker_id: string;
  giver_id: string;
  company: string;
  status: "requested" | "declined" | "accepted" | "referral_posted" | "completed";
  thread_id: string | null;
  referral_link: string | null;
  created_at: string;
  seeker: Person;
  giver: Person;
};
type Hub = { balance: number; creditCost: number; asSeeker: Req[]; asGiver: Req[] };
type Tab = "find" | "incoming" | "mine";
type Notice = { kind: "ok" | "err"; text: string };

const STATUS_TEXT: Record<Req["status"], string> = {
  requested: "Waiting for a response",
  declined: "Declined",
  accepted: "Accepted. Chat is open.",
  referral_posted: "Referral posted. Confirm once you have it.",
  completed: "Completed",
};

export function ReferralHub() {
  const [tab, setTab] = useState<Tab>("find");
  const [hub, setHub] = useState<Hub | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Lives here (not in FindReferral) so switching tabs does not reload it.
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const loadHub = useCallback(async () => {
    const res = await fetch("/api/referrals", { cache: "no-store" });
    if (res.ok) setHub(await res.json());
  }, []);

  useEffect(() => {
    loadHub();
    fetch("/api/referrals/companies", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCompanies(j.companies ?? []))
      .catch(() => setCompanies([]));
  }, [loadHub]);

  /** POST to an API route, show any error, and refresh the hub on success. */
  const act = useCallback(
    async (id: string, url: string, body?: unknown, successText?: string) => {
      setBusyId(id);
      setNotice(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNotice({ kind: "err", text: json.error || "Something went wrong. Please try again." });
          return null;
        }
        if (successText) setNotice({ kind: "ok", text: successText });
        await loadHub();
        return json;
      } finally {
        setBusyId(null);
      }
    },
    [loadHub]
  );

  const incoming = (hub?.asGiver ?? []).filter((r) => r.status !== "declined" && r.status !== "completed");
  const pendingIncoming = incoming.filter((r) => r.status === "requested").length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 m-0">Referrals</h1>
          <p className="text-caption m-0">
            Ask a professional at your target company. You pay 1 credit only when they accept.
          </p>
        </div>
        <div className="text-right text-sm font-bold text-[var(--color-primary)]">
          {hub ? `${hub.balance} credits` : ""}
        </div>
      </header>

      <nav className="flex gap-2 border-b border-[var(--color-border-light)] pb-2" aria-label="Referral sections">
        <TabButton active={tab === "find"} onClick={() => setTab("find")}>
          Find a referral
        </TabButton>
        <TabButton active={tab === "incoming"} onClick={() => setTab("incoming")}>
          Requests for me{pendingIncoming > 0 ? ` (${pendingIncoming})` : ""}
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My requests
        </TabButton>
      </nav>

      {notice && (
        <div
          role="status"
          className={`rounded-lg px-4 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      {tab === "find" && (
        <FindReferral
          balance={hub?.balance ?? 0}
          busyId={busyId}
          companies={companies}
          selected={selectedCompany}
          onSelect={setSelectedCompany}
          onRequest={(giverId) =>
            act(giverId, "/api/referrals", { giverId }, "Request sent. You'll be charged 1 credit only if they accept.")
          }
        />
      )}

      {tab === "incoming" && (
        <RequestList
          empty="No requests for you right now."
          requests={incoming}
          role="giver"
          busyId={busyId}
          onAccept={(id) => act(id, `/api/referrals/${id}/accept`, undefined, "Accepted. The seeker has been charged 1 credit.")}
          onDecline={(id) => act(id, `/api/referrals/${id}/decline`, undefined, "Request declined.")}
          onPost={(id, link) => act(id, `/api/referrals/${id}/post`, { link }, "Referral posted in the chat.")}
        />
      )}

      {tab === "mine" && (
        <RequestList
          empty="You have not asked for any referrals yet."
          requests={hub?.asSeeker ?? []}
          role="seeker"
          busyId={busyId}
          onConfirm={(id) => act(id, `/api/referrals/${id}/confirm`, undefined, "Thanks. The professional has been credited.")}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Step 1: company logos. Step 2: professionals at that company. */
function FindReferral({
  balance,
  busyId,
  companies,
  selected,
  onSelect,
  onRequest,
}: {
  balance: number;
  busyId: string | null;
  companies: Company[] | null;
  selected: Company | null;
  onSelect: (company: Company | null) => void;
  onRequest: (giverId: string) => Promise<unknown>;
}) {
  const setSelected = onSelect;
  const [givers, setGivers] = useState<Giver[] | null>(null);

  useEffect(() => {
    if (!selected) return;
    setGivers(null);
    fetch(`/api/referrals/givers?company=${encodeURIComponent(selected.name)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setGivers(j.givers ?? []))
      .catch(() => setGivers([]));
  }, [selected]);

  if (!selected) {
    if (companies === null) return <p className="text-sm text-[var(--color-text-secondary)]">Loading companies…</p>;
    if (companies.length === 0) {
      return <p className="text-sm text-[var(--color-text-secondary)]">No companies yet. Check back soon.</p>;
    }
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 list-none p-0 m-0">
        {companies.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => setSelected(c)}
              className="card flex w-full flex-col items-center gap-2 p-4 text-center cursor-pointer"
            >
              <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
              <span className="text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {c.count} {c.count === 1 ? "professional" : "professionals"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setGivers(null);
        }}
        className="self-start text-sm font-semibold text-[var(--color-primary)] bg-transparent border-none cursor-pointer p-0"
      >
        ← All companies
      </button>

      <div className="flex items-center gap-3">
        <CompanyLogo name={selected.name} logoUrl={selected.logoUrl} />
        <h2 className="text-h3 m-0">{selected.name}</h2>
      </div>

      {givers === null && <p className="text-sm text-[var(--color-text-secondary)]">Loading professionals…</p>}
      {givers !== null && givers.length === 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">No one from {selected.name} has joined yet.</p>
      )}

      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {(givers ?? []).map((g) => {
          const cannotAfford = balance < 1;
          return (
            <li key={g.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={g.name} photo={g.photo} />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{g.name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] truncate">{g.title || "Professional"}</div>
                </div>
              </div>
              <button
                type="button"
                disabled={cannotAfford || busyId === g.id}
                onClick={() => onRequest(g.id)}
                className="btn btn-primary btn-sm shrink-0"
              >
                {busyId === g.id ? "Sending…" : cannotAfford ? "Need 1 credit" : "Request referral"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RequestList({
  requests,
  role,
  empty,
  busyId,
  onAccept,
  onDecline,
  onPost,
  onConfirm,
}: {
  requests: Req[];
  role: "giver" | "seeker";
  empty: string;
  busyId: string | null;
  onAccept?: (id: string) => Promise<unknown>;
  onDecline?: (id: string) => Promise<unknown>;
  onPost?: (id: string, link: string) => Promise<unknown>;
  onConfirm?: (id: string) => Promise<unknown>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (requests.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-3 list-none p-0 m-0">
      {requests.map((r) => {
        const other = role === "giver" ? r.seeker : r.giver;
        const otherName = other?.full_name || "A professional";
        const busy = busyId === r.id;
        return (
          <li key={r.id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {role === "giver" ? `${otherName} wants a referral` : `Referral from ${otherName}`}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {r.company}
                  {other?.job_title ? ` · ${other.job_title}` : ""}
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
                {STATUS_TEXT[r.status]}
              </span>
            </div>

            {role === "giver" && r.status === "requested" && onAccept && onDecline && (
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => onAccept(r.id)} className="btn btn-primary btn-sm">
                  {busy ? "Working…" : "Accept (seeker pays 1 credit)"}
                </button>
                <button type="button" disabled={busy} onClick={() => onDecline(r.id)} className="btn btn-sm">
                  Decline
                </button>
              </div>
            )}

            {role === "giver" && r.status === "accepted" && onPost && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={drafts[r.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  placeholder="Paste the referral link or code"
                  maxLength={500}
                  className="input flex-1"
                />
                <button
                  type="button"
                  disabled={busy || !(drafts[r.id] ?? "").trim()}
                  onClick={() => onPost(r.id, drafts[r.id] ?? "")}
                  className="btn btn-primary btn-sm"
                >
                  {busy ? "Posting…" : "Post referral"}
                </button>
              </div>
            )}

            {role === "seeker" && r.status === "referral_posted" && onConfirm && (
              <button type="button" disabled={busy} onClick={() => onConfirm(r.id)} className="btn btn-primary btn-sm self-start">
                {busy ? "Confirming…" : "I received the referral"}
              </button>
            )}

            {r.thread_id && (
              <div className="flex gap-3 text-sm">
                <Link href={`/jobs/chat/${r.thread_id}`} className="font-semibold text-[var(--color-primary)]">
                  Open chat
                </Link>
                {r.referral_link && role === "seeker" && (
                  <span className="truncate text-[var(--color-text-secondary)]">Link: {r.referral_link}</span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        referrerPolicy="no-referrer"
        className="h-12 w-12 rounded-lg object-contain bg-white"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary-subtle)] text-lg font-bold text-[var(--color-primary)]">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photo}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] font-bold text-[var(--color-primary)]">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
