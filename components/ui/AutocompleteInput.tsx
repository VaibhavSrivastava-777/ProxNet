"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchCompanies, searchDesignations } from "@/lib/data/curated-suggestions";

export interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void;
  type?: "company" | "designation" | "custom";
  customSuggestions?: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  type = "company",
  customSuggestions,
  placeholder,
  className = "",
  inputClassName = "input w-full",
  autoFocus = false,
  disabled = false,
  required = false,
  id,
  name,
  onKeyDown,
  onBlur,
  icon,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dbSuggestions, setDbSuggestions] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute suggestions synchronously from curated data + any loaded DB suggestions
  const computeSuggestions = useCallback(
    (query: string, additional: string[] = []) => {
      const q = query.trim();
      if (!q) return [];
      if (type === "company") {
        return searchCompanies(q, additional, 8);
      } else if (type === "designation") {
        return searchDesignations(q, additional, 8);
      } else if (customSuggestions) {
        const lowerQ = q.toLowerCase();
        return customSuggestions
          .filter((item) => item.toLowerCase().includes(lowerQ))
          .slice(0, 8);
      }
      return [];
    },
    [type, customSuggestions]
  );

  // Live matching on value change + debounced API enrichment
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Immediate local match for 0ms latency
    const immediate = computeSuggestions(value, dbSuggestions);
    setSuggestions(immediate);
    if (immediate.length > 0) {
      setIsOpen(true);
      setHighlightedIndex(-1);
    }

    // Debounced API fetch to query DB items
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const q = value.trim();
      if (!q || q.length < 2) return;

      try {
        const endpoint =
          type === "company"
            ? `/api/companies?q=${encodeURIComponent(q)}`
            : type === "designation"
            ? `/api/companies/titles?q=${encodeURIComponent(q)}`
            : null;

        if (endpoint) {
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            const fetchedList: string[] =
              type === "company" ? data.companies || [] : data.titles || [];

            if (fetchedList.length > 0) {
              setDbSuggestions((prev) => {
                const combined = Array.from(new Set([...prev, ...fetchedList]));
                return combined;
              });

              // Re-rank with newly fetched items
              const updated = computeSuggestions(q, fetchedList);
              setSuggestions(updated);
              if (updated.length > 0) {
                setIsOpen(true);
              }
            }
          }
        }
      } catch (err) {
        // Silently swallow fetch errors; fallback remains intact
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value, computeSuggestions, type]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectItem = (item: string) => {
    onChange(item);
    if (onSelect) onSelect(item);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectItem(suggestions[highlightedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (e.key === "Tab" && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectItem(suggestions[highlightedIndex]);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Helper to highlight matching portion
  const renderHighlightedText = (text: string, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return text;

    const lower = text.toLowerCase();
    const index = lower.indexOf(q);
    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + q.length);
    const after = text.substring(index + q.length);

    return (
      <>
        {before}
        <span className="font-bold text-[var(--color-primary)] underline decoration-[var(--color-primary)]/40 underline-offset-2">
          {match}
        </span>
        {after}
      </>
    );
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative w-full flex items-center">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none select-none text-sm">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (value.trim().length > 0 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={(e) => {
            if (onBlur) onBlur(e);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className={`${inputClassName} ${icon ? "pl-9" : ""}`}
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] py-1.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            boxShadow: "0 12px 28px -4px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)",
          }}
        >
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <li
                key={`${item}-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  // Use onMouseDown so it fires before input onBlur
                  e.preventDefault();
                  handleSelectItem(item);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`flex items-center justify-between px-3.5 py-2 text-xs cursor-pointer select-none transition-colors ${
                  isHighlighted
                    ? "bg-[var(--color-surface-hover)] text-[var(--color-text)] font-medium"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[13px] opacity-75 shrink-0">
                    {type === "company" ? "🏢" : "💼"}
                  </span>
                  <span className="truncate">{renderHighlightedText(item, value)}</span>
                </div>
                {item.toLowerCase() === value.trim().toLowerCase() && (
                  <span className="text-emerald-500 text-xs shrink-0 font-bold ml-2">✓</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
