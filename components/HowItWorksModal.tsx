"use client";

import { useState } from "react";

interface Props {
  type: "carpool" | "jobs" | "qa";
}

const content = {
  carpool: {
    title: "How Carpooling Works",
    cases: [
      {
        title: "Offer a Ride",
        desc: "Drive to work? Post your route and time. We'll match you with neighbors heading the same way. You maintain full anonymity until you choose to reveal yourself."
      },
      {
        title: "Request a Ride",
        desc: "Need a lift? Post your commute details. We notify drivers nearby. Review matches, message anonymously, and sync up!"
      },
      {
        title: "AI Suggested Matches",
        desc: "We suggest professionals whose home and office are within 1km of yours for effortless recurring carpools."
      }
    ]
  },
  jobs: {
    title: "How Referrals & Jobs Work",
    cases: [
      {
        title: "Seeking a Referral",
        desc: "Looking for a role at a specific company? Post your profile. We'll notify employees of that company who live near you."
      },
      {
        title: "Offering a Referral",
        desc: "Earn referral bonuses by referring top talent from your neighborhood. Post an opening and we'll match you with relevant seekers."
      },
      {
        title: "On Behalf Of",
        desc: "Know someone great who isn't on ProxNet? You can post a job or candidate profile on their behalf with their WhatsApp number."
      }
    ]
  },
  qa: {
    title: "How Chats & Forums Work",
    cases: [
      {
        title: "Targeted Questions",
        desc: "Need advice from a Product Manager at Google? Ask your question and filter by company/role. We route it directly to relevant neighbors."
      },
      {
        title: "Local Forum",
        desc: "Want to discuss neighborhood issues, tech trends, or host an AMA? Post without filters to broadcast to everyone in your radius."
      },
      {
        title: "Stay Anonymous",
        desc: "All questions and forum replies are posted under an anonymous alias (e.g. Neighbor-1A2B) to ensure honest, bias-free interactions."
      }
    ]
  }
};

export function HowItWorksModal({ type }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const data = content[type];

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        How it Works
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="card w-full max-w-md p-6 animate-scaleIn relative">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <h3 className="text-h2 mb-4">{data.title}</h3>
            <div className="flex flex-col gap-4">
              {data.cases.map((c, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <h4 className="font-semibold text-[var(--color-primary)] text-sm">{c.title}</h4>
                  <p className="text-sm text-[var(--color-text-secondary)]">{c.desc}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setIsOpen(false)} className="btn btn-primary w-full mt-6">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
