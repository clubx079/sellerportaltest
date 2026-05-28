'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessageCircle, Send, Search, ArrowLeft, Loader2, Check, CheckCheck,
  Pin, Paperclip, Smile, MapPin, Mail, Phone, Shield, AlertCircle, X, MoreVertical, Ban } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const API = '/api/seller/chat';
const FONT = 'var(--font-dm-sans), sans-serif';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const AVATAR_PAIRS = [
  { bg: '#FEF0EF', text: '#D03839' },
  { bg: '#E4F5EC', text: '#0F6E56' },
  { bg: '#FEF3E2', text: '#B5620A' },
  { bg: '#EBF3FC', text: '#4A90E2' },
  { bg: '#F3EEFF', text: '#7C3AED' },
];

function getAvatarPair(seed = '') {
  const str = String(seed || 'buyer');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PAIRS[Math.abs(hash) % AVATAR_PAIRS.length];
}

function getInitials(name) {
  if (!name) return 'B';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function capitalizeFirst(input = '') {
  const str = String(input || '');
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('seller_user');
    const user = raw ? JSON.parse(raw) : null;
    const id = user?.id;
    if (!id) return {};
    return { Authorization: `Bearer ${id}` };
  } catch { return {}; }
}

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function formatTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateHeader(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return `Today, ${date.toLocaleDateString('en-US', { month: 'long' })}\n${date.getDate()}`;
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const buyerIdFromUrl = searchParams.get('buyer_id');
  const addressFromUrl = searchParams.get('address') || '';
  const propertyIdFromUrl = searchParams.get('property_id') || '';
  const conversationIdFromUrl = searchParams.get('conversation');

  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [openConversationId, setOpenConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextAddress, setContextAddress] = useState('');
  const [contextConversationId, setContextConversationId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [blockConfirm, setBlockConfirm] = useState(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Offer state
  const [offer, setOffer] = useState(null);
  const [allOffers, setAllOffers] = useState([]);
  const [offerLoading, setOfferLoading] = useState(false);

  // Buyer credibility state
  const [buyerStats, setBuyerStats] = useState(null);
  const [buyerStatsLoading, setBuyerStatsLoading] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterTimeline, setCounterTimeline] = useState('30 days');
  const [counterFinancing, setCounterFinancing] = useState('Cash');
  const [counterNotes, setCounterNotes] = useState('');
  const [showCounterPreview, setShowCounterPreview] = useState(false);
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [showMobilePropPanel, setShowMobilePropPanel] = useState(false);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Heartbeat
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    let intervalId = null;
    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        fetch(API, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat' }) }).catch(() => {});
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') { sendHeartbeat(); intervalId = setInterval(sendHeartbeat, 25000); }
      else { if (intervalId) clearInterval(intervalId); intervalId = null; }
    };
    if (document.visibilityState === 'visible') { sendHeartbeat(); intervalId = setInterval(sendHeartbeat, 25000); }
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); if (intervalId) clearInterval(intervalId); };
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Access gate
  useEffect(() => {
    const raw = localStorage.getItem('seller_user');
    if (!raw) return;
    const user = JSON.parse(raw);
    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${user.id}` } })
      .then(r => r.json())
      .then(ws => {
        const isOwner = ws?.current?.role === 'admin'
        if (!isOwner && !ws?.current?.permissions?.inbox_access) setAccessDenied(true)
      })
      .catch(() => {})
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const headers = getAuthHeaders();
    if (!headers.Authorization) { setError('Please log in.'); setLoading(false); return; }
    setLoading(true); setError(null);
    const url = buyerIdFromUrl
      ? `${API}?action=get_conversations&buyer_id=${encodeURIComponent(buyerIdFromUrl)}${propertyIdFromUrl ? `&property_id=${encodeURIComponent(propertyIdFromUrl)}` : ''}`
      : `${API}?action=get_conversations`;
    fetch(url, { headers })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const list = data.conversations || [];
        setConversations(list); setFilteredConversations(list);
        if (data.openConversationId) {
          setOpenConversationId(data.openConversationId);
          if (addressFromUrl) { setContextAddress(addressFromUrl); setContextConversationId(data.openConversationId); }
          return;
        }
        if (conversationIdFromUrl && list.length > 0) {
          const match = list.find(c => String(c.id) === String(conversationIdFromUrl));
          if (match) { setOpenConversationId(match.id); return; }
        }
        if (buyerIdFromUrl) {
          const existing = list.find(c => {
            const match = c.buyer_uuid && String(c.buyer_uuid) === String(buyerIdFromUrl);
            if (!match) return false;
            return !propertyIdFromUrl || String(c.property_id || '') === String(propertyIdFromUrl);
          });
          if (existing) {
            setOpenConversationId(existing.id);
            if (addressFromUrl) { setContextAddress(addressFromUrl); setContextConversationId(existing.id); }
            return;
          }
          createConversation(buyerIdFromUrl, headers).then(id => {
            if (id) {
              setOpenConversationId(id);
              if (addressFromUrl) { setContextAddress(addressFromUrl); setContextConversationId(id); }
              setConversations(prev => [{ id, buyer_uuid: buyerIdFromUrl, buyer_name: 'Buyer', last_message_preview: null, last_message_at: new Date().toISOString(), is_active: true }, ...prev]);
            }
            fetchConversations(headers);
          });
        }
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load conversations'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buyerIdFromUrl, propertyIdFromUrl, addressFromUrl, conversationIdFromUrl]);

  function fetchConversations(headers) {
    const h = headers || getAuthHeaders();
    if (!h?.Authorization) return;
    const url = buyerIdFromUrl
      ? `${API}?action=get_conversations&buyer_id=${encodeURIComponent(buyerIdFromUrl)}${propertyIdFromUrl ? `&property_id=${encodeURIComponent(propertyIdFromUrl)}` : ''}`
      : `${API}?action=get_conversations`;
    fetch(url, { headers: h }).then(r => r.json()).then(data => {
      const list = data.conversations || [];
      setConversations(list);
      // Don't set filteredConversations here — the searchQuery effect derives it
      // from `conversations`, so it stays correct without clobbering an active search.
      if (openConversationId != null && !list.some(c => c.id === openConversationId)) setOpenConversationId(null);
    }).catch(() => {});
  }

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    // 60s fallback poll to catch NEW conversations from buyers not currently open.
    // The currently-open conversation updates instantly via the Supabase realtime
    // subscription below, so this only needs to be a slow safety net.
    const interval = setInterval(() => fetchConversations(headers), 60000);
    return () => clearInterval(interval);
  }, [buyerIdFromUrl, propertyIdFromUrl]);

  async function createConversation(buyerId, headers) {
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ action: 'create_conversation', buyerId, propertyId: propertyIdFromUrl || null, propertyAddress: addressFromUrl || null })
    });
    const data = await res.json().catch(() => ({}));
    return data.conversationId || null;
  }

  // Load messages when conversation selected
  useEffect(() => {
    if (!openConversationId) { setMessages([]); return; }
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    fetch(`${API}?action=get_messages&conversation_id=${openConversationId}`, { headers })
      .then(r => r.json()).then(data => setMessages(data.messages || [])).catch(() => setMessages([]));
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'mark_as_read', conversationId: openConversationId }) }).catch(() => {});
    setConversations(prev => prev.map(c => c.id === openConversationId ? { ...c, unread_count: 0 } : c));
    setFilteredConversations(prev => prev.map(c => c.id === openConversationId ? { ...c, unread_count: 0 } : c));
  }, [openConversationId]);

  // Realtime
  useEffect(() => {
    if (!openConversationId) return () => {};
    const supabase = getSupabase();
    if (!supabase) return () => {};
    const channel = supabase
      .channel(`seller-conversation-${openConversationId}`, { config: { broadcast: { self: true } } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${openConversationId}` }, (payload) => {
        const updated = payload.new;
        if (updated?.id != null && updated.is_read) setMessages(prev => prev.map(msg => String(msg.id) === String(updated.id) ? { ...msg, is_read: true } : msg));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${openConversationId}` }, (payload) => {
        const newMsg = payload.new;
        if (!newMsg || newMsg.id == null) return;
        setMessages(prev => prev.some(m => String(m.id) === String(newMsg.id)) ? prev : [...prev, newMsg]);
        const headers = getAuthHeaders();
        if (headers.Authorization) {
          fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'mark_as_read', conversationId: openConversationId }) }).catch(() => {});
        }
        setConversations(prev => prev.map(c => c.id === openConversationId ? { ...c, unread_count: 0, last_message_preview: (newMsg.message_text || '').slice(0, 200), last_message_at: newMsg.created_at || c.last_message_at } : c));
        setFilteredConversations(prev => prev.map(c => c.id === openConversationId ? { ...c, unread_count: 0, last_message_preview: (newMsg.message_text || '').slice(0, 200), last_message_at: newMsg.created_at || c.last_message_at } : c));
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'offers', filter: `conversation_id=eq.${openConversationId}` }, (payload) => {
        const newOffer = payload.new;
        if (!newOffer?.id) return;
        setOffer(newOffer);
        if (newOffer.offer_price) setCounterAmount(String(Math.round(newOffer.offer_price)));
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'offers', filter: `conversation_id=eq.${openConversationId}` }, (payload) => {
        const updated = payload.new;
        if (!updated?.id) return;
        setOffer(prev => prev && String(prev.id) === String(updated.id) ? { ...prev, ...updated } : prev);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [openConversationId]);

  useEffect(() => {
    if (!conversationIdFromUrl || conversations.length === 0) return;
    const match = conversations.find(c => String(c.id) === String(conversationIdFromUrl));
    if (match) setOpenConversationId(match.id);
  }, [conversationIdFromUrl, conversations]);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredConversations(conversations); return; }
    const q = searchQuery.toLowerCase();
    setFilteredConversations(conversations.filter(c => (c.buyer_name || '').toLowerCase().includes(q) || (c.last_message_preview || '').toLowerCase().includes(q) || (c.property_address || '').toLowerCase().includes(q)));
  }, [searchQuery, conversations]);

  const displayedConversations = (filteredConversations || [])
    .sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    });

  const updateConversationPref = async (conversationId, patch) => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'update_conversation_pref', conversationId, ...patch }) }).catch(() => {});
    fetchConversations(headers);
  };

  const deleteConversation = async (conversationId) => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'delete_conversation', conversationId }) });
    if (res.ok) { if (openConversationId === conversationId) setOpenConversationId(null); fetchConversations(headers); }
  };

  const sendMessage = () => {
    const text = messageText.trim();
    if (!text || !openConversationId || sending) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    setSending(true);
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'send_message', conversationId: openConversationId, messageText: text }) })
      .then(r => r.json())
      .then(data => {
        if (data.message) {
          const msg = data.message;
          setMessages(prev => prev.some(m => String(m.id) === String(msg.id)) ? prev : [...prev, msg]);
          setMessageText('');
          const preview = (msg.message_text || text).slice(0, 200);
          const at = msg.created_at || new Date().toISOString();
          const updateList = prev => {
            const updated = prev.map(c => c.id === openConversationId ? { ...c, last_message_preview: preview, last_message_at: at } : c);
            const idx = updated.findIndex(c => c.id === openConversationId);
            if (idx > 0) { const [conv] = updated.splice(idx, 1); return [conv, ...updated]; }
            return updated;
          };
          setConversations(updateList);
          setFilteredConversations(updateList);
          setTimeout(() => messageInputRef.current?.focus(), 0);
        }
      })
      .catch(() => {})
      .finally(() => setSending(false));
  };

  // H6 — upload a file to Supabase storage and send it as an attachment message
  const sendAttachment = async (file) => {
    if (!file || !openConversationId || uploadingAttachment) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    const MAX = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX) { alert('File too large (max 10MB).'); return; }
    setUploadingAttachment(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Storage unavailable');
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `chat/${openConversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('scraperpropertyphotos')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('scraperpropertyphotos').getPublicUrl(path);
      const attachmentUrl = pub?.publicUrl;
      if (!attachmentUrl) throw new Error('Could not get file URL');

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: 'send_message', conversationId: openConversationId, messageText: messageText.trim() || null, attachmentUrl, attachmentName: file.name }),
      });
      const data = await res.json();
      if (data.message) {
        const msg = data.message;
        setMessages(prev => prev.some(m => String(m.id) === String(msg.id)) ? prev : [...prev, msg]);
        setMessageText('');
      }
    } catch (e) {
      alert('Failed to send attachment: ' + (e?.message || 'unknown error'));
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch offer when conversation changes
  useEffect(() => {
    if (!openConversationId) { setOffer(null); setAllOffers([]); return; }
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    setOfferLoading(true);
    fetch(`/api/seller/offers?conversation_id=${openConversationId}`, { headers })
      .then(r => r.json())
      .then(data => {
        const offers = data.offers || [];
        setAllOffers(offers);
        // Latest pending offer drives the respond panel
        const latest = offers.find(o => o.status !== 'expired') || offers[0] || null;
        setOffer(latest || null);
        if (latest?.offer_price) setCounterAmount(String(Math.round(latest.offer_price)));
      })
      .catch(() => { setOffer(null); setAllOffers([]); })
      .finally(() => setOfferLoading(false));
    // Reset offer UI state on conversation change
    setShowAcceptModal(false);
    setShowRejectModal(false);
    setShowCounterForm(false);
  }, [openConversationId]);

  // Fetch buyer credibility stats when conversation changes
  useEffect(() => {
    const conv = conversations.find(c => c.id === openConversationId);
    const buyerUuid = conv?.buyer_uuid;
    if (!buyerUuid) { setBuyerStats(null); return; }
    setBuyerStatsLoading(true);
    fetch(`/api/seller/buyer-stats?buyer_id=${buyerUuid}`)
      .then(r => r.json())
      .then(data => setBuyerStats(data))
      .catch(() => setBuyerStats(null))
      .finally(() => setBuyerStatsLoading(false));
  }, [openConversationId, conversations]);

  const handleOfferAction = async (action, extraData = {}) => {
    if (!offer) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    setOfferActionLoading(true);
    try {
      const res = await fetch('/api/seller/offers', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offer.id, action, ...extraData }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Action failed');
      // Refresh offer + messages in parallel
      const [refreshRes, msgsRes] = await Promise.all([
        fetch(`/api/seller/offers?conversation_id=${openConversationId}`, { headers }),
        fetch(`${API}?action=get_messages&conversation_id=${openConversationId}`, { headers }),
      ]);
      const refreshData = await refreshRes.json();
      const offers = refreshData.offers || [];
      setAllOffers(offers);
      const latest = offers.find(o => o.status !== 'expired') || offers[0] || null;
      setOffer(latest || null);
      const msgsData = await msgsRes.json();
      if (msgsData.messages) setMessages(msgsData.messages);
      setShowAcceptModal(false);
      setShowRejectModal(false);
      setShowCounterForm(false);
    } catch (err) {
      alert(err.message || 'Something went wrong');
    } finally {
      setOfferActionLoading(false);
    }
  };

  const selectedConversation = conversations.find(c => c.id === openConversationId);
  const buyerDisplayName = selectedConversation?.buyer_name?.trim() || 'Buyer';
  const selectedPropertyAddress = selectedConversation?.property_address || null;

  // Merge offers as synthetic items, filter out text-based offer messages
  const offerItems = allOffers.map(o => ({ ...o, _isOffer: true }));
  const filteredMessages = messages.filter(m =>
    !(m.message_text || '').startsWith('Offer submitted:') &&
    !(m.message_text || '').startsWith('Counter offer:')
  );
  const allItems = [...filteredMessages, ...offerItems].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Group combined items by date
  const messagesByDate = allItems.reduce((acc, item) => {
    const key = new Date(item.created_at).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (accessDenied) return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center" style={{ fontFamily: FONT }}>
      <div className="w-12 h-12 bg-[#FEF0EF] rounded-full flex items-center justify-center mb-4">
        <Shield className="w-6 h-6 text-[#D03839]" />
      </div>
      <h3 className="text-[16px] font-bold text-[#1A1816] mb-2">Access Restricted</h3>
      <p className="text-[13px] text-[#737370] max-w-xs">You don't have permission to access messages. Contact your team owner to request access.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 overflow-hidden -m-4 lg:-m-6" style={{ fontFamily: FONT }}>
      {/* Counter-offer preview/confirm modal — gate the send so sellers
          see the full terms before committing. */}
      {showCounterPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowCounterPreview(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-[460px] bg-white border border-[#E8E8E4] rounded shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E4] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#1A1816]">Review counter offer</h3>
                <p className="text-[12px] text-[#737370] mt-0.5">Confirm the terms before sending.</p>
              </div>
              <button onClick={() => setShowCounterPreview(false)} className="p-1 rounded hover:bg-[#FAFAF8] -mr-1" aria-label="Close">
                <X className="w-4 h-4 text-[#737370]" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold text-[#A8A8A4] uppercase tracking-wide">Counter price</span>
                <span className="text-[22px] font-bold text-[#1A1816]">${counterAmount ? Number(counterAmount).toLocaleString() : '0'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#F0F0EE]">
                <span className="text-[12px] text-[#737370]">Closing timeline</span>
                <span className="text-[13px] font-medium text-[#1A1816]">{counterTimeline}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#F0F0EE]">
                <span className="text-[12px] text-[#737370]">Financing</span>
                <span className="text-[13px] font-medium text-[#1A1816]">{counterFinancing}</span>
              </div>
              {counterNotes && (
                <div className="py-2 border-t border-[#F0F0EE]">
                  <span className="block text-[12px] text-[#737370] mb-1">Notes to buyer</span>
                  <p className="text-[13px] text-[#1A1816] whitespace-pre-wrap leading-relaxed">{counterNotes}</p>
                </div>
              )}
              <div className="flex items-start gap-2 bg-[#FEF9EC] border border-[#F5D78E] rounded px-3 py-2.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#B5620A] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#B5620A]">The buyer will be notified immediately and can accept, counter, or decline.</p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#E8E8E4] bg-[#FAFAF8] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCounterPreview(false)}
                className="h-9 px-3 border border-[#E8E8E4] text-[#444441] hover:border-[#1A1816] hover:text-[#1A1816] text-[13px] font-semibold rounded transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleOfferAction('counter', {
                    counter_data: { amount: Number(counterAmount), closing_timeline: counterTimeline, financing_type: counterFinancing, notes: counterNotes }
                  });
                  setShowCounterPreview(false);
                }}
                disabled={offerActionLoading}
                className="h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {offerActionLoading ? 'Sending…' : 'Send counter offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded bg-[#FEF0EF] border border-[#F5C4C0] p-3 mb-3 shrink-0">
          <p className="text-[13px] text-[#D03839]">{error}</p>
        </div>
      )}

      <div className="flex-1 flex min-h-0 bg-white overflow-hidden">
        {/* Left Panel — Conversation List */}
        <div className={`${openConversationId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[320px] border-r border-[#E8E8E4] bg-white shrink-0 min-h-0 overflow-hidden`}>
          <div className="flex-shrink-0 px-5 pt-5 pb-4">
            <h2 className="text-[20px] font-bold text-[#1A1816] tracking-[-0.66px] mb-4">All Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A8A4]" />
              <input
                type="text" placeholder="Search conversations"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAFAF8] border border-[#E8E8E4] rounded text-[14px] text-[#1A1816] placeholder-[#A8A8A4] focus:outline-none focus:border-[#D03839] focus:ring-1 focus:ring-[rgba(208,56,57,.12)] transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E8E8E4] border-t-[#1A1816]" />
              </div>
            ) : displayedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                <MessageCircle className="w-8 h-8 text-[#A8A8A4] mb-3" />
                <p className="text-[14px] font-medium text-[#444441]">{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
              </div>
            ) : (
              <div>
                {displayedConversations.map(c => {
                  const name = capitalizeFirst(c.buyer_name || 'Buyer');
                  const initials = getInitials(name);
                  const isActive = openConversationId === c.id;
                  const hasUnread = (c.unread_count ?? 0) > 0;

                  return (
                    <div
                      key={c.id}
                      onClick={() => setOpenConversationId(c.id)}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, conv: c }); }}
                      className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors duration-200 border-l-2 ${
                        isActive ? 'bg-[#FAFAF8] border-l-[#D03839]' : 'border-l-transparent hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
                        style={{ backgroundColor: getAvatarPair(name).bg, color: getAvatarPair(name).text }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={`text-[14px] truncate ${hasUnread ? 'font-bold text-[#1A1816]' : 'font-medium text-[#1A1816]'}`}>{name}</h3>
                          <span className="text-[11px] text-[#A8A8A4] flex-shrink-0">{formatTimeAgo(c.last_message_at)}</span>
                        </div>
                        {c.buyer_email && (
                          <p className="text-[11px] text-[#A8A8A4] truncate mt-0">{c.buyer_email}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-[12px] truncate ${hasUnread ? 'text-[#444441] font-medium' : 'text-[#737370]'}`}>
                            {c.last_message_preview || 'No messages yet'}
                          </p>
                          {hasUnread && <span className="w-2.5 h-2.5 rounded-full bg-[#D03839] flex-shrink-0"></span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center Panel — Chat */}
        <div className={`${openConversationId ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-white min-w-0 min-h-0`}>
          {!openConversationId ? (
            <div className="flex-1 flex items-center justify-center bg-[#FAFAF8]">
              <div className="text-center">
                <MessageCircle className="w-10 h-10 text-[#A8A8A4] mx-auto mb-3" />
                <h3 className="text-[14px] font-semibold text-[#1A1816] mb-1">Select a conversation</h3>
                <p className="text-[13px] text-[#737370]">Choose a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex-shrink-0 px-6 py-4 border-b border-[#E8E8E4] bg-white">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setOpenConversationId(null)} className="lg:hidden p-2 -ml-2 rounded hover:bg-[#FAFAF8] transition-colors duration-200">
                    <ArrowLeft className="w-5 h-5 text-[#444441]" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[16px] font-bold text-[#1A1816]">{buyerDisplayName}</h2>
                    <p className="text-[13px] text-[#737370]">Interested Buyer</p>
                  </div>
                  {selectedPropertyAddress && (
                    <button
                      type="button"
                      onClick={() => setShowMobilePropPanel(true)}
                      className="xl:hidden p-2 rounded hover:bg-[#FAFAF8] transition-colors duration-200 flex-shrink-0"
                    >
                      <MoreVertical className="w-5 h-5 text-[#444441]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 bg-white">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Send className="w-8 h-8 text-[#A8A8A4] mx-auto mb-3" />
                      <p className="text-[14px] font-medium text-[#444441]">No messages yet</p>
                      <p className="text-[12px] text-[#737370] mt-1">Start the conversation</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(messagesByDate).map(([dateKey, msgs]) => (
                      <div key={dateKey}>
                        <div className="flex items-center justify-center mb-4">
                          <span className="text-[12px] text-[#A8A8A4] font-medium bg-white px-3">
                            {formatDateHeader(msgs[0].created_at)}
                          </span>
                        </div>
                        <div className="space-y-4">
                          {msgs.map((item, idx) => {
                            const statusColors = { pending: 'bg-[#EBF3FC] text-[#4A90E2]', accepted: 'bg-[#E4F5EC] text-[#0F6E56]', rejected: 'bg-[#FEF0EF] text-[#D03839]', countered: 'bg-[#FFF7ED] text-[#C27A12]', withdrawn: 'bg-[#F3F3F1] text-[#737370]' };
                            const statusLabel = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', countered: 'Countered', withdrawn: 'Withdrawn' };

                            // Offer card from offers table (has its own status)
                            if (item._isOffer) {
                              const isCounter = !!item.parent_offer_id;
                              const isSeller = isCounter; // counter offers are sent by seller
                              return (
                                <div key={`offer-${item.id}`}>
                                  {isSeller
                                    ? <p className="text-[12px] font-medium text-[#444441] mb-1 text-right">You</p>
                                    : <p className="text-[12px] font-medium text-[#444441] mb-1">{buyerDisplayName}</p>
                                  }
                                  <div className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}>
                                    <div className="bg-white border border-[#E8E8E4] rounded px-4 py-3 shadow-sm w-full max-w-[300px]">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#4A90E2]">
                                          {isCounter ? 'Counter offer' : 'Offer submitted'}
                                        </span>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColors[item.status] || statusColors.pending}`}>
                                          {statusLabel[item.status] || item.status}
                                        </span>
                                      </div>
                                      <p className="text-[22px] font-bold text-[#1A1816] leading-none mb-1">{formatCurrency(item.offer_price)}</p>
                                      {(item.financing_type || item.closing_timeline) && (
                                        <p className="text-[12px] text-[#737370]">
                                          {[item.financing_type, item.closing_timeline ? `Close in ${item.closing_timeline}` : null].filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                      <span className="text-[11px] text-[#A8A8A4] mt-1 block">{formatTime(item.created_at)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Regular message
                            const m = item;
                            const isSeller = m.sender_type === 'seller';
                            return (
                              <div key={m.id}>
                                {isSeller && <p className="text-[12px] font-medium text-[#444441] mb-1 text-right">You</p>}
                                {!isSeller && <p className="text-[12px] font-medium text-[#444441] mb-1">{buyerDisplayName}</p>}
                                <div className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}>
                                  <div className="max-w-[70%]">
                                    <div className={`rounded px-4 py-3 ${isSeller ? 'bg-[#FEF0EF] text-[#1A1816] border border-[#F5C4C0]' : 'bg-[#FAFAF8] text-[#1A1816] border border-[#E8E8E4]'}`}>
                                      {m.message_text && <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{m.message_text}</p>}
                                      {m.has_attachment && m.attachment_url && (
                                        /\.(png|jpe?g|gif|webp|heic)$/i.test(m.attachment_name || m.attachment_url)
                                          ? <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className={m.message_text ? 'mt-2 block' : 'block'}>
                                              <img src={m.attachment_url} alt={m.attachment_name || 'attachment'} className="max-w-full rounded border border-[#E8E8E4] max-h-64 object-cover" />
                                            </a>
                                          : <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className={`${m.message_text ? 'mt-2' : ''} flex items-center gap-2 text-[13px] font-medium text-[#D03839] underline`}>
                                              <Paperclip className="w-3.5 h-3.5" /> {m.attachment_name || 'Download attachment'}
                                            </a>
                                      )}
                                    </div>
                                    <div className={`flex items-center gap-1 mt-1 ${isSeller ? 'justify-end' : 'justify-start'}`}>
                                      <span className="text-[11px] text-[#A8A8A4]">{formatTime(m.created_at)}</span>
                                      {isSeller && (m.is_read
                                        ? <CheckCheck className="w-3.5 h-3.5 text-[#4A90E2]" />
                                        : <Check className="w-3.5 h-3.5 text-[#A8A8A4]" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-[#E8E8E4] bg-white">
                <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={e => { const f = e.target.files?.[0]; if (f) sendAttachment(f); }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAttachment || !openConversationId}
                    title="Attach a file"
                    className="p-2.5 rounded hover:bg-[#FAFAF8] transition-colors duration-200 flex-shrink-0 disabled:opacity-50">
                    {uploadingAttachment ? <Loader2 className="w-5 h-5 text-[#737370] animate-spin" /> : <Paperclip className="w-5 h-5 text-[#737370]" />}
                  </button>
                  <button type="button" className="p-2.5 rounded hover:bg-[#FAFAF8] transition-colors duration-200 flex-shrink-0">
                    <Smile className="w-5 h-5 text-[#737370]" />
                  </button>
                  <textarea
                    ref={messageInputRef} value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type your message" disabled={sending} rows={1}
                    className="flex-1 resize-none px-4 py-2.5 bg-[#FAFAF8] border border-[#E8E8E4] rounded text-[14px] text-[#1A1816] placeholder-[#A8A8A4] focus:outline-none focus:border-[#D03839] focus:ring-1 focus:ring-[rgba(208,56,57,.12)] disabled:opacity-50 max-h-32 transition-all duration-200"
                  />
                  <button type="submit" disabled={!messageText.trim() || sending}
                    className="p-2.5 bg-[#D03839] hover:bg-[#E0493B] disabled:bg-[#F5C4C0] rounded transition-colors duration-200 disabled:cursor-not-allowed flex-shrink-0">
                    {sending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Right Panel — Offer Details */}
        {openConversationId && selectedConversation && (
          <div className="hidden xl:flex flex-col w-[300px] border-l border-[#E8E8E4] bg-white overflow-y-auto shrink-0">

            {/* COUNTER OFFER FORM */}
            {showCounterForm ? (
              <>
                <div className="px-5 py-4 border-b border-[#E8E8E4] flex items-center justify-between">
                  <h3 className="text-[16px] font-bold text-[#1A1816]">Send counter offer</h3>
                  <button onClick={() => setShowCounterForm(false)} className="p-1 rounded hover:bg-[#FAFAF8]">
                    <X className="w-4 h-4 text-[#737370]" />
                  </button>
                </div>
                <div className="px-5 py-4 flex flex-col gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#1A1816] mb-1.5">Counter price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737370] text-[13px]">$</span>
                      <input
                        type="text"
                        value={counterAmount}
                        onChange={e => setCounterAmount(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full pl-6 pr-3 py-2.5 border border-[#E8E8E4] rounded text-[14px] text-[#1A1816] focus:outline-none focus:border-[#D03839]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#1A1816] mb-1.5">Closing Timeline</label>
                    <select value={counterTimeline} onChange={e => setCounterTimeline(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[#E8E8E4] rounded text-[14px] text-[#1A1816] bg-white focus:outline-none focus:border-[#D03839] appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737370' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                      {['30 days','45 days','60 days','As-is'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#1A1816] mb-1.5">Financing type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Cash','Loan'].map(type => (
                        <button key={type} type="button" onClick={() => setCounterFinancing(type)}
                          className={`flex items-center gap-2 px-3 py-2.5 border rounded text-[13px] font-medium transition-colors ${
                            counterFinancing === type ? 'border-[#D03839] text-[#D03839]' : 'border-[#E8E8E4] text-[#444441] hover:border-[#D03839]/30'
                          }`}>
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${counterFinancing === type ? 'border-[#D03839]' : 'border-[#A8A8A4]'}`}>
                            {counterFinancing === type && <div className="w-1.5 h-1.5 rounded-full bg-[#D03839]" />}
                          </div>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#1A1816] mb-1.5">Notes to Buyer</label>
                    <textarea value={counterNotes} onChange={e => setCounterNotes(e.target.value)}
                      placeholder="e.g. Price reflects recent comparable sales..."
                      rows={3}
                      className="w-full px-3 py-2.5 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] resize-none focus:outline-none focus:border-[#D03839] placeholder-[#A8A8A4]"
                    />
                  </div>
                  <div className="flex items-start gap-2 bg-[#FEF9EC] border border-[#F5D78E] rounded px-3 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#B5620A] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#B5620A]">The buyer will be notified immediately and can accept, counter, or decline your offer</p>
                  </div>
                  <button
                    onClick={() => setShowCounterPreview(true)}
                    disabled={offerActionLoading || !counterAmount}
                    className="w-full py-3 bg-[#D03839] text-white text-[14px] font-semibold rounded hover:bg-[#E0493B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review &amp; Send
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#E8E8E4]">
                  <h3 className="text-[18px] font-bold text-[#1A1816]">Offer Details</h3>
                  <p className="text-[13px] text-[#737370]">Buyer & Offer</p>
                </div>

                {/* BUYER INFO */}
                <div className="px-5 py-4 border-b border-[#E8E8E4]">
                  <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-3">Buyer Info</p>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
                      style={{ backgroundColor: getAvatarPair(buyerDisplayName).bg, color: getAvatarPair(buyerDisplayName).text }}
                    >
                      {getInitials(buyerDisplayName)}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#1A1816]">{buyerDisplayName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Shield className="w-3 h-3 text-[#0F6E56]" />
                        <span className="text-[11px] text-[#0F6E56] font-medium">Verified buyer</span>
                      </div>
                    </div>
                  </div>
                  {selectedConversation.buyer_email && (
                    <div className="flex items-center gap-2 text-[13px] text-[#444441] mb-1.5">
                      <Mail className="w-4 h-4 text-[#737370]" />
                      <span className="truncate">{selectedConversation.buyer_email}</span>
                    </div>
                  )}
                  {selectedConversation.buyer_phone && (
                    <div className="flex items-center gap-2 text-[13px] text-[#444441]">
                      <Phone className="w-4 h-4 text-[#737370]" />
                      <span>{selectedConversation.buyer_phone}</span>
                    </div>
                  )}
                </div>

                {/* OFFER DETAILS */}
                <div className="px-5 py-4 border-b border-[#E8E8E4]">
                  <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-3">Offer Details</p>
                  {offerLoading ? (
                    <div className="flex items-center justify-center h-16"><Loader2 className="w-5 h-5 animate-spin text-[#A8A8A4]" /></div>
                  ) : !offer ? (
                    <p className="text-[13px] text-[#737370]">No offer yet from this buyer.</p>
                  ) : (
                    <>
                      <p className="text-[28px] font-bold text-[#1A1816] tracking-[-0.56px] mb-1">{formatCurrency(offer.offer_price)}</p>
                      <div className="mb-3">
                        {offer.status === 'pending' && <span className="inline-block px-2 py-0.5 bg-[#FEF3E2] text-[#B5620A] text-[11px] font-semibold rounded">Negotiating</span>}
                        {offer.status === 'accepted' && <span className="inline-block px-2 py-0.5 bg-[#E4F5EC] text-[#0F6E56] text-[11px] font-semibold rounded">Accepted</span>}
                        {offer.status === 'rejected' && <span className="inline-block px-2 py-0.5 bg-[#FEF0EF] text-[#D03839] text-[11px] font-semibold rounded">Rejected</span>}
                        {offer.status === 'countered' && <span className="inline-block px-2 py-0.5 bg-[#EBF3FC] text-[#4A90E2] text-[11px] font-semibold rounded">Counter Sent</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border border-[#E8E8E4] rounded px-3 py-2.5">
                          <p className="text-[11px] text-[#737370]">Closing</p>
                          <p className="text-[13px] font-semibold text-[#1A1816]">{offer.closing_timeline || '—'}</p>
                        </div>
                        <div className="border border-[#E8E8E4] rounded px-3 py-2.5">
                          <p className="text-[11px] text-[#737370]">Financing</p>
                          <p className="text-[13px] font-semibold text-[#1A1816]">{offer.financing_type || '—'}</p>
                        </div>
                        <div className="border border-[#E8E8E4] rounded px-3 py-2.5">
                          <p className="text-[11px] text-[#737370]">Inspection</p>
                          <p className="text-[13px] font-semibold text-[#1A1816]">{offer.inspection_period || 'Waived'}</p>
                        </div>
                        <div className="border border-[#E8E8E4] rounded px-3 py-2.5">
                          <p className="text-[11px] text-[#737370]">Submitted</p>
                          <p className="text-[13px] font-semibold text-[#1A1816]">
                            {offer.created_at ? new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'}
                          </p>
                        </div>
                      </div>
                      {offer.notes && (
                        <p className="mt-3 text-[12px] text-[#737370] italic">&quot;{offer.notes}&quot;</p>
                      )}
                    </>
                  )}
                </div>

                {/* BUYER CREDIBILITY */}
                <div className="px-5 py-4 border-b border-[#E8E8E4]">
                  <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-3">Buyer Credibility</p>
                  {buyerStatsLoading ? (
                    <div className="flex items-center justify-center h-12"><Loader2 className="w-4 h-4 animate-spin text-[#A8A8A4]" /></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border border-[#E8E8E4] rounded px-3 py-2.5 text-center">
                        <p className="text-[18px] font-bold text-[#4A90E2]">{buyerStats?.pastDeals ?? 0}</p>
                        <p className="text-[11px] text-[#737370] mt-0.5">Past Deals</p>
                      </div>
                      <div className="border border-[#E8E8E4] rounded px-3 py-2.5 text-center">
                        <p className="text-[18px] font-bold text-[#0F6E56]">{buyerStats ? `${buyerStats.successRate}%` : '0%'}</p>
                        <p className="text-[11px] text-[#737370] mt-0.5">Success Rate</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* RESPOND TO OFFER — always visible, disabled when no pending offer */}
                {!(offer && (offer.status === 'accepted' || offer.status === 'rejected' || offer.status === 'countered')) && (
                  <div className="px-5 py-4">
                    <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-3">Respond to Offer</p>
                    {!offer || offer.status !== 'pending' ? (
                      <p className="text-[12px] text-[#A8A8A4] mb-3">No offer received yet</p>
                    ) : null}
                    <button
                      onClick={() => offer && offer.status === 'pending' ? setShowAcceptModal(true) : undefined}
                      disabled={!offer || offer.status !== 'pending'}
                      className="w-full py-3 bg-[#D03839] text-white text-[14px] font-semibold rounded transition-colors duration-200 mb-2 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#E0493B]">
                      Accept Offer
                    </button>
                    <button
                      onClick={() => offer && offer.status === 'pending' ? (setShowCounterForm(true), setCounterAmount(String(Math.round(offer.offer_price || 0)))) : undefined}
                      disabled={!offer || offer.status !== 'pending'}
                      className="w-full py-3 border border-[#E8E8E4] text-[#1A1816] text-[14px] font-semibold rounded transition-colors duration-200 mb-2 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#FAFAF8]">
                      Counter Offer
                    </button>
                    <button
                      onClick={() => offer && offer.status === 'pending' ? setShowRejectModal(true) : undefined}
                      disabled={!offer || offer.status !== 'pending'}
                      className="w-full py-2.5 text-[#737370] text-[13px] font-medium transition-colors duration-200 text-center disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:text-[#D03839]">
                      Reject Offer
                    </button>
                  </div>
                )}

                {/* Post-action states */}
                {offer && offer.status === 'accepted' && (
                  <div className="px-5 py-4">
                    <div className="bg-[#E4F5EC] border border-[#A8DFBA] rounded px-4 py-3">
                      <p className="text-[13px] font-semibold text-[#0F6E56] mb-1">Next Steps</p>
                      <p className="text-[12px] text-[#0F6E56]">Coordinate with the buyer to proceed to contract signing.</p>
                    </div>
                  </div>
                )}
                {offer && offer.status === 'rejected' && (
                  <div className="px-5 py-4">
                    <div className="bg-[#FEF0EF] border border-[#F5C4C0] rounded px-4 py-3">
                      <p className="text-[13px] font-semibold text-[#D03839]">Offer rejected</p>
                      <p className="text-[12px] text-[#D03839] mt-1">You can still continue the conversation.</p>
                    </div>
                  </div>
                )}
                {offer && offer.status === 'countered' && (
                  <div className="px-5 py-4">
                    <div className="bg-[#EBF3FC] border border-[#B0CFF0] rounded px-4 py-3">
                      <p className="text-[13px] font-semibold text-[#4A90E2]">Counter offer sent</p>
                      <p className="text-[12px] text-[#4A90E2] mt-1">Waiting for buyer's response.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Mobile Property Panel */}
        {showMobilePropPanel && selectedConversation && (
          <div className="xl:hidden fixed inset-0 z-[90] flex justify-end" onClick={() => setShowMobilePropPanel(false)}>
            <div className="w-full max-w-sm bg-white h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-[#E8E8E4] flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-[16px] font-bold text-[#1A1816]">Property Details</h3>
                  <p className="text-[13px] text-[#737370] truncate max-w-[200px]">{selectedPropertyAddress || 'Conversation'}</p>
                </div>
                <button onClick={() => setShowMobilePropPanel(false)} className="p-2 rounded hover:bg-[#FAFAF8] transition-colors">
                  <X className="w-5 h-5 text-[#444441]" />
                </button>
              </div>
              <div className="px-5 py-4 border-b border-[#E8E8E4]">
                <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-3">Buyer Info</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getAvatarPair(buyerDisplayName).bg }}>
                    <span className="text-[13px] font-semibold" style={{ color: getAvatarPair(buyerDisplayName).text }}>{getInitials(buyerDisplayName)}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1A1816]">{buyerDisplayName}</p>
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#0F6E56]" />
                      <span className="text-[11px] text-[#0F6E56] font-medium">Verified buyer</span>
                    </div>
                  </div>
                </div>
                {selectedConversation.buyer_email && (
                  <div className="flex items-center gap-2 text-[13px] text-[#444441] mb-1.5">
                    <Mail className="w-4 h-4 text-[#737370]" />
                    <span className="truncate">{selectedConversation.buyer_email}</span>
                  </div>
                )}
                {selectedConversation.buyer_phone && (
                  <div className="flex items-center gap-2 text-[13px] text-[#444441]">
                    <Phone className="w-4 h-4 text-[#737370]" />
                    <span>{selectedConversation.buyer_phone}</span>
                  </div>
                )}
              </div>
              {offer && (
                <div className="px-5 py-4 border-b border-[#E8E8E4]">
                  <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-3">Offer Details</p>
                  <p className="text-[28px] font-bold text-[#1A1816] mb-1">{formatCurrency(offer.offer_price)}</p>
                  {offer.status === 'pending' && <span className="inline-block px-2 py-0.5 bg-[#FEF3E2] text-[#B5620A] text-[11px] font-semibold rounded">Negotiating</span>}
                  {offer.status === 'accepted' && <span className="inline-block px-2 py-0.5 bg-[#E4F5EC] text-[#0F6E56] text-[11px] font-semibold rounded">Accepted</span>}
                  {offer.status === 'rejected' && <span className="inline-block px-2 py-0.5 bg-[#FEF0EF] text-[#D03839] text-[11px] font-semibold rounded">Rejected</span>}
                  {offer.status === 'countered' && <span className="inline-block px-2 py-0.5 bg-[#EBF3FC] text-[#4A90E2] text-[11px] font-semibold rounded">Counter Sent</span>}
                </div>
              )}
              {selectedPropertyAddress && (
                <div className="px-5 py-4">
                  <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-2">Property</p>
                  <div className="flex items-start gap-2 text-[13px] text-[#444441]">
                    <MapPin className="w-4 h-4 text-[#737370] flex-shrink-0 mt-0.5" />
                    <span>{selectedPropertyAddress}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accept Offer Modal */}
        {showAcceptModal && offer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAcceptModal(false)}>
            <div className="bg-white rounded w-full max-w-[400px] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#E4F5EC] mx-auto mb-4">
                <Check className="w-6 h-6 text-[#0F6E56]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1A1816] text-center mb-2">Accept this offer?</h3>
              <p className="text-[14px] text-[#444441] text-center mb-4">
                You're about to accept {formatCurrency(offer.offer_price)} from {buyerDisplayName}. This action cannot be undone.
              </p>
              <div className="flex items-start gap-2 bg-[#FEF9EC] border border-[#F5D78E] rounded px-3 py-2.5 mb-5">
                <AlertCircle className="w-4 h-4 text-[#B5620A] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#B5620A]">Both parties will be notified and next steps will begin automatically</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAcceptModal(false)}
                  className="flex-1 py-3 border border-[#E8E8E4] text-[#444441] text-[14px] font-medium rounded hover:bg-[#FAFAF8] transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleOfferAction('accept')} disabled={offerActionLoading}
                  className="flex-1 py-3 bg-[#D03839] text-white text-[14px] font-semibold rounded hover:bg-[#E0493B] transition-colors disabled:opacity-50">
                  {offerActionLoading ? 'Accepting...' : 'Accept Offer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Offer Modal */}
        {showRejectModal && offer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowRejectModal(false)}>
            <div className="bg-white rounded w-full max-w-[400px] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-[18px] font-bold text-[#1A1816] text-center mb-2">Reject this offer?</h3>
              <p className="text-[14px] text-[#444441] text-center mb-4">
                This action will decline {buyerDisplayName}'s offer of {formatCurrency(offer.offer_price)}. You can still continue the conversation after rejecting.
              </p>
              <div className="flex items-start gap-2 bg-[#FEF9EC] border border-[#F5D78E] rounded px-3 py-2.5 mb-5">
                <AlertCircle className="w-4 h-4 text-[#B5620A] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#B5620A]">Both parties will be notified and next steps will begin automatically</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-3 border border-[#E8E8E4] text-[#444441] text-[14px] font-medium rounded hover:bg-[#FAFAF8] transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleOfferAction('reject')} disabled={offerActionLoading}
                  className="flex-1 py-3 bg-[#D03839] text-white text-[14px] font-semibold rounded hover:bg-[#E0493B] transition-colors disabled:opacity-50">
                  {offerActionLoading ? 'Rejecting...' : 'Reject Offer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu?.conv && (
        <div
          className="fixed z-[90] w-44 rounded border border-[#E8E8E4] bg-white shadow-lg p-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button className="w-full text-left text-[13px] px-3 py-2 rounded text-[#444441] hover:bg-[#FAFAF8] transition-colors duration-200" onClick={() => { updateConversationPref(contextMenu.conv.id, { is_pinned: !contextMenu.conv.is_pinned }); setContextMenu(null); }}>
            {contextMenu.conv.is_pinned ? 'Unpin' : 'Pin conversation'}
          </button>
          <button className="w-full text-left text-[13px] px-3 py-2 rounded text-[#444441] hover:bg-[#FAFAF8] transition-colors duration-200" onClick={() => { updateConversationPref(contextMenu.conv.id, { mark_unread: true }); setContextMenu(null); }}>
            Mark as unread
          </button>
          <div className="my-1 border-t border-[#E8E8E4]" />
          <button className="w-full text-left text-[13px] px-3 py-2 rounded text-[#D03839] hover:bg-[#FEF0EF] transition-colors duration-200" onClick={() => { deleteConversation(contextMenu.conv.id); setContextMenu(null); }}>
            Delete chat
          </button>
          <button className="w-full text-left text-[13px] px-3 py-2 rounded text-[#D03839] hover:bg-[#FEF0EF] transition-colors duration-200" onClick={() => { setBlockConfirm(contextMenu.conv); setContextMenu(null); }}>
            Block user
          </button>
        </div>
      )}

      {blockConfirm && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" >
          <div className="fixed inset-0 bg-[#1A1816]/40" onClick={() => setBlockConfirm(null)} aria-hidden="true" />
          <div className="relative bg-white rounded shadow-lg border border-[#E8E8E4] max-w-md w-full p-6 z-10">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded bg-[#FEF0EF] flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5 text-[#D03839]" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-semibold text-[#1A1816] mb-1">Block this buyer?</h3>
                <p className="text-[13px] text-[#737370]">
                  {blockConfirm.buyer_name || 'This buyer'} won't be able to message you anymore, and this conversation will be hidden. You can unblock them later from this conversation's menu.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBlockConfirm(null)}
                className="flex-1 h-10 px-4 text-[13px] font-semibold text-[#1A1816] bg-white border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={() => { updateConversationPref(blockConfirm.id, { is_blocked: true }); setBlockConfirm(null); }}
                className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-[#D03839] hover:bg-[#E0493B] rounded transition-colors"
              >Block buyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
