'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, Check } from 'lucide-react';

/**
 * SaveStatus — small indicator chip showing draft / unsaved / saving / saved / error states.
 * Designed for forms that use auto-save. Same primitive used in both edit and new-listing pages.
 *
 * Props:
 *   autoSaving  boolean   — true while a silent save is in flight
 *   lastSavedAt Date|null — timestamp of last successful save
 *   dirty       boolean   — there are unsaved changes
 *   error       string|null — text of last auto-save error
 *   status      string    — current listing status; 'draft' enables auto-save, others show the "review on publish" hint
 */
export default function SaveStatus({ autoSaving, lastSavedAt, dirty, error, status }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const i = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(i);
  }, [lastSavedAt]);

  // For non-draft listings, the SaveStatus chip is suppressed.
  // The orientation info (status badge) is shown elsewhere in the UI
  // (listings table, rejection banner on the edit page). The Publish
  // button itself communicates the explicit action.
  if (status && status !== 'draft') return null;
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
        <AlertCircle className="w-3.5 h-3.5" />
        Couldn&apos;t save — we&apos;ll retry
      </span>
    );
  }
  if (autoSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <span className="w-3 h-3 border-2 border-mist border-t-transparent rounded-full motion-safe:animate-spin" />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mist">
        <span className="w-1.5 h-1.5 rounded-full bg-smoke-3" />
        Unsaved changes
      </span>
    );
  }
  if (lastSavedAt) {
    const sec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
    const label = sec < 5 ? 'Saved just now' : sec < 60 ? `Saved ${sec}s ago` : `Saved ${Math.floor(sec / 60)}m ago`;
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
        <Check className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mist">
      <span className="w-1.5 h-1.5 rounded-full bg-mist" />
      Draft
    </span>
  );
}
