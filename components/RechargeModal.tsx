"use client";

import { useState } from "react";

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance?: number | null;
}

export function RechargeModal({ isOpen, onClose, walletBalance }: RechargeModalProps) {
  const [copied, setCopied] = useState(false);
  const email = "ProxNet.Connect@Gmail.com";

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--color-surface)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden animate-scaleIn">
        {/* Header Banner */}
        <div className="p-6 bg-gradient-to-r from-[var(--color-primary)] via-blue-600 to-[var(--color-accent)] text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 border-none cursor-pointer transition-colors"
            title="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
            ⚡
          </div>
          <h3 className="text-xl font-bold m-0">Recharge Credits Required</h3>
          <p className="text-xs text-white/80 mt-1 mb-0">Your wallet balance has reached 0 credits</p>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4 text-[var(--color-text)]">
          <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] p-3.5 rounded-xl text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <p className="m-0">
              You have completed your profile and used your initial <strong className="text-[var(--color-text)]">100 free credits</strong> for ProxNet AI prompts.
            </p>
            <p className="m-0 mt-2">
              To top up your wallet credits and continue interacting with <strong className="text-[var(--color-primary)]">ProxNet AI</strong>, please reach out to our team via email.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Recharge Contact Email
            </label>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] font-mono text-xs text-[var(--color-primary)] font-bold">
              <span>{email}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-[var(--color-text)] rounded-lg text-[11px] font-sans font-semibold transition-all cursor-pointer shadow-xs shrink-0"
              >
                {copied ? "✓ Copied!" : "Copy Email"}
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <a
              href={`mailto:${email}?subject=Request%20to%20Recharge%20ProxNet%20AI%20Credits`}
              className="btn btn-primary flex-1 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 rounded-xl no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Send Email
            </a>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary py-2.5 px-4 text-xs font-semibold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
