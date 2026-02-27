import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Single shared DB for sellers, buyers, admins. Use service role key so we can read users (e.g. buyer email); anon + RLS would block cross-user lookups.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseHost = supabaseUrl && supabaseUrl.startsWith('http') ? new URL(supabaseUrl).host : '(check NEXT_PUBLIC_SUPABASE_URL)';

const PRESENCE_TTL_MS = 60_000; // 60 seconds

/**
 * Seller chat API – buyers only (no lenders).
 * Uses conversations + messages tables. Expects conversations to have seller_id (uuid) and
 * optionally buyer_uuid (uuid) for seller-buyer threads. If your schema uses user_id (integer)
 * for buyer, add a migration for seller_id and buyer_uuid or adapt the filters.
 */

/** Check if recipient was recently active on messages tab (skip email if true) */
async function isRecipientActiveOnMessages(supabaseClient, recipientUserId, recipientType) {
  if (!recipientUserId) return false;
  try {
    const { data } = await supabaseClient
      .from('message_presence')
      .select('last_seen')
      .eq('user_id', recipientUserId)
      .eq('user_type', recipientType)
      .maybeSingle();
    if (!data?.last_seen) return false;
    const lastSeen = new Date(data.last_seen).getTime();
    return (Date.now() - lastSeen) < PRESENCE_TTL_MS;
  } catch {
    return false;
  }
}

/** Send email to buyer when seller sends a message (only if buyer not active on messages) */
async function sendEmailToBuyer(buyerEmail, buyerName, sellerName, messageText, conversationId) {
  if (!buyerEmail) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Seller chat] RESEND_API_KEY not set in seller dashboard env; cannot send email to buyer');
    return;
  }
  try {
    const resend = new Resend(apiKey);
    const buyerBase = (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || '').replace(/\/$/, '') || 'https://deelmap-production-16a1.up.railway.app';
    const messagesLink = `${buyerBase}/buyer/inbox`;
    const preview = (messageText || '').slice(0, 200);
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#002A3A;color:#fff;padding:24px;text-align:center">
      <h1 style="margin:0;font-size:20px;font-weight:600">New message on Deelmap</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 8px;font-size:14px;color:#666">From <strong style="color:#002A3A">${(sellerName || 'Property seller').replace(/</g, '&lt;')}</strong></p>
      <div style="background:#f8f9fa;border-left:4px solid #002A3A;padding:16px;border-radius:4px;margin:16px 0;font-size:15px;line-height:1.5;color:#333">${(preview || '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div>
      <a href="${messagesLink}" style="display:inline-block;background:#002A3A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Messages</a>
    </div>
    <div style="padding:16px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee">You received this because you have an active conversation on Deelmap.</div>
  </div>
</body>
</html>`;
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Deelmap <notifications@deelmap.com>',
      to: buyerEmail,
      subject: `New message from ${(sellerName || 'Property seller').slice(0, 50)} - Deelmap`,
      html
    });
    console.log('[Seller chat] Email sent to buyer:', buyerEmail);
  } catch (error) {
    console.error('[Seller chat] Failed to send email to buyer:', error?.message || error);
    throw error;
  }
}

function getSellerId(request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

async function getSellerConversationPref(conversationId, sellerId) {
  const { data } = await supabase
    .from('chat_user_preferences')
    .select('is_done, is_pinned, is_blocked, mark_unread, last_outbound_at')
    .eq('conversation_id', conversationId)
    .eq('actor_type', 'seller')
    .eq('actor_id', sellerId)
    .maybeSingle();
  return data || null;
}

async function upsertSellerConversationPref(conversationId, sellerId, patch = {}) {
  return supabase.from('chat_user_preferences').upsert(
    {
      conversation_id: conversationId,
      actor_type: 'seller',
      actor_id: sellerId,
      ...patch,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'conversation_id,actor_type,actor_id' }
  );
}

export async function GET(request) {
  try {
    if (!supabaseKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY in env (required for chat)' },
        { status: 503 }
      );
    }
    const sellerId = getSellerId(request);
    if (!sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const conversationId = searchParams.get('conversation_id');
    const buyerId = searchParams.get('buyer_id');

    if (action === 'get_messages' && conversationId) {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_type, sender_id, message_text, has_attachment, attachment_url, attachment_name, is_read, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('messages fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
      }

      return NextResponse.json({ success: true, messages: messages || [] });
    }

    if (action === 'get_blocked_users') {
      const { data: prefs, error: prefErr } = await supabase
        .from('chat_user_preferences')
        .select('conversation_id, updated_at')
        .eq('actor_type', 'seller')
        .eq('actor_id', sellerId)
        .eq('is_blocked', true)
        .order('updated_at', { ascending: false });

      if (prefErr) {
        return NextResponse.json({ success: true, blocked: [] });
      }

      const conversationIds = (prefs || []).map((p) => p.conversation_id);
      if (conversationIds.length === 0) return NextResponse.json({ success: true, blocked: [] });

      const { data: convs } = await supabase
        .from('conversations')
        .select('id, buyer_uuid, last_message_at')
        .eq('seller_id', sellerId)
        .in('id', conversationIds);

      const blocked = await Promise.all(
        (convs || []).map(async (c) => {
          let buyer_name = 'Buyer';
          if (c.buyer_uuid) {
            const { data: u } = await supabase
              .from('users')
              .select('first_name, last_name')
              .eq('id', c.buyer_uuid)
              .maybeSingle();
            const full = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
            if (full) buyer_name = full;
          }
          return {
            conversation_id: c.id,
            buyer_uuid: c.buyer_uuid,
            buyer_name,
            blocked_at: (prefs || []).find((p) => p.conversation_id === c.id)?.updated_at || null,
            last_message_at: c.last_message_at || null
          };
        })
      );
      return NextResponse.json({ success: true, blocked });
    }

    if (action === 'get_conversations' || !action) {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, user_id, last_message_at, last_message_preview, is_active, created_at, buyer_uuid')
        .eq('seller_id', sellerId)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('conversations fetch error:', error);
        return NextResponse.json({ success: true, conversations: [] });
      }

      const list = conversations || [];
      const enriched = await Promise.all(
        list.map(async (c) => {
          let buyer_name = 'Buyer';
          if (c.buyer_uuid) {
            const { data: u } = await supabase
              .from('users')
              .select('first_name, last_name')
              .eq('id', c.buyer_uuid)
              .maybeSingle();
            if (u) {
              const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
              if (full) buyer_name = full;
            }
          }
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .eq('sender_type', 'user')
            .eq('is_read', false);
          const pref = await getSellerConversationPref(c.id, sellerId);
          const { data: latest } = await supabase
            .from('messages')
            .select('sender_type')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const unread_count = count ?? 0;
          const mark_unread = !!pref?.mark_unread;
          const is_blocked = !!pref?.is_blocked;
          return {
            ...c,
            buyer_name,
            unread_count,
            is_done: !!pref?.is_done,
            is_pinned: !!pref?.is_pinned,
            is_blocked,
            mark_unread,
            has_unread: mark_unread || unread_count > 0,
            is_unresponded: (latest?.sender_type || '') === 'user'
          };
        })
      );

      if (buyerId) {
        const withBuyer = enriched.find((c) => c.buyer_uuid === buyerId);
        if (withBuyer) {
          return NextResponse.json({ success: true, conversations: enriched, openConversationId: withBuyer.id });
        }
      }

      return NextResponse.json({ success: true, conversations: enriched.filter((c) => !c.is_blocked) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Seller chat GET error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!supabaseKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY in env (required for chat)' },
        { status: 503 }
      );
    }
    const sellerId = getSellerId(request);
    if (!sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, conversationId, messageText, buyerId } = body;

    // Heartbeat: mark seller as active on messages tab
    if (action === 'heartbeat') {
      try {
        await supabase.from('message_presence').upsert(
          { user_id: sellerId, user_type: 'seller', last_seen: new Date().toISOString() },
          { onConflict: 'user_id,user_type' }
        );
      } catch (e) {
        // table may not exist yet
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'mark_as_read' && conversationId) {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .in('sender_type', ['user']);

      if (error) {
        console.error('mark_as_read error:', error);
      }
      await upsertSellerConversationPref(conversationId, sellerId, { mark_unread: false });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_conversation_pref' && conversationId) {
      const allowedKeys = ['is_done', 'is_pinned', 'is_blocked', 'mark_unread'];
      const patch = {};
      for (const key of allowedKeys) {
        if (typeof body[key] === 'boolean') patch[key] = body[key];
      }
      const { error } = await upsertSellerConversationPref(conversationId, sellerId, patch);
      if (error) return NextResponse.json({ success: false, error: error.message || 'Failed to update preference' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'send_message' && conversationId && messageText != null) {
      const pref = await getSellerConversationPref(conversationId, sellerId);
      if (pref?.is_blocked) {
        return NextResponse.json({ success: false, error: 'This conversation is blocked. Unblock user first.' }, { status: 403 });
      }

      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id, buyer_uuid')
        .eq('id', conversationId)
        .eq('seller_id', sellerId)
        .single();

      if (convError) {
        console.warn('[Seller chat] Conversation fetch for email:', convError.message, { conversationId, sellerId });
      }

      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_type: 'seller',
          sender_id: sellerId,
          message_text: String(messageText).trim(),
          has_attachment: false,
          is_read: false
        })
        .select('id, conversation_id, sender_type, message_text, created_at')
        .single();

      if (error) {
        console.error('send_message error:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
      }

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: String(messageText).trim().slice(0, 200),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      await upsertSellerConversationPref(conversationId, sellerId, {
        last_outbound_at: new Date().toISOString(),
        mark_unread: false
      });

      // Email buyer only if not active on messages tab
      let emailNotification = { status: 'skipped', reason: 'no_buyer_uuid' };
      const buyerUuid = conv?.buyer_uuid;
      if (!buyerUuid) {
        console.warn('[Seller chat] Email skipped: conversation has no buyer_uuid', { conversationId, sellerId });
      }
      if (buyerUuid) {
        const active = await isRecipientActiveOnMessages(supabase, buyerUuid, 'buyer');
        if (active) {
          emailNotification = { status: 'skipped', reason: 'buyer_active_on_messages' };
          console.log('[Seller chat] Email skipped: buyer is active on messages tab (last_seen within 60s)');
        }
        if (!active) {
          const usersResult = await supabase
            .from('users')
            .select('email, first_name, last_name')
            .eq('id', buyerUuid)
            .maybeSingle();
          if (usersResult.error) {
            console.warn('[Seller chat] public.users lookup error:', usersResult.error.message, { code: usersResult.error.code, buyerUuid });
          } else if (!usersResult.data) {
            console.warn('[Seller chat] public.users: no row for id=', buyerUuid, '| Supabase host:', supabaseHost, '| Use SUPABASE_SERVICE_ROLE_KEY (not anon) and same project as Dashboard.');
          } else if (!usersResult.data.email) {
            console.warn('[Seller chat] public.users: row found but email is null/empty for id=', buyerUuid);
          }
          let buyer = usersResult.data;
          if (!buyer?.email) {
            try {
              const { data } = await supabase.auth.admin.getUserById(buyerUuid);
              if (data?.user?.email) {
                buyer = { email: data.user.email, first_name: data.user.user_metadata?.first_name, last_name: data.user.user_metadata?.last_name };
              }
            } catch (_) {
              // auth.admin requires service role; skip if unavailable or error
            }
          }
          let sellerName = 'Property seller';
          const { data: sellerApp } = await supabase
            .from('seller_applications')
            .select('contact_person_name, business_name')
            .eq('id', sellerId)
            .maybeSingle();
          if (sellerApp) {
            sellerName = (sellerApp.contact_person_name || '').trim() || (sellerApp.business_name || '').trim() || sellerName;
          }
          if (sellerName === 'Property seller') {
            const { data: sellerUser } = await supabase
              .from('users')
              .select('first_name, last_name')
              .eq('id', sellerId)
              .maybeSingle();
            sellerName = [sellerUser?.first_name, sellerUser?.last_name].filter(Boolean).join(' ').trim() || sellerName;
          }
          if (!buyer?.email) {
            emailNotification = { status: 'skipped', reason: 'no_buyer_email' };
            console.warn('[Seller chat] Email skipped: no buyer email found for', buyerUuid, '(checked public.users and auth.users)');
          } else if (!process.env.RESEND_API_KEY) {
            emailNotification = { status: 'skipped', reason: 'resend_api_key_not_set' };
          } else {
            try {
              await sendEmailToBuyer(
                buyer.email,
                [buyer.first_name, buyer.last_name].filter(Boolean).join(' ').trim() || 'Buyer',
                sellerName,
                messageText,
                conversationId
              );
              emailNotification = { status: 'sent', to: buyer.email };
              console.log('[Seller chat] Email sent to buyer:', buyer.email);
            } catch (e) {
              emailNotification = { status: 'failed', reason: e?.message || String(e) };
              console.error('Seller email to buyer failed:', e);
            }
          }
        }
      }

      return NextResponse.json({ success: true, message: msg, emailNotification });
    }

    if (action === 'create_conversation' && buyerId) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('seller_id', sellerId)
        .eq('buyer_uuid', buyerId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, conversationId: existing.id });
      }

      const insert = {
        seller_id: sellerId,
        buyer_uuid: buyerId,
        user_id: null,
        last_message_at: new Date().toISOString(),
        last_message_preview: null,
        is_active: true,
        updated_at: new Date().toISOString()
      };
      const { data: created, error } = await supabase
        .from('conversations')
        .insert(insert)
        .select('id')
        .single();

      if (error) {
        console.error('create_conversation error:', error);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }

      return NextResponse.json({ success: true, conversationId: created.id });
    }

    return NextResponse.json({ error: 'Invalid action or missing params' }, { status: 400 });
  } catch (err) {
    console.error('Seller chat POST error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
