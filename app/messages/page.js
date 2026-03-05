'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageCircle, Send, Search, ArrowLeft, Loader2, Check, CheckCheck, Pin } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const API = '/api/seller/chat';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
const AVATAR_COLORS = ['#0F766E', '#2563EB', '#7C3AED', '#C2410C', '#BE185D', '#0369A1', '#047857', '#4F46E5'];

function getAvatarColor(seed = '') {
  const str = String(seed || 'buyer');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  } catch {
    return {};
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const buyerIdFromUrl = searchParams.get('buyer_id');
  const addressFromUrl = searchParams.get('address') || '';
  const propertyIdFromUrl = searchParams.get('property_id') || '';

  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [openConversationId, setOpenConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextAddress, setContextAddress] = useState('');
  const [contextConversationId, setContextConversationId] = useState(null);
  const [chatTab, setChatTab] = useState('all'); // all | unread | unresponded
  const [contextMenu, setContextMenu] = useState(null); // { x, y, conv }
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Heartbeat for message presence: only when tab is visible, so we skip email if seller is on messages
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    let intervalId = null;
    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        fetch(API, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat' })
        }).catch(() => {});
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        intervalId = setInterval(sendHeartbeat, 25000);
      } else {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      }
    };
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
      intervalId = setInterval(sendHeartbeat, 25000);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      setError('Please log in.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const url = buyerIdFromUrl
      ? `${API}?action=get_conversations&buyer_id=${encodeURIComponent(buyerIdFromUrl)}${propertyIdFromUrl ? `&property_id=${encodeURIComponent(propertyIdFromUrl)}` : ''}`
      : `${API}?action=get_conversations`;
    fetch(url, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = data.conversations || [];
        setConversations(list);
        setFilteredConversations(list);
        if (data.openConversationId) {
          setOpenConversationId(data.openConversationId);
          if (addressFromUrl) {
            setContextAddress(addressFromUrl);
            setContextConversationId(data.openConversationId);
          }
          return;
        }
        if (buyerIdFromUrl) {
          const existing = list.find((c) => {
            const buyerMatch = c.buyer_uuid && String(c.buyer_uuid) === String(buyerIdFromUrl);
            if (!buyerMatch) return false;
            if (!propertyIdFromUrl) return true;
            return String(c.property_id || '') === String(propertyIdFromUrl);
          });
          if (existing) {
            setOpenConversationId(existing.id);
            if (addressFromUrl) {
              setContextAddress(addressFromUrl);
              setContextConversationId(existing.id);
            }
            return;
          }
          createConversation(buyerIdFromUrl, headers).then((id) => {
            if (id) {
              setOpenConversationId(id);
              if (addressFromUrl) {
                setContextAddress(addressFromUrl);
                setContextConversationId(id);
              }
              const newConv = { id, buyer_uuid: buyerIdFromUrl, buyer_name: 'Buyer', last_message_preview: null, last_message_at: new Date().toISOString(), is_active: true };
              setConversations((prev) => [newConv, ...prev]);
              setFilteredConversations((prev) => [newConv, ...prev]);
            }
            fetchConversations(headers);
          });
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load conversations'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buyerIdFromUrl, propertyIdFromUrl, addressFromUrl]);

  function fetchConversations(headers) {
    const h = headers || getAuthHeaders();
    if (!h?.Authorization) return;
    const url = buyerIdFromUrl
      ? `${API}?action=get_conversations&buyer_id=${encodeURIComponent(buyerIdFromUrl)}${propertyIdFromUrl ? `&property_id=${encodeURIComponent(propertyIdFromUrl)}` : ''}`
      : `${API}?action=get_conversations`;
    fetch(url, { headers: h })
      .then((res) => res.json())
      .then((data) => {
        const list = data.conversations || [];
        setConversations(list);
        setFilteredConversations(list);
        // If current open chat got blocked/removed, close it.
        if (openConversationId != null && !list.some((c) => c.id === openConversationId)) {
          setOpenConversationId(null);
        }
      })
      .catch(() => {});
  }

  // Refetch conversations periodically so unread counts update when new messages arrive in other chats
  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    const interval = setInterval(() => fetchConversations(headers), 10000);
    return () => clearInterval(interval);
  }, [buyerIdFromUrl, propertyIdFromUrl]);

  async function createConversation(buyerId, headers) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        action: 'create_conversation',
        buyerId,
        propertyId: propertyIdFromUrl || null,
        propertyAddress: addressFromUrl || null
      })
    });
    const data = await res.json().catch(() => ({}));
    return data.conversationId || null;
  }

  useEffect(() => {
    if (!openConversationId) {
      setMessages([]);
      return;
    }
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    fetch(`${API}?action=get_messages&conversation_id=${openConversationId}`, { headers })
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []))
      .catch(() => setMessages([]));
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ action: 'mark_as_read', conversationId: openConversationId })
    }).catch(() => {});
    // Clear unread count for this conversation in local state
    setConversations((prev) => prev.map((c) => (c.id === openConversationId ? { ...c, unread_count: 0 } : c)));
    setFilteredConversations((prev) => prev.map((c) => (c.id === openConversationId ? { ...c, unread_count: 0 } : c)));
  }, [openConversationId]);

  // Realtime: new messages + read receipt updates (so double ticks update when buyer reads)
  useEffect(() => {
    if (!openConversationId) return () => {};
    const supabase = getSupabase();
    if (!supabase) return () => {};
    const channel = supabase
      .channel(`seller-conversation-${openConversationId}`, { config: { broadcast: { self: true } } })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${openConversationId}`
        },
        (payload) => {
          const updated = payload.new;
          if (updated?.id != null && updated.is_read) {
            setMessages((prev) =>
              prev.map((msg) => (String(msg.id) === String(updated.id) ? { ...msg, is_read: true } : msg))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${openConversationId}`
        },
        (payload) => {
          const newMsg = payload.new;
          if (!newMsg || newMsg.id == null) return;
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(newMsg.id))) return prev;
            return [...prev, newMsg];
          });
          // Seller is viewing this chat: mark as read and clear unread badge
          const headers = getAuthHeaders();
          if (headers.Authorization) {
            fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({ action: 'mark_as_read', conversationId: openConversationId })
            }).catch(() => {});
          }
          setConversations((prev) =>
            prev.map((c) =>
              c.id === openConversationId
                ? {
                    ...c,
                    unread_count: 0,
                    last_message_preview: (newMsg.message_text || '').slice(0, 200),
                    last_message_at: newMsg.created_at || c.last_message_at
                  }
                : c
            )
          );
          setFilteredConversations((prev) =>
            prev.map((c) =>
              c.id === openConversationId
                ? {
                    ...c,
                    unread_count: 0,
                    last_message_preview: (newMsg.message_text || '').slice(0, 200),
                    last_message_at: newMsg.created_at || c.last_message_at
                  }
                : c
            )
          );
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [openConversationId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredConversations(
      conversations.filter((c) => (c.buyer_name || '').toLowerCase().includes(q) || (c.last_message_preview || '').toLowerCase().includes(q))
    );
  }, [searchQuery, conversations]);

  useEffect(() => {
    const close = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const displayedConversations = (filteredConversations || [])
    .filter((c) => {
      if (chatTab === 'all') return true;
      if (chatTab === 'unread') return !!c.has_unread || (c.unread_count ?? 0) > 0;
      if (chatTab === 'unresponded') return !!c.is_unresponded;
      return true;
    })
    .sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    });

  const updateConversationPref = async (conversationId, patch) => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ action: 'update_conversation_pref', conversationId, ...patch })
    }).catch(() => {});
    fetchConversations(headers);
  };

  const sendMessage = () => {
    const text = messageText.trim();
    if (!text || !openConversationId || sending) return;
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    setSending(true);
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        action: 'send_message',
        conversationId: openConversationId,
        messageText: text
      })
    })
      .then((res) => res.json())
      .then((data) => {
        // Log email notification status so you can see in browser console if mail was sent/skipped
        if (data.emailNotification) {
          const en = data.emailNotification;
          if (en.status === 'sent') {
            console.log('[Messages] Email notification: sent to', en.to);
          } else if (en.status === 'failed') {
            console.warn('[Messages] Email notification: failed:', en.reason);
          } else {
            console.log('[Messages] Email notification: skipped —', en.reason || 'unknown');
          }
        }
        if (data.message) {
          const msg = data.message;
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
            return [...prev, msg];
          });
          setMessageText('');
          // Update conversation list so left panel shows new last message and time
          const preview = (msg.message_text || text).slice(0, 200);
          const at = msg.created_at || new Date().toISOString();
          setConversations((prev) => {
            const updated = prev.map((c) =>
              c.id === openConversationId ? { ...c, last_message_preview: preview, last_message_at: at } : c
            );
            // Move this conversation to top
            const idx = updated.findIndex((c) => c.id === openConversationId);
            if (idx > 0) {
              const [conv] = updated.splice(idx, 1);
              return [conv, ...updated];
            }
            return updated;
          });
          setFilteredConversations((prev) => {
            const updated = prev.map((c) =>
              c.id === openConversationId ? { ...c, last_message_preview: preview, last_message_at: at } : c
            );
            const idx = updated.findIndex((c) => c.id === openConversationId);
            if (idx > 0) {
              const [conv] = updated.splice(idx, 1);
              return [conv, ...updated];
            }
            return updated;
          });
        }
      })
      .catch(() => {})
      .finally(() => setSending(false));
  };

  const selectedConversation = conversations.find((c) => c.id === openConversationId);
  const buyerDisplayName = capitalizeFirst(selectedConversation?.buyer_name || 'Buyer');
  const selectedPropertyAddress = selectedConversation?.property_address || null;
  const headerTitle = selectedPropertyAddress
    ? `${buyerDisplayName} - ${selectedPropertyAddress}`
    : buyerDisplayName;
  const buyerInitial = (buyerDisplayName.charAt(0) || 'B').toUpperCase();

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 overflow-hidden bg-slate-50 -m-4 lg:-m-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 mb-3 shrink-0">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex-1 flex min-h-0 border border-slate-200 bg-white overflow-hidden">
        {/* Left panel - conversation list: only this list scrolls (sticky header + scrollable list) */}
        <div className={`${openConversationId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[380px] border-r border-slate-200 bg-white shrink-0 min-h-0 overflow-hidden`}>
          <div className="flex-shrink-0 p-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all"
              />
            </div>
            <div className="mt-2 grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChatTab('all')}
                className={`w-full px-2.5 py-1 rounded-md ${chatTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setChatTab('unread')}
                className={`w-full px-2.5 py-1 rounded-md ${chatTab === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Unread
              </button>
              <button
                type="button"
                onClick={() => setChatTab('unresponded')}
                className={`w-full px-2.5 py-1 rounded-md ${chatTab === 'unresponded' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Unresponded
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900" />
              </div>
            ) : displayedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 p-8">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
                {!searchQuery && <p className="text-xs text-slate-600 text-center">Start a conversation from a property&apos;s analytics.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {displayedConversations.map((c) => {
                  const unread = !!c.has_unread || (c.unread_count ?? 0) > 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setOpenConversationId(c.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, conv: c });
                      }}
                      className={`p-3 cursor-pointer transition-all duration-200 rounded-xl ${
                        openConversationId === c.id ? 'bg-[#002A3A]/10 border border-[#002A3A]/20' : 'bg-white border border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <div
                            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm"
                            style={{ backgroundColor: getAvatarColor(c.buyer_name || c.buyer_uuid || c.id) }}
                          >
                            {c.property_thumbnail_url ? (
                              <img
                                src={c.property_thumbnail_url}
                                alt="Property"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (c.buyer_name || 'B').charAt(0).toUpperCase()
                            )}
                          </div>
                          {unread && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-brandRed border-2 border-white rounded-full" aria-hidden />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h3 className={`truncate text-sm ${unread ? 'font-bold text-slate-900' : 'font-medium text-slate-900'}`}>
                                {capitalizeFirst(c.buyer_name || 'Buyer')}
                              </h3>
                              {c.is_pinned && (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700" title="Pinned">
                                  <Pin className="w-3 h-3" />
                                </span>
                              )}
                              {unread && (
                                <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-[#002A3A] rounded-full">
                                  {(c.unread_count ?? 0) > 9 ? '9+' : (c.unread_count ?? 0)}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-600 shrink-0">{formatDate(c.last_message_at)}</span>
                          </div>
                          <p className={`text-xs truncate ${unread ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
                            {c.last_message_preview || 'No messages yet'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - chat: header fixed, only messages area scrolls */}
        <div className={`${openConversationId ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-white min-w-0 min-h-0`}>
          {!openConversationId ? (
            <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-0">
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                  <MessageCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">Select a conversation</h3>
                <p className="text-sm text-slate-600">Choose a conversation from the list or start one from property analytics.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header - sticky, stays visible when scrolling chat */}
              <div className="flex-shrink-0 px-5 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenConversationId(null)}
                    className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{ backgroundColor: getAvatarColor(selectedConversation?.buyer_name || selectedConversation?.buyer_uuid || selectedConversation?.id) }}
                    >
                      {selectedConversation?.property_thumbnail_url ? (
                        <img
                          src={selectedConversation.property_thumbnail_url}
                          alt="Property"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        buyerInitial
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-slate-900 text-sm truncate">{headerTitle}</h2>
                      {!selectedPropertyAddress && contextAddress && openConversationId === contextConversationId && (
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">Re: {contextAddress}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages - only this area scrolls; header and input stay fixed */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4 bg-slate-50">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-200">
                        <Send className="w-7 h-7 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-700">No messages yet</p>
                      <p className="text-xs text-slate-600 mt-1">Start the conversation</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m) => {
                      const isSeller = m.sender_type === 'seller';
                      return (
                        <div key={m.id} className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}>
                          <div className="flex flex-col max-w-[70%]">
                            <div
                              className={`rounded-2xl px-4 py-3 ${
                                isSeller
                                  ? 'bg-[#002A3A] text-white rounded-br-sm'
                                  : 'bg-white text-slate-900 rounded-bl-sm shadow-sm border border-slate-200'
                              }`}
                            >
                              {m.message_text && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.message_text}</p>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 mt-1.5 px-1 ${isSeller ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[11px] text-slate-400">{formatTime(m.created_at)}</span>
                              {isSeller && (
                                m.is_read ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                )}
              </div>

              {/* Input - fixed at bottom */}
              <div className="flex-shrink-0 px-5 py-4 border-t border-slate-200 bg-white">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message..."
                    disabled={sending}
                    rows={1}
                    className="flex-1 resize-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed max-h-32 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 rounded-xl transition-colors disabled:cursor-not-allowed shrink-0"
                  >
                    {sending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
      {contextMenu?.conv && (
        <div
          className="fixed z-[90] w-44 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-[0_12px_32px_rgba(15,23,42,0.18)] p-1.5"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actions</div>
          <button className="w-full text-left text-sm px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors" onClick={() => { updateConversationPref(contextMenu.conv.id, { is_pinned: !contextMenu.conv.is_pinned }); setContextMenu(null); }}>
            {contextMenu.conv.is_pinned ? 'Unpin user' : 'Pin user'}
          </button>
          <button className="w-full text-left text-sm px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors" onClick={() => { updateConversationPref(contextMenu.conv.id, { mark_unread: true }); setContextMenu(null); }}>
            Mark as unread
          </button>
          <div className="my-1 border-t border-slate-200" />
          <button className="w-full text-left text-sm px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors" onClick={() => { updateConversationPref(contextMenu.conv.id, { is_blocked: true }); setContextMenu(null); }}>
            Block user
          </button>
        </div>
      )}
    </div>
  );
}
