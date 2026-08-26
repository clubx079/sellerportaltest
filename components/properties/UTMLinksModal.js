'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Link2, Users, Info } from 'lucide-react';

const PLATFORMS = [
  { name: 'Facebook', code: 'facebook', utm: 'fb', icon: 'https://cdn.simpleicons.org/facebook/111111' },
  { name: 'Twitter', code: 'twitter', utm: 'x', icon: 'https://cdn.simpleicons.org/x/111111' },
  { name: 'Instagram', code: 'instagram', utm: 'ig', icon: 'https://cdn.simpleicons.org/instagram/111111' },
  { name: 'Email', code: 'email', utm: 'email', icon: 'https://cdn.simpleicons.org/gmail/111111' },
];

const DEELMAP_VIEW_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap.com').replace(/\/$/, '')
  : '';

export function UTMLinksModal({ isOpen, onClose, property, baseUrl, userId }) {
  const [copiedLink, setCopiedLink] = useState(null);
  const [counts, setCounts] = useState(null);
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !property?.id || !userId) { setCounts(null); return; }
    setCountsLoading(true);
    fetch(`/api/properties/${property.id}/utm-counts?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.ok ? res.json() : { counts: null })
      .then((data) => setCounts(data?.counts || null))
      .catch(() => setCounts(null))
      .finally(() => setCountsLoading(false));
  }, [isOpen, property?.id, userId]);

  if (!isOpen) return null;

  const viewBase = (baseUrl || DEELMAP_VIEW_BASE_URL).replace(/\/$/, '');
  const slug = (property?.slug ?? property?.id ?? '').toString().trim();
  const hasValidSlug = slug.length > 0;
  const displayAddress = property?.full_address || property?.address || property?.slug?.replace(/-/g, ' ') || '';

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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="utm-modal-title"
    >
      <div
        className="bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b-[1.5px] border-ink">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-muted mb-0.5">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">Share links</span>
            </div>
            <h2 id="utm-modal-title" className="font-display text-[16.5px] font-bold tracking-[-0.01em] text-body">
              UTM tracking links
            </h2>
            {displayAddress && (
              <p className="text-[12px] text-muted mt-0.5 truncate" title={displayAddress}>
                {displayAddress}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-tint text-muted hover:text-body transition-colors duration-120 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-tint-3">
          {!hasValidSlug && (
            <div className="rounded-[10px] border-[1.5px] border-ink bg-tint p-3 mb-3">
              <p className="text-[12px] font-semibold text-ink">
                No shareable link yet. Save or publish this property first so a link can be generated.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {PLATFORMS.map((platform) => {
              const link = generateUTMLink(platform);
              const isCopied = copiedLink === platform.code;
              const count = counts && typeof counts[platform.code] === 'number' ? counts[platform.code] : null;

              return (
                <div
                  key={platform.code}
                  className="rounded-[12px] border-[1.5px] border-ink bg-white overflow-hidden"
                >
                  <div className="p-3">
                    {/* Row 1: platform name left, viewer count right */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-2">
                        <img src={platform.icon} alt="" className="w-4 h-4 shrink-0" />
                        <span className="text-[13px] font-semibold text-body">{platform.name}</span>
                      </span>
                      {countsLoading ? (
                        <span className="h-5 w-16 bg-tint rounded motion-safe:animate-pulse" />
                      ) : count !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-tint border border-line px-2 py-0.5 font-mono text-[10.5px] font-semibold text-ink">
                          <Users className="w-3 h-3 text-muted" />
                          {count} {count === 1 ? 'viewer' : 'viewers'}
                        </span>
                      ) : null}
                    </div>
                    {/* Row 2: link block */}
                    <div className="rounded-[8px] bg-tint-3 border border-hairline p-2 mb-2">
                      <code className="font-mono text-[11px] text-body break-all block leading-relaxed">
                        {link}
                      </code>
                    </div>
                    {/* Row 3: Open + Copy buttons right-aligned */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openLink(platform); }}
                        disabled={!hasValidSlug}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-semibold border-[1.5px] border-ink text-ink bg-white shadow-offset-2 hover:bg-tint transition-all duration-120 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(link, platform.code)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-semibold transition-colors duration-120 ${
                          isCopied
                            ? 'bg-tint text-ink border-[1.5px] border-ink'
                            : 'bg-ink text-white border-[1.5px] border-ink hover:bg-smoke-2'
                        }`}
                      >
                        {isCopied ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copy</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-[10px] bg-white border border-hairline p-3">
            <Info className="w-3.5 h-3.5 text-mist shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted leading-relaxed">
              Share each link on the matching platform. Visitors who click through will be counted by source.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
