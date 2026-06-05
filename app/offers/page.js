'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Loader2, MapPin, Calendar, Home, MessageCircle, ChevronRight, DollarSign } from 'lucide-react';

const FONT = 'var(--font-dm-sans), sans-serif';

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('seller_user');
    const user = raw ? JSON.parse(raw) : null;
    return user?.id ? { Authorization: `Bearer ${user.id}` } : {};
  } catch { return {}; }
}

function formatCurrency(amount) {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES = {
  pending:   { label: 'Pending',       bg: 'bg-[#FEF3E2]', text: 'text-[#B5620A]' },
  accepted:  { label: 'Accepted',      bg: 'bg-[#E4F5EC]', text: 'text-[#0F6E56]' },
  rejected:  { label: 'Rejected',      bg: 'bg-[#FEF0EF]', text: 'text-[#D03839]' },
  countered: { label: 'Counter Sent',  bg: 'bg-[#EBF3FC]', text: 'text-[#4A90E2]' },
  withdrawn: { label: 'Withdrawn',     bg: 'bg-[#F3F3F1]', text: 'text-[#737370]' },
};

const FILTERS = ['All', 'Pending', 'Accepted', 'Rejected', 'Counter Sent', 'Withdrawn'];

export default function OffersReceivedPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  // submission_id -> { status, document_url } for accepted offers that have a contract.
  const [contractStatuses, setContractStatuses] = useState({});
  // offer_id currently performing a PATCH action
  const [actionLoading, setActionLoading] = useState(null);
  // offer_id whose inline counter input is open, plus its amount
  const [counterFor, setCounterFor] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');

  const refreshOffers = () => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    fetch('/api/seller/offers', { headers })
      .then(r => r.json())
      .then(data => setOffers(data.offers || []))
      .catch(() => {});
  };

  const handleOfferAction = async (offerId, action, extraData = {}) => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    setActionLoading(offerId);
    // Optimistic status update
    const optimisticStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : action === 'counter' ? 'countered' : null;
    if (optimisticStatus) {
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: optimisticStatus } : o));
    }
    try {
      const res = await fetch('/api/seller/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ offer_id: offerId, action, ...extraData }),
      });
      if (!res.ok) throw new Error('Action failed');
    } catch {
      // ignore — refresh reconciles
    } finally {
      setCounterFor(null);
      setCounterAmount('');
      setActionLoading(null);
      refreshOffers();
    }
  };

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) { setLoading(false); return; }
    fetch('/api/seller/offers', { headers })
      .then(r => r.json())
      .then(data => setOffers(data.offers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Pull live status for each linked contract so we can show "awaiting buyer"
  // vs a "View Contract" link to the fully-signed PDF.
  useEffect(() => {
    const ids = [...new Set(
      offers.filter(o => o.status === 'accepted' && o.contract_submission_id)
            .map(o => o.contract_submission_id)
    )];
    if (!ids.length) return;
    let cancelled = false;
    Promise.all(ids.map(id =>
      fetch(`/api/contracts?type=status&id=${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(data => [id, data])
        .catch(() => [id, null])
    )).then(entries => {
      if (cancelled) return;
      setContractStatuses(prev => {
        const next = { ...prev };
        for (const [id, data] of entries) if (data) next[id] = data;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [offers]);

  const filtered = filter === 'All'
    ? offers
    : offers.filter(o => (STATUS_STYLES[o.status]?.label || 'Pending') === filter);

  const pendingCount = offers.filter(o => o.status === 'pending').length;

  return (
    <div className="min-h-full bg-[#FAFAF8]" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="px-4 lg:px-6 pt-5 pb-4 bg-white border-b border-[#E8E8E4]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1816] tracking-[-0.44px]">Offers Received</h1>
            <p className="text-[14px] text-[#737370] mt-1">
              {loading ? 'Loading...' : `${offers.length} total · ${pendingCount} pending`}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        {!loading && offers.length > 0 && (
          <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  filter === f
                    ? 'bg-[#1A1816] text-white'
                    : 'bg-[#FAFAF8] border border-[#E8E8E4] text-[#444441] hover:bg-[#F3F3F1]'
                }`}
              >
                {f}
                {f === 'Pending' && pendingCount > 0 && (
                  <span className="ml-1.5 bg-[#D03839] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-7 h-7 text-[#A8A8A4] animate-spin" />
          </div>
        ) : offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <FileText className="w-10 h-10 text-[#D4D4CF] mb-3" />
            <p className="text-[15px] font-semibold text-[#444441]">No offers yet</p>
            <p className="text-[13px] text-[#737370] mt-1">When buyers submit offers on your listings, they'll appear here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-[14px] text-[#737370]">No {filter.toLowerCase()} offers.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((offer) => {
              const status = STATUS_STYLES[offer.status] || STATUS_STYLES.pending;
              const convLink = offer.conv_numeric ? `/messages?conversation=${offer.conv_numeric}` : '/messages';
              const priceDiff = offer.property_price && offer.offer_price
                ? offer.offer_price - offer.property_price : null;
              return (
                <div key={offer.id} className="bg-white border border-[#E8E8E4] rounded overflow-hidden flex flex-col sm:flex-row">
                  {/* Property image */}
                  <div className="sm:w-[140px] h-[110px] sm:h-auto bg-[#F3F3F1] flex-shrink-0 relative">
                    {offer.property_thumbnail_url ? (
                      <img src={offer.property_thumbnail_url} alt="" className="block w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="w-7 h-7 text-[#D4D4CF]" />
                      </div>
                    )}
                    <span className={`absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-4 flex flex-col sm:flex-row gap-3 min-w-0">
                    {/* Left: property + buyer info */}
                    <div className="flex-1 min-w-0">
                      {offer.property_address ? (
                        <div className="flex items-start gap-1 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-[#737370] flex-shrink-0 mt-0.5" />
                          <p className="text-[13px] font-semibold text-[#1A1816] leading-snug truncate">{offer.property_address}</p>
                        </div>
                      ) : (
                        <p className="text-[13px] font-semibold text-[#1A1816] mb-1">Property address unavailable</p>
                      )}

                      {/* Beds / Baths / Sqft */}
                      {(offer.property_bedrooms || offer.property_bathrooms || offer.property_sqft) && (
                        <div className="flex items-center gap-2 text-[12px] text-[#737370] mb-1.5">
                          {offer.property_bedrooms && <span>{offer.property_bedrooms} bed</span>}
                          {offer.property_bedrooms && offer.property_bathrooms && <span className="text-[#D4D4CF]">·</span>}
                          {offer.property_bathrooms && <span>{offer.property_bathrooms} bath</span>}
                          {offer.property_sqft && (offer.property_bedrooms || offer.property_bathrooms) && <span className="text-[#D4D4CF]">·</span>}
                          {offer.property_sqft && <span>{Number(offer.property_sqft).toLocaleString()} sqft</span>}
                        </div>
                      )}

                      <p className="text-[12px] text-[#737370] mb-1.5">
                        From <span className="font-medium text-[#444441]">{offer.buyer_name}</span>
                      </p>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#737370]">
                        {offer.financing_type && <span>{offer.financing_type}</span>}
                        {offer.closing_timeline && <><span className="text-[#D4D4CF]">·</span><span>Close in {offer.closing_timeline}</span></>}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(offer.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: price + actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[11px] text-[#737370]">Offer amount</p>
                        <p className="text-[20px] font-bold text-[#1A1816]">{formatCurrency(offer.offer_price)}</p>
                        {offer.property_price ? (
                          <p className="text-[11px] text-[#737370]">Asking {formatCurrency(offer.property_price)}</p>
                        ) : null}
                        {priceDiff != null && (
                          <p className={`text-[11px] font-medium ${priceDiff >= 0 ? 'text-[#0F6E56]' : 'text-[#D03839]'}`}>
                            {priceDiff >= 0 ? `+${formatCurrency(priceDiff)}` : formatCurrency(priceDiff)} vs asking
                          </p>
                        )}
                      </div>
                      {offer.status === 'pending' && (
                        counterFor === offer.id ? (
                          <div className="flex flex-col items-stretch gap-1.5 w-[150px]">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737370] text-[12px]">$</span>
                              <input
                                type="text"
                                autoFocus
                                value={counterAmount}
                                onChange={e => setCounterAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Counter amount"
                                className="w-full pl-5 pr-2 py-2 border border-[#E8E8E4] rounded text-[12px] text-[#1A1816] focus:outline-none focus:border-[#D03839]"
                              />
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => counterAmount && handleOfferAction(offer.id, 'counter', { counter_data: { amount: Number(counterAmount) } })}
                                disabled={!counterAmount || actionLoading === offer.id}
                                className="flex-1 px-2 py-1.5 bg-[#1A1816] hover:bg-[#333330] text-white text-[12px] font-semibold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {actionLoading === offer.id ? 'Sending…' : 'Send'}
                              </button>
                              <button
                                onClick={() => { setCounterFor(null); setCounterAmount(''); }}
                                disabled={actionLoading === offer.id}
                                className="px-2 py-1.5 border border-[#E8E8E4] hover:bg-[#FAFAF8] text-[#444441] text-[12px] font-semibold rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-stretch gap-1.5 w-[150px]">
                            <button
                              onClick={() => handleOfferAction(offer.id, 'accept')}
                              disabled={actionLoading === offer.id}
                              className="w-full px-3 py-2 bg-[#0F6E56] hover:bg-[#0C5A47] text-white text-[12px] font-semibold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {actionLoading === offer.id ? 'Working…' : 'Accept'}
                            </button>
                            <button
                              onClick={() => { setCounterFor(offer.id); setCounterAmount(String(Math.round(offer.offer_price || 0))); }}
                              disabled={actionLoading === offer.id}
                              className="w-full px-3 py-2 border border-[#E8E8E4] hover:bg-[#FAFAF8] text-[#1A1816] text-[12px] font-semibold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Counter
                            </button>
                            <button
                              onClick={() => handleOfferAction(offer.id, 'reject')}
                              disabled={actionLoading === offer.id}
                              className="w-full px-3 py-1.5 text-[#737370] hover:text-[#D03839] text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        )
                      )}
                      <Link
                        href={convLink}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#D03839] hover:bg-[#E0493B] text-white text-[12px] font-semibold rounded transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Respond
                      </Link>
                      {offer.status === 'accepted' && (
                        offer.contract_submission_id ? (
                          contractStatuses[offer.contract_submission_id]?.status === 'completed' ? (
                            <a
                              href={contractStatuses[offer.contract_submission_id].document_url || '/contracts'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-2 border border-[#E8E8E4] hover:bg-[#FAFAF8] text-[#1A1816] text-[12px] font-semibold rounded transition-colors whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Contract
                            </a>
                          ) : (
                            <span className="flex items-center gap-1.5 px-3 py-2 text-[#B5620A] text-[12px] font-semibold whitespace-nowrap">
                              Awaiting buyer signature
                            </span>
                          )
                        ) : (
                          <Link
                            href={`/contracts/new?from_offer=${offer.id}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#0F6E56] hover:bg-[#0C5A47] text-white text-[12px] font-semibold rounded transition-colors whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Create Contract
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
