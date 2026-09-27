"use client";

import React from "react";

export interface LeadingIndicatorCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  badge: {
    label: string;
    variant: "success" | "warning" | "error" | "info";
  };
  rationale: string;
  actionText: string;
  onAction: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  progressPct?: number;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export function LeadingIndicatorCard({
  title,
  value,
  subtitle,
  badge,
  rationale,
  actionText,
  onAction,
  loading = false,
  disabled = false,
  icon,
  progressPct,
  secondaryActionText,
  onSecondaryAction
}: LeadingIndicatorCardProps) {
  const badgeStyles = {
    success: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    error: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
    info: "bg-blue-500/10 text-blue-600 border border-blue-500/20"
  }[badge.variant];

  const progressBg = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-rose-500",
    info: "bg-blue-500"
  }[badge.variant];

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)] hover:border-[var(--color-primary-subtle)] transition-all flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">{title}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeStyles}`}>
            {badge.label}
          </span>
        </div>

        {/* Primary Metric Display */}
        <div className="my-3">
          <div className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            {value}
          </div>
          {typeof progressPct === "number" && (
            <div className="w-full bg-[var(--color-surface-hover)] h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
              />
            </div>
          )}
        </div>

        {/* Rationale / Why this matters */}
        <div className="bg-[var(--color-surface-hover)]/70 border border-[var(--color-border-light)] rounded-xl p-2.5 mb-4 text-left">
          <div className="flex items-start gap-1.5">
            <span className="text-xs shrink-0 mt-0.5">💡</span>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              <strong className="font-semibold text-[var(--color-text-primary)]">Why it matters: </strong>
              {rationale}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-[var(--color-border-light)]/60 flex items-center gap-2">
        <button
          onClick={onAction}
          disabled={loading || disabled}
          className="btn btn-primary btn-sm flex-1 font-semibold flex items-center justify-center gap-2 text-xs py-2 shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>{actionText}</span>
            </>
          )}
        </button>

        {secondaryActionText && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="btn btn-ghost btn-sm text-xs font-semibold px-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
          >
            {secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
}
