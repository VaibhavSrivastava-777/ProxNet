import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal Disclaimer — ProxNet",
  description: "Read the Legal Disclaimer for utilizing the ProxNet professional proximity network.",
};

export default function DisclaimerPage() {
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
            <span className="text-[var(--color-accent)]">⚖️</span> Legal Disclaimer
          </h1>
          <p className="text-caption text-[var(--color-text-secondary)] mt-2 m-0">
            Last Updated: July 15, 2026
          </p>
        </div>

        <div className="flex flex-col gap-6 text-body text-[var(--color-text)] leading-relaxed">
          <p className="m-0 font-medium">
            Please read this Legal Disclaimer carefully before using the ProxNet application, website, and services. By accessing or using our platform, you acknowledge and agree to the terms below.
          </p>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">1. Information Accuracy & Proximity Data</h2>
            <p className="m-0 mb-3">
              The proximity and professional information listed on ProxNet is provided on an "as is" and "as available" basis. While we strive to calculate geographic distances accurately:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 m-0">
              <li>ProxNet does not warrant or guarantee the precise accuracy of physical distances or user locations.</li>
              <li>Location calculations are reliant on third-party mobile GPS signals, IP addresses, and user-provided coordinates, which may contain errors.</li>
              <li>We do not independently verify the employment backgrounds, credentials, or statements of users registered on the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">2. No Guarantee of Professional Outcomes</h2>
            <p className="m-0">
              ProxNet is an independent networking mapping tool. We are not a recruitment agency, employer, or placement firm. Use of our services, including resume-matching and professional proximity lookups, does not guarantee any interview, employment offer, business partnerships, or career advancement.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">3. User Responsibility & Safety</h2>
            <p className="m-0">
              You are solely responsible for your interactions and networking engagements with other users. ProxNet does not conduct criminal background checks or safety screenings on its users. We strongly advise exercising caution and standard safety practices when meeting contacts in person or sharing sensitive business information.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-3">4. Limitation of Liability</h2>
            <p className="m-0">
              In no event shall ProxNet, its founders, or affiliates be liable for any direct, indirect, incidental, consequential, or punitive damages arising out of your access to, use of, or inability to use the platform, including but not limited to career decisions, lost business opportunities, or interpersonal disputes.
            </p>
          </section>

          <section className="border-t border-[var(--color-border-light)] pt-6 mt-4">
            <h2 className="text-h3 font-bold text-[var(--color-primary)] m-0 mb-2">Questions?</h2>
            <p className="m-0">
              If you have any questions regarding this disclaimer, please reach out to our legal support desk at:{" "}
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
