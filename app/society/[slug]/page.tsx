"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ScrapbookCardModal } from "@/components/profile/ScrapbookCardModal";
import type { SocietyStats } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function SocietyYearbookPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const rawSlug = resolvedParams.slug || "neighborhood";
  const societyName = rawSlug
    .replace(/-/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const [stats, setStats] = useState<SocietyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterHelp, setFilterHelp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/society/stats?slug=${encodeURIComponent(rawSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
      })
      .catch((e) => console.error("Failed to load society stats:", e))
      .finally(() => setLoading(false));
  }, [rawSlug]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : `https://www.proxnet.in/society/${rawSlug}`;

  const handleShareWhatsApp = () => {
    const totalCount = stats?.total_members || 20;
    const topCos = stats?.top_companies?.slice(0, 3).map((c) => c.name).join(", ") || "tech companies";
    const text = `Hey neighbors! 👋 Checked ProxNet and noticed we already have ${totalCount}+ engineers, founders, and product folks living right here in ${societyName} (${topCos}). Check out our society tech yearbook & see who's building next door: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter members
  const members = (stats?.members || []).filter((m) => {
    if (filterHelp && (!m.help_offers || !m.help_offers.includes(filterHelp))) {
      return false;
    }
    if (filterRole === "all") return true;
    const title = (m.job_title || "").toLowerCase();
    if (filterRole === "engineering") return title.includes("engineer") || title.includes("dev") || title.includes("tech");
    if (filterRole === "founders") return title.includes("founder") || title.includes("ceo") || title.includes("cto");
    if (filterRole === "product") return title.includes("product") || title.includes("pm");
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] pb-24">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--color-surface)]/85 border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 no-underline text-[var(--color-text)]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
            PX
          </div>
          <span className="font-bold tracking-tight text-base">ProxNet</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-semibold text-xs border border-[#25D366]/30 cursor-pointer transition-colors"
          >
            <span>📱</span> Share on WhatsApp
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)] text-xs font-medium border border-[var(--color-border)] cursor-pointer transition-colors"
          >
            {copied ? "✓ Copied" : "🔗 Copy Link"}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 pt-8 pb-6 max-w-5xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-900/20 via-blue-900/10 to-amber-900/10 border border-[var(--color-border)] p-6 sm:p-8 relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 mb-3">
              <span>🏢</span> Hyperlocal Community Yearbook
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight m-0 mb-3 text-[var(--color-text)]">
              {stats?.society_name || societyName} Tech Directory
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] m-0 leading-relaxed">
              The humble neighborhood scrapbook. Discover the engineers, founders, and thinkers living next door — what they can help with, what they tinker with after hours, and who is down for a quick 15-min chai.
            </p>

            {/* Quick Share to Society WhatsApp Callout */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="btn btn-primary flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold shadow-md cursor-pointer"
              >
                <span>💬</span> Invite Society WhatsApp Group
              </button>
              <Link
                href="/join"
                className="btn btn-secondary flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-medium border border-[var(--color-border)] no-underline"
              >
                Claim Your Flat / Add Yourself &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Aggregate Vanity Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-primary)]">
              {loading ? "..." : stats?.total_members || 0}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1 font-medium">Registered Neighbors</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-500">
              {loading ? "..." : (stats?.roles_breakdown?.["Engineering"] || 0) + (stats?.roles_breakdown?.["Founders & Executives"] || 0)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1 font-medium">Engineers & Founders</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-500">
              {loading ? "..." : stats?.top_institutes?.length ? stats.top_institutes[0].name : "IIT / BITS"}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1 font-medium">Top Alma Mater</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-500">
              {loading ? "..." : stats?.top_help_offers?.reduce((acc, curr) => acc + curr.count, 0) || "30+"}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1 font-medium">Skills Offered Nearby</div>
          </div>
        </div>

        {/* Top Companies Represented Pill Bar */}
        {stats?.top_companies && stats.top_companies.length > 0 && (
          <div className="mt-4 p-3.5 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-semibold text-[var(--color-text-secondary)] shrink-0 flex items-center gap-1">
              <span>💼</span> Companies in complex:
            </span>
            <div className="flex items-center gap-2">
              {stats.top_companies.map((c) => (
                <span
                  key={c.name}
                  className="px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold shrink-0"
                >
                  {c.name} <span className="text-[10px] text-[var(--color-text-tertiary)] font-normal">({c.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: "all", label: `All Neighbors (${stats?.total_members || 0})` },
              { id: "engineering", label: "Engineering" },
              { id: "founders", label: "Founders" },
              { id: "product", label: "Product" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterRole(tab.id);
                  setFilterHelp(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 border ${
                  filterRole === tab.id && !filterHelp
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filterHelp && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-secondary)]">Filtered by help: <strong>{filterHelp}</strong></span>
              <button
                type="button"
                onClick={() => setFilterHelp(null)}
                className="text-xs text-red-500 hover:underline bg-transparent border-none cursor-pointer"
              >
                Clear ✕
              </button>
            </div>
          )}
        </div>

        {/* Popular Skills & Help Offers chips */}
        {stats?.top_help_offers && stats.top_help_offers.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">Browse by help offer:</span>
            {stats.top_help_offers.map((h) => (
              <button
                key={h.topic}
                type="button"
                onClick={() => setFilterHelp(filterHelp === h.topic ? null : h.topic)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                  filterHelp === h.topic
                    ? "bg-emerald-500 text-white border-emerald-600"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                }`}
              >
                🤝 {h.topic} ({h.count})
              </button>
            ))}
          </div>
        )}

        {/* Member Scrapbook Cards Grid */}
        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-secondary)] flex flex-col items-center gap-3">
            <span className="spinner" /> Loading society directory...
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] mt-6 p-8">
            <h3 className="text-base font-bold mb-1">No neighbors found in this view</h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto mb-4">
              Be the first to add your flat and share with your society WhatsApp group!
            </p>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            >
              <span>📱</span> Share on WhatsApp
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {members.map((person) => {
              const pref = person.quick_chat_preference === "walk" ? "🚶 Walk" : "☕ 15-min Chai";
              return (
                <div
                  key={person.id}
                  onClick={() => setSelectedMember(person)}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)] transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Photo, Name, Badge */}
                    <div className="flex items-start gap-3 mb-3">
                      {person.profile_photo_url ? (
                        <img
                          src={person.profile_photo_url}
                          alt={person.full_name}
                          className="w-12 h-12 rounded-xl object-cover border border-[var(--color-border)] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                          {person.full_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-[var(--color-text)] truncate m-0 group-hover:text-[var(--color-primary)] transition-colors">
                            {person.full_name}
                          </h4>
                          {person.institute_affiliation && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                              🎓 {person.institute_affiliation}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] m-0 truncate mt-0.5">
                          {person.job_title || "Professional"}
                          {person.company ? ` @ ${person.company}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* What I can help with */}
                    {person.help_offers && person.help_offers.length > 0 && (
                      <div className="mb-2.5">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] mb-1">
                          Can Help With
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {person.help_offers.slice(0, 2).map((offer: string) => (
                            <span
                              key={offer}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            >
                              {offer}
                            </span>
                          ))}
                          {person.help_offers.length > 2 && (
                            <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium self-center">
                              +{person.help_offers.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tinkering with */}
                    {person.tinkering_with && person.tinkering_with.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] mb-1">
                          Tinkering With
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {person.tinkering_with.slice(0, 2).map((item: string) => (
                            <span
                              key={item}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      {pref}
                    </span>
                    <span className="text-[var(--color-primary)] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-xs">
                      View Scrapbook &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Scrapbook Modal */}
      {selectedMember && (
        <ScrapbookCardModal
          person={selectedMember}
          onClose={() => setSelectedMember(null)}
          onStartChat={(personId) => {
            window.location.href = `/?chatWith=${personId}`;
          }}
        />
      )}

      {/* Sticky Bottom Join Banner for Viral Conversion */}
      <aside aria-label="Join Community" className="fixed bottom-0 inset-x-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] p-3 sm:p-4 shadow-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text)] truncate m-0">
              Live in or near {societyName}?
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] m-0 truncate">
              Join {stats?.total_members || "30+"} neighbors for carpools, referrals, and 15-min chai catchups.
            </p>
          </div>
          <Link
            href="/join"
            className="btn btn-primary py-2 px-4 rounded-xl text-xs font-bold shrink-0 no-underline shadow-md"
          >
            Join Society Circle &rarr;
          </Link>
        </div>
      </aside>
    </div>
  );
}
