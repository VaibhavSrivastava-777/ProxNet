import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "User Safety Standards & CSAE Policy — ProxNet",
  description: "Read ProxNet's zero-tolerance policy against CSAE/CSAM and reporting/moderation practices.",
};

export default function SafetyStandardsPage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fadeIn">
      {/* Back Button */}
      <div className="mb-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-body-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-6 md:p-10 shadow-card flex flex-col gap-6">
        <div className="border-b border-[var(--color-border-light)] pb-6">
          <span className="bg-red-500/10 text-red-500 text-caption font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Zero-Tolerance Policy
          </span>
          <h1 className="text-h1 m-0 mt-3 flex items-center gap-3">
            <span className="text-[var(--color-accent)]">🛡️</span> User Safety & CSAE Policy
          </h1>
          <p className="text-caption text-[var(--color-text-secondary)] mt-2 m-0">
            Last Updated: July 15, 2026
          </p>
        </div>

        <div className="flex flex-col gap-6 text-body text-[var(--color-text)] leading-relaxed">
          <p className="m-0 font-medium">
            ProxNet is committed to maintaining a safe, professional, and secure environment for proximity-based networking. We enforce a zero-tolerance policy against any form of harmful, abusive, or illegal content on our platform.
          </p>

          {/* Zero Tolerance Box */}
          <div className="p-5 bg-red-500/5 border border-red-500/15 rounded-xl flex gap-4 items-start">
            <span className="text-2xl shrink-0">🚫</span>
            <div>
              <h2 className="text-body font-bold text-red-600 m-0">Zero-Tolerance for CSAE & CSAM</h2>
              <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
                Child Sexual Exploitation and Abuse (CSAE) and Child Abuse Material (CSAM) are strictly prohibited on ProxNet. Any attempt to upload, request, share, or link to such content will result in immediate account termination, a permanent IP ban, and immediate reporting to the National Center for Missing & Exploited Children (NCMEC) and appropriate local law enforcement.
              </p>
            </div>
          </div>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">1. Proactive Content Moderation</h2>
            <p className="m-0 mb-3">
              To protect our users and community, we implement multi-layered content moderation:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 m-0">
              <li>
                <strong>Automated Filtering:</strong> Proactive text and media filtering algorithms inspect postings, questions, and direct messages for keywords and patterns linked to abuse, spam, harassment, or CSAE.
              </li>
              <li>
                <strong>Human Verification:</strong> Dedicated moderation specialists conduct random and targeted manual audits of reported profiles, questions, and chat transcript logs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">2. In-App User Reporting Tools</h2>
            <p className="m-0 mb-3">
              We empower our users with tools to identify and report abusive material instantly:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 m-0">
              <li>
                <strong>Message Level:</strong> Tap the options icon (<strong className="text-[var(--color-text)]">...</strong>) next to any chat bubble in a conversation to report that specific message.
              </li>
              <li>
                <strong>Profile Level:</strong> You can block or report any participant directly from their profile view or from within the active chat workspace.
              </li>
              <li>
                <strong>Email Helpline:</strong> Send screenshots or user details directly to our emergency safety desk at:{" "}
                <a href="mailto:ProxNet.connect@gmail.com" className="text-[var(--color-primary)] font-semibold hover:underline">
                  ProxNet.connect@gmail.com
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">3. Review and Resolution Timelines</h2>
            <p className="m-0">
              All reported safety and abuse flags are immediately queued for human review. Our safety enforcement team evaluates reports **within 24 hours**. While an investigation is ongoing, flagged content is hidden from other users, and reported accounts may be temporarily suspended.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">4. Account Sanctions and Legal Cooperation</h2>
            <p className="m-0">
              Users found to be in violation of our safety policies will face permanent account deletion. In cases involving child exploitation, abuse material, or imminent physical threats, ProxNet cooperates fully with national and international law enforcement agencies to provide database logs, IP markers, and registration details to support prosecution.
            </p>
          </section>

          <section className="border-t border-[var(--color-border-light)] pt-6 mt-4">
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-2">Report an Incident</h2>
            <p className="m-0">
              If you witness any suspicious, exploitative, or abusive behavior on ProxNet, contact us immediately at:{" "}
              <a href="mailto:ProxNet.connect@gmail.com" className="text-[var(--color-primary)] font-semibold hover:underline">
                ProxNet.connect@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
