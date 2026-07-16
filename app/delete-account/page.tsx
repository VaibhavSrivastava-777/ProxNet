import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Request Data Deletion — ProxNet",
  description: "Request the complete removal of your ProxNet profile, locations, and chat information.",
};

export default function DeleteAccountPage() {
  const emailRecipient = "ProxNet.connect@gmail.com";
  const emailSubject = encodeURIComponent("ProxNet User Data Deletion Request");
  const emailBody = encodeURIComponent(
    "Hi ProxNet Team,\n\n" +
    "I am writing to request the complete deletion of my user account and all associated personal information from ProxNet.\n\n" +
    "My registered account details are:\n" +
    "- Full Name: [Input your full name]\n" +
    "- Email Address: [Input your email address]\n" +
    "- LinkedIn Profile URL (if linked): [Input link]\n\n" +
    "Please confirm once the account deletion and data purge are completed.\n\n" +
    "Thank you."
  );

  const mailtoString = `mailto:${emailRecipient}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12 animate-fadeIn">
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
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-6 md:p-8 shadow-card flex flex-col gap-6">
        
        {/* Header */}
        <div className="text-center border-b border-[var(--color-border-light)] pb-6">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🗑️
          </div>
          <h1 className="text-h2 m-0 text-[var(--color-text)]">Request Data Deletion</h1>
          <p className="text-body-sm text-[var(--color-text-secondary)] mt-2 m-0">
            We value your privacy. You can request complete deletion of your account and personal data at any time.
          </p>
        </div>

        {/* What gets deleted */}
        <div className="flex flex-col gap-4">
          <h2 className="text-body font-semibold text-[var(--color-text)] m-0">What happens when your account is deleted?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] rounded-xl flex gap-3 items-start">
              <span className="text-lg">👤</span>
              <div>
                <h3 className="text-body-sm font-semibold m-0 text-[var(--color-text)]">Profile details</h3>
                <p className="text-caption text-[var(--color-text-secondary)] m-0 mt-1">Your name, company, title, profile picture, and linked social handles are permanently purged.</p>
              </div>
            </div>
            
            <div className="p-4 bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] rounded-xl flex gap-3 items-start">
              <span className="text-lg">📍</span>
              <div>
                <h3 className="text-body-sm font-semibold m-0 text-[var(--color-text)]">Location history</h3>
                <p className="text-caption text-[var(--color-text-secondary)] m-0 mt-1">All home, office, and active geographical coordinates are deleted from our database tables.</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] rounded-xl flex gap-3 items-start">
              <span className="text-lg">💬</span>
              <div>
                <h3 className="text-body-sm font-semibold m-0 text-[var(--color-text)]">Chats & QA Posts</h3>
                <p className="text-caption text-[var(--color-text-secondary)] m-0 mt-1">Your direct messages, question targets, and question boards are completely scrubbed.</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] rounded-xl flex gap-3 items-start">
              <span className="text-lg">🔔</span>
              <div>
                <h3 className="text-body-sm font-semibold m-0 text-[var(--color-text)]">Notification registers</h3>
                <p className="text-caption text-[var(--color-text-secondary)] m-0 mt-1">Device FCM tokens and push subscriptions are immediately terminated.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notice & Button */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-[var(--color-text)] rounded-xl text-body-sm flex gap-3 items-start">
            <span className="text-base shrink-0">⚠️</span>
            <p className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
              Account deletion is <strong>permanent</strong>. Once your data is deleted, it cannot be restored or retrieved by our support team.
            </p>
          </div>

          <a 
            href={mailtoString}
            className="btn btn-primary btn-lg w-full flex items-center justify-center gap-2 mt-2 bg-red-600 hover:bg-red-700 border-none text-white font-bold"
            style={{ backgroundColor: "#DC2626" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>Email Deletion Request</span>
          </a>
          
          <p className="text-caption text-center text-[var(--color-text-tertiary)] m-0 mt-1">
            Alternatively, send an email directly to <strong className="text-[var(--color-text-secondary)]">ProxNet.connect@gmail.com</strong> with the subject "Data Deletion".
          </p>
        </div>

      </div>
    </div>
  );
}
