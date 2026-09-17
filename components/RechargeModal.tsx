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

  const currentBalance = typeof walletBalance === "number" ? walletBalance : 0;
  const isZero = currentBalance <= 0;

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
          <h3 className="text-xl font-bold m-0">
            {isZero ? "Recharge Credits Required" : "ProxNet Wallet & Recharge"}
          </h3>
          <p className="text-xs text-white/80 mt-1 mb-0">
            {isZero ? "Your wallet balance has reached 0 credits" : `Current Balance: ${currentBalance} Credits`}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4 text-[var(--color-text)]">
          {/* Balance Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)]">
            <div>
              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Current Balance
              </div>
              <div className="text-2xl font-black text-[var(--color-primary)] mt-0.5">
                {currentBalance} <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">credits</span>
              </div>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                currentBalance <= 0
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                  : currentBalance < 10
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
              }`}
            >
              {currentBalance <= 0 ? "Empty" : currentBalance < 10 ? "Low Balance" : "Active"}
            </div>
          </div>

          {/* Earn More Credits Banner */}
          <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] p-3.5 rounded-xl text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <div className="font-bold text-[var(--color-text)] mb-1 flex items-center gap-1.5">
              <span>🎁</span>
              <span>Earn Free Community Credits:</span>
            </div>
            <ul className="m-0 pl-4 space-y-1 text-[11px] text-[var(--color-text-secondary)]">
              <li><strong className="text-[var(--color-primary)]">+5 credits</strong> for enabling push notifications</li>
              <li><strong className="text-[var(--color-primary)]">+5 credits</strong> for posting/sharing a job opportunity</li>
              <li><strong className="text-[var(--color-primary)]">+5 credits</strong> for responding to a referral ask</li>
              <li><strong className="text-[var(--color-primary)]">+3 credits</strong> for answering a neighbor&apos;s career question</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Top-Up Contact Email
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
              href={`mailto:${email}?subject=Request%20to%20Recharge%20ProxNet%20AI%20Credits%20(Current%20Balance:%20${currentBalance})`}
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
