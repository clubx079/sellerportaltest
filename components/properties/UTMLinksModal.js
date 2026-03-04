'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Link2, Users } from 'lucide-react';

const PLATFORMS = [
  { name: 'Facebook', code: 'facebook', color: '#1877F2', bgClass: 'bg-[#1877F2]/10' },
  { name: 'Mailchimp', code: 'mailchimp', color: '#FFE01B', bgClass: 'bg-amber-100' },
  { name: 'Twitter', code: 'twitter', color: '#1DA1F2', bgClass: 'bg-sky-100' },
  { name: 'Instagram', code: 'instagram', color: '#E4405F', bgClass: 'bg-rose-100' },
];

const DEELMAP_VIEW_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap-production-16a1.up.railway.app').replace(/\/$/, '')
  : '';

export function UTMLinksModal({ isOpen, onClose, property, baseUrl, userId }) {
  const [copiedLink, setCopiedLink] = useState(null);
  const [counts, setCounts] = useState(null);
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !property?.id || !userId) {
      setCounts(null);
      return;
    }
    setCountsLoading(true);
    fetch(`/api/properties/${property.id}/utm-counts?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.ok ? res.json() : { counts: null })
      .then((data) => {
        setCounts(data?.counts || null);
      })
      .catch(() => setCounts(null))
      .finally(() => setCountsLoading(false));
  }, [isOpen, property?.id, userId]);

  if (!isOpen) return null;

  const viewBase = (baseUrl || DEELMAP_VIEW_BASE_URL || 'https://deelmap-production-16a1.up.railway.app').replace(/\/$/, '');
  const slug = (property?.slug ?? property?.id ?? '').toString().trim();
  const hasValidSlug = slug.length > 0;

  const generateUTMLink = (platform) => `${viewBase}/${slug}?utm_source=${platform.code}`;

  const openLink = (platform) => {
    const url = generateUTMLink(platform);
    if (url && url.startsWith('http')) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = async (link, platformCode) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(platformCode);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const displayAddress = property?.full_address || property?.address || property?.slug?.replace(/-/g, ' ') || '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-900/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="utm-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-neutral-100">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-neutral-500 mb-0.5">
              <Link2 className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium uppercase tracking-wider">Share links</span>
            </div>
            <h2 id="utm-modal-title" className="text-lg font-semibold text-neutral-900 mt-0.5">
              UTM tracking links
            </h2>
            {displayAddress && (
              <p className="text-sm text-neutral-500 mt-1 truncate" title={displayAddress}>
                {displayAddress}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - single column, 4 rows */}
        <div className="flex-1 overflow-y-auto p-6 pt-5 min-h-0">
          {!hasValidSlug ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-sm text-amber-800">
                No shareable link yet. Save or publish this property first so a link can be generated.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-4">
            {PLATFORMS.map((platform) => {
              const link = generateUTMLink(platform);
              const isCopied = copiedLink === platform.code;
              const count = counts && typeof counts[platform.code] === 'number' ? counts[platform.code] : null;

              return (
                <div
                  key={platform.code}
                  className="rounded-xl border border-neutral-200 bg-neutral-50/50 hover:border-neutral-300 transition-colors overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span
                        className="text-sm font-semibold text-neutral-900"
                        style={{ color: platform.color }}
                      >
                        {platform.name}
                      </span>
                      {countsLoading ? (
                        <span className="h-6 w-10 bg-neutral-200 rounded animate-pulse" />
                      ) : count !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white border border-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                          <Users className="w-3.5 h-3.5 text-neutral-400" />
                          {count} {count === 1 ? 'viewer' : 'viewers'}
                        </span>
                      ) : null}
                    </div>
                    <div className="rounded-lg bg-white border border-neutral-200 p-2.5 mb-3">
                      <code className="text-xs text-neutral-600 break-all block leading-relaxed">
                        {link}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(link, platform.code)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy link
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openLink(platform); }}
                        disabled={!hasValidSlug}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-700 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl bg-neutral-100 border border-neutral-200 p-4">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Share each link on the matching platform. Visitors who click through will be counted by source so you can see which channel drives the most interest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
