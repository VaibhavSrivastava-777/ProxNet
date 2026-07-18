import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { AnimatedStats, TypewriterText } from "@/components/home/AnimatedStats";
import { LoginButton } from "@/components/auth/LoginButton";
import { HomeWidgets } from "@/components/home/HomeWidgets";
import { isOnboardingIncomplete } from "@/lib/profile-validation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const isInvite = params.ref === "invite";
  const session = await auth();

  if (session) {
    // Fetch profile to check completion
    const user = await getCurrentUser();
    const onboardingIncomplete = isOnboardingIncomplete(user);

    if (onboardingIncomplete) {
      redirect("/profile?onboarding=true");
    }

    redirect("/qa?tab=proximity");
  }

  return (
    <div className="min-h-screen">
      {isInvite && (
        <div 
          style={{
            background: "var(--color-accent-subtle)",
            color: "var(--color-accent)",
            padding: "12px 16px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: 14,
            borderBottom: "1px solid var(--color-accent)",
          }}
          className="animate-fadeIn"
        >
          👋 A professional neighbor invited you to ProxNet! Sign in below to unlock your neighborhood.
        </div>
      )}
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
            {/* App Store & Play Store Badges */}
            <div className="flex flex-col items-center gap-3 mb-4">
              <p className="text-caption text-white/50 uppercase tracking-widest font-medium">Available on</p>
              <div className="flex items-center gap-3 animate-fadeIn">
                <a href="/install/ios" className="store-badge-link" aria-label="Download on the App Store">
                  <img src="/icons/badge-app-store.svg" alt="Download on the App Store" className="h-11 w-auto hover:opacity-80 transition-opacity" />
                </a>
                <a href="/install/android" className="store-badge-link" aria-label="Get it on Google Play">
                  <img src="/icons/badge-google-play.svg" alt="Get it on Google Play" className="h-11 w-auto hover:opacity-80 transition-opacity" />
                </a>
              </div>
            </div>

            <LoginButton className="btn btn-linkedin btn-lg shadow-xl shadow-black/20" />
            <p className="text-caption text-white/70 font-medium tracking-wide">🔒 100% ANONYMOUS • LINKEDIN VERIFIED • FREE TO USE</p>
          </div>
        </div>
      </section>

      {/* Network Hub Features */}
      <section className="px-4 py-20 bg-[var(--color-bg)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-h2 text-center mb-12">Explore the Network Hub</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 stagger-children">
            <Link href="/proximity" className="card p-6 flex flex-col gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-primary)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
              </div>
              <h2 className="text-h3 font-semibold m-0">Proximity Map</h2>
              <p className="text-body-sm text-[var(--color-text-secondary)] m-0">Discover professionals from top companies in your area.</p>
            </Link>

            <Link href="/qa" className="card p-6 flex flex-col gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-accent)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
              </div>
              <h2 className="text-h3 font-semibold m-0">Anonymous Chats</h2>
              <p className="text-body-sm text-[var(--color-text-secondary)] m-0">Ask questions and chat with nearby professionals.</p>
            </Link>

            <Link href="/carpool" className="card p-6 flex flex-col gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-success)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] flex items-center justify-center shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
              </div>
              <h2 className="text-h3 font-semibold m-0">CarPool</h2>
              <p className="text-body-sm text-[var(--color-text-secondary)] m-0">Find rides or offer seats to nearby colleagues.</p>
            </Link>

            <Link href="/jobs" className="card p-6 flex flex-col gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-warning)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" /></svg>
              </div>
              <h2 className="text-h3 font-semibold m-0">Jobs</h2>
              <p className="text-body-sm text-[var(--color-text-secondary)] m-0">Discover referrals and roles in your area.</p>
            </Link>
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
        
        {/* Store Badges */}
        <div className="flex items-center gap-3 mb-8 opacity-70">
          <a href="/install/ios" aria-label="App Store">
            <img src="/icons/badge-app-store.svg" alt="App Store" className="h-10 w-auto hover:opacity-80 transition-opacity" />
          </a>
          <a href="/install/android" aria-label="Google Play">
            <img src="/icons/badge-google-play.svg" alt="Google Play" className="h-10 w-auto hover:opacity-80 transition-opacity" />
          </a>
        </div>

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
