"use client";

import { useState } from "react";

interface AdminModuleWrapperProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AdminModuleWrapper({ title, children, defaultOpen = false }: AdminModuleWrapperProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card mb-6 overflow-hidden border border-[var(--color-border-light)] shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors focus:outline-none text-left"
      >
        <h2 className="text-h3 m-0 text-[var(--color-text)] flex items-center gap-2">
          {title}
        </h2>
        <div className={`transform transition-transform duration-200 text-[var(--color-text-tertiary)] ${isOpen ? "rotate-180" : ""}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-bg)] animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}
