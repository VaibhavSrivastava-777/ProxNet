import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { AnimatedStats, TypewriterText } from "@/components/home/AnimatedStats";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    // Fetch profile to check completion
    const user = await getCurrentUser();
    const profileIncomplete = user && (!user.company || !user.job_title);

    return (
      <div className="mx-auto max-w-4xl px-4 py-8 animate-fadeInUp">
        <h1 className="text-h1 mb-6">Welcome back, {session.user?.name?.split(" ")[0]}</h1>

        <AnimatedStats />

        {/* Profile completion nudge */}
        {profileIncomplete && (
          <div
            className="flex items-start gap-3 rounded-xl border mb-6 p-4 animate-fadeInUp"
            style={{
              borderColor: "var(--color-warning)",
              backgroundColor: "var(--color-warning-bg)",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              style={{ width: "20px", height: "20px", flexShrink: 0, color: "var(--color-warning)", marginTop: "1px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Complete your profile
              </p>
              <p className="text-caption mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                Add your company and job title so you appear in proximity searches and Q&amp;A filters.
              </p>
            </div>
            <Link
              href="/profile"
              className="btn btn-sm shrink-0"
              style={{
                backgroundColor: "var(--color-warning)",
                color: "#fff",
                border: "none",
              }}
            >
              Complete →
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3 stagger-children">
          <Link href="/proximity" className="card p-6 flex flex-col gap-3 hover:bg-[var(--color-surface-hover)] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            </div>
            <h2 className="text-h3">Proximity Map</h2>
            <p className="text-body-sm text-[var(--color-text-secondary)]">Discover professionals from top companies in your area.</p>
          </Link>

          <Link href="/qa" className="card p-6 flex flex-col gap-3 hover:bg-[var(--color-surface-hover)] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
            </div>
            <h2 className="text-h3">Anonymous Q&amp;A</h2>
            <p className="text-body-sm text-[var(--color-text-secondary)]">Ask questions and get answers from nearby professionals.</p>
          </Link>

          <Link href="/profile" className="card p-6 flex flex-col gap-3 hover:bg-[var(--color-surface-hover)] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
            </div>
            <h2 className="text-h3">Your Profile</h2>
            <p className="text-body-sm text-[var(--color-text-secondary)]">Manage your location and privacy settings.</p>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[#004182] px-4 py-24 text-center text-white sm:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjE1Ii8+PC9zdmc+')] bg-[length:24px_24px] opacity-20" />
        <div className="relative mx-auto max-w-4xl animate-fadeInUp">
          <h1 className="text-display mb-6 text-white leading-tight">Who Else Is In Your Vicinity?</h1>
          <div className="text-body-lg mx-auto mb-10 max-w-2xl text-white/90" style={{ minHeight: "84px" }}>
            <TypewriterText 
              speedMs={65} 
              text="Discover professionals from top companies living in your apartment complex. Ask questions, network anonymously, and unlock opportunities — all without revealing your identity." 
            />
          </div>
          <div className="flex flex-col items-center justify-center gap-4">
            <Link href="/login" className="btn btn-linkedin btn-lg shadow-xl shadow-black/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 mr-1">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Sign in with LinkedIn
            </Link>
            <p className="text-caption text-white/70 font-medium tracking-wide">🔒 100% ANONYMOUS • LINKEDIN VERIFIED • FREE TO USE</p>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="px-4 py-20 bg-[var(--color-bg)]">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-h2 text-center mb-12">How ProxNet Works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { num: 1, title: "Sign In Securely", desc: "Connect your LinkedIn profile to verify your professional identity. Your personal details are never shared." },
              { num: 2, title: "Discover Nearby Pros", desc: "See anonymized clusters of professionals from companies like Google, Microsoft, and more — right in your building." },
              { num: 3, title: "Connect Anonymously", desc: "Ask questions, get answers, and chat — all through anonymous aliases. Reveal yourself only when you choose to." },
            ].map(({ num, title, desc }) => (
              <div key={num} className="card p-8 flex flex-col items-center text-center hover:translate-y-[-4px] transition-transform">
                <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-bold text-xl mb-6 shadow-lg shadow-[var(--color-accent)]/30">{num}</div>
                <h3 className="text-h3 mb-3">{title}</h3>
                <p className="text-body text-[var(--color-text-secondary)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-4 py-16 bg-[var(--color-accent-subtle)] text-center">
        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
          {[["500+", "Professionals"], ["50+", "Companies"], ["100%", "Anonymous"]].map(([val, label]) => (
            <div key={label}>
              <div className="text-display font-bold text-[var(--color-accent)]">{val}</div>
              <div className="text-body-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mt-2">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-24 text-center bg-[var(--color-surface)]">
        <h2 className="text-h2 mb-8">Ready to discover who's next door?</h2>
        <Link href="/login" className="btn btn-linkedin btn-lg">Sign in with LinkedIn</Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-light)] bg-[var(--color-surface)] px-4 py-8 text-center text-[var(--color-text-tertiary)]">
        <div className="text-body-sm" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
          <span>&copy; {new Date().getFullYear()}</span>
          <span style={{ fontWeight: "bold", display: "inline-flex", alignItems: "center" }}>
            <span style={{
              background: "linear-gradient(135deg, var(--color-primary) 30%, #0077ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 800,
            }}>Prox</span>
            <span style={{
              background: "linear-gradient(135deg, var(--color-accent) 30%, #a855f7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 500,
            }}>Net</span>
            <sup style={{
              fontSize: "0.55em",
              fontWeight: "bold",
              color: "var(--color-text-secondary)",
              marginLeft: "1px",
              verticalAlign: "super"
            }}>®</sup>
          </span>
          <span>. Built for professionals.</span>
        </div>
      </footer>
    </div>
  );
}
