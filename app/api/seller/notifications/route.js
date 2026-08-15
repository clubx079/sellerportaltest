import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSellerId(request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

// GET — fetch notifications for seller
export async function GET(request) {
  try {
    const sellerId = getSellerId(request);
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', sellerId)
      .eq('recipient_type', 'seller')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });

    const unreadCount = (notifications || []).filter(n => !n.is_read).length;
    return NextResponse.json({ notifications: notifications || [], unreadCount });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — mark_read / mark_all_read
export async function POST(request) {
  try {
    const sellerId = getSellerId(request);
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, notification_id } = body;

    if (action === 'mark_read' && notification_id) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification_id)
        .eq('recipient_id', sellerId);
      return NextResponse.json({ success: true });
    }

    if (action === 'mark_all_read') {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', sellerId)
        .eq('recipient_type', 'seller')
        .eq('is_read', false);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
