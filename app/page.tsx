import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { AnimatedStats, TypewriterText } from "@/components/home/AnimatedStats";
import { LoginButton } from "@/components/auth/LoginButton";
import { LocalForumFeed } from "@/components/home/LocalForumFeed";
import { HomeWidgets } from "@/components/home/HomeWidgets";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    // Fetch profile to check completion
    const user = await getCurrentUser();
    const profileIncomplete = user && (!user.company || !user.job_title || (!user.home_lat && !user.office_lat));

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
                Add your company, job title, and location information. Unless location information is provided, you won't appear on the proximity map network!
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

        <HomeWidgets />

        <LocalForumFeed />
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
            <LoginButton className="btn btn-linkedin btn-lg shadow-xl shadow-black/20" />
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
      <section className="px-4 py-24 text-center bg-[var(--color-surface)] flex flex-col items-center">
        <h2 className="text-h2 mb-8">Ready to discover who's next door?</h2>
        <LoginButton className="btn btn-linkedin btn-lg" />
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
