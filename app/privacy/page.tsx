import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — ProxNet",
  description: "Learn how ProxNet collects, uses, and safeguards your proximity networking data.",
};

export default function PrivacyPolicyPage() {
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
          <h1 className="text-h1 m-0 flex items-center gap-3">
            <span className="text-[var(--color-accent)]">🛡️</span> Privacy Policy
          </h1>
          <p className="text-caption text-[var(--color-text-secondary)] mt-2 m-0">
            Last Updated: July 15, 2026
          </p>
        </div>

        <div className="flex flex-col gap-6 text-body text-[var(--color-text)] leading-relaxed">
          <p className="m-0 font-medium">
            At ProxNet, we believe your professional network should be close to home, and your personal data should remain secure. This Privacy Policy details how we collect, process, and protect your information when using the ProxNet mobile app and web services.
          </p>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">1. Information We Collect</h2>
            <p className="m-0 mb-3">
              To provide a proximity-based networking experience, we collect information you provide directly and data generated automatically:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 m-0">
              <li>
                <strong>Profile Information:</strong> Professional details such as full name, job title, company, profile photo, and LinkedIn URL.
              </li>
              <li>
                <strong>Location Data:</strong> With your permission, we collect precise or approximate proximity coordinates (home, office, or current location) to show other users within a certain radius.
              </li>
              <li>
                <strong>Interaction Data:</strong> Details of the questions you post, responses, and chats initiated within the platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">2. How We Use Your Information</h2>
            <p className="m-0 mb-3">
              We process your data strictly to facilitate local professional matchmaking:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 m-0">
              <li>To calculate distances between professionals and show proximity matches.</li>
              <li>To enable anonymous or real-name direct messaging and local QA boards.</li>
              <li>To send push notifications for new message requests and community responses.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">3. Data Sharing & Privacy Controls</h2>
            <p className="m-0">
              ProxNet does <strong>not</strong> sell, trade, or rent your personal information to third parties. We provide robust controls allowing you to hide your name, company, or profile photo from proximity listings, keeping you anonymous until you explicitly decide to reveal your profile to a match.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">4. Your Data Deletion Rights</h2>
            <p className="m-0">
              You have the right to request the complete deletion of your account and personal information at any time. To exercise this right, please visit our dedicated{" "}
              <Link href="/delete-account" className="text-[var(--color-primary)] font-semibold hover:underline">
                Account Deletion Page
              </Link>{" "}
              to initiate a deletion request.
            </p>
          </section>

          <section className="border-t border-[var(--color-border-light)] pt-6 mt-4">
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-2">Contact Us</h2>
            <p className="m-0">
              If you have any questions regarding this Privacy Policy or our data practices, contact us at:{" "}
              <a href="mailto:ProxNet.connect@gmail.com" className="text-[var(--color-primary)] font-semibold hover:underline">
                ProxNet.connect@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
