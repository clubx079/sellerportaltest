'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Link2, Users, Info } from 'lucide-react';

const PLATFORMS = [
  { name: 'Facebook', code: 'facebook', utm: 'fb', icon: 'https://cdn.simpleicons.org/facebook/1877F2' },
  { name: 'Twitter', code: 'twitter', utm: 'x', icon: 'https://cdn.simpleicons.org/x/000000' },
  { name: 'Instagram', code: 'instagram', utm: 'ig', icon: 'https://cdn.simpleicons.org/instagram/E4405F' },
  { name: 'Email', code: 'email', utm: 'email', icon: 'https://cdn.simpleicons.org/gmail/EA4335' },
];

const DEELMAP_VIEW_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap-production-16a1.up.railway.app').replace(/\/$/, '')
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="utm-modal-title"
    >
      <div
        className="bg-white rounded shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-[#E8E8E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E8E8E4]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[#737370] mb-0.5">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-[1px]">Share links</span>
            </div>
            <h2 id="utm-modal-title" className="text-[16px] font-bold text-[#1A1816]">
              UTM tracking links
            </h2>
            {displayAddress && (
              <p className="text-[12px] text-[#737370] mt-0.5 truncate" title={displayAddress}>
                {displayAddress}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#FAFAF8] text-[#737370] hover:text-[#1A1816] transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#FAFAF8]">
          {!hasValidSlug && (
            <div className="rounded border border-[#F5D78E] bg-[#FEF9EC] p-3 mb-3">
              <p className="text-[12px] text-[#B5620A]">
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
                  className="rounded border border-[#E8E8E4] bg-white overflow-hidden"
                >
                  <div className="p-3">
                    {/* Row 1: platform name left, viewer count right */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-2">
                        <img src={platform.icon} alt="" className="w-4 h-4 shrink-0" />
                        <span className="text-[13px] font-semibold text-[#1A1816]">{platform.name}</span>
                      </span>
                      {countsLoading ? (
                        <span className="h-5 w-16 bg-[#F0F0EE] rounded animate-pulse" />
                      ) : count !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FAFAF8] border border-[#E8E8E4] px-2 py-0.5 text-[11px] font-medium text-[#737370]">
                          <Users className="w-3 h-3 text-[#A8A8A4]" />
                          {count} {count === 1 ? 'viewer' : 'viewers'}
                        </span>
                      ) : null}
                    </div>
                    {/* Row 2: link block */}
                    <div className="rounded bg-[#FAFAF8] border border-[#E8E8E4] p-2 mb-2">
                      <code className="text-[11px] text-[#1A1816] break-all block leading-relaxed">
                        {link}
                      </code>
                    </div>
                    {/* Row 3: Open + Copy buttons right-aligned */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openLink(platform); }}
                        disabled={!hasValidSlug}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold border border-[#E8E8E4] text-[#1A1816] bg-white hover:bg-[#FAFAF8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(link, platform.code)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
                          isCopied
                            ? 'bg-[#E4F5EC] text-[#0F6E56] border border-[#A8DFBA]'
                            : 'bg-[#FEF0EF] text-[#D03839] hover:bg-[#FEE4E3] border border-[#F5C4C0]'
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

          <div className="mt-4 flex items-start gap-2 rounded bg-white border border-[#E8E8E4] p-3">
            <Info className="w-3.5 h-3.5 text-[#A8A8A4] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#737370] leading-relaxed">
              Share each link on the matching platform. Visitors who click through will be counted by source.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
