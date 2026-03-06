'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Link2, Users, Info } from 'lucide-react';

const PLATFORMS = [
  { name: 'Facebook', code: 'facebook', utm: 'fb', icon: 'https://cdn.simpleicons.org/facebook/1877F2', bgClass: 'bg-[#1877F2]/8' },
  { name: 'Mailchimp', code: 'mailchimp', utm: 'mc', icon: 'https://cdn.simpleicons.org/mailchimp/FFE01B', bgClass: 'bg-amber-100/80' },
  { name: 'Twitter', code: 'twitter', utm: 'x', icon: 'https://cdn.simpleicons.org/x/000000', bgClass: 'bg-sky-100/80' },
  { name: 'Instagram', code: 'instagram', utm: 'ig', icon: 'https://cdn.simpleicons.org/instagram/E4405F', bgClass: 'bg-rose-100/80' },
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

  const generateUTMLink = (platform) => `${viewBase}/${slug}?utm=${platform.utm || platform.code}`;

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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="utm-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Share links</span>
            </div>
            <h2 id="utm-modal-title" className="text-base font-semibold text-slate-900">
              UTM tracking links
            </h2>
            {displayAddress && (
              <p className="text-xs text-slate-500 mt-0.5 truncate" title={displayAddress}>
                {displayAddress}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - single column, 4 rows */}
        <div className="flex-1 overflow-y-auto p-4 pt-4 min-h-0">
          {!hasValidSlug ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
              <p className="text-xs text-amber-800">
                No shareable link yet. Save or publish this property first so a link can be generated.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            {PLATFORMS.map((platform) => {
              const link = generateUTMLink(platform);
              const isCopied = copiedLink === platform.code;
              const count = counts && typeof counts[platform.code] === 'number' ? counts[platform.code] : null;

              return (
                <div
                  key={platform.code}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 hover:border-slate-300 transition-colors overflow-hidden"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-2">
                        <img
                          src={platform.icon}
                          alt=""
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="text-xs font-semibold text-black">
                          {platform.name}
                        </span>
                      </span>
                      {countsLoading ? (
                        <span className="h-5 w-8 bg-slate-200 rounded animate-pulse" />
                      ) : count !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <Users className="w-3 h-3 text-slate-400" />
                          {count} {count === 1 ? 'viewer' : 'viewers'}
                        </span>
                      ) : null}
                    </div>
                    <div className="rounded-md bg-white border border-slate-200 p-2 mb-2">
                      <code className="text-[11px] text-slate-600 break-all block leading-relaxed">
                        {link}
                      </code>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openLink(platform); }}
                        disabled={!hasValidSlug}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border-2 border-primary text-primary bg-white hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(link, platform.code)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors w-fit shrink-0 shadow-sm"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-100/80 border border-slate-200 p-2.5">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Share each link on the matching platform. Visitors who click through will be counted by source.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
