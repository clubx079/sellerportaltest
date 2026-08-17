// Server-side image/file upload for the seller portal → Backblaze B2.
//
// Replaces the old (broken) client-side Supabase-Storage upload. The browser POSTs
// the (already client-compressed) file here as multipart form-data; we push it to the
// private "Deelmap" B2 bucket and return the stable /api/img URL that the buyer portal
// and seller portal use to display it. B2 secret stays server-side only.
import { NextResponse } from 'next/server';
import { uploadToB2, deleteFromB2, b2PublicUrl, isB2Configured } from '@/lib/b2-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB (images arrive pre-compressed from the client)
const ALLOWED = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Keep only safe key characters so the /api/img signer resolves the object cleanly.
function sanitizeKey(key) {
  return String(key || '')
    .replace(/^\/+/, '')
    .split('/')
    .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .filter(Boolean)
    .join('/');
}

export async function POST(request) {
  try {
    if (!isB2Configured()) {
      return NextResponse.json({ success: false, error: 'Image storage is not configured (B2_KEY_ID / B2_APP_KEY / IMG_PUBLIC_BASE).' }, { status: 500 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const rawKey = form.get('key'); // optional caller-provided key (e.g. manual/<sellerId>/<ts>-<rand>.jpg)
    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File exceeds 15MB limit' }, { status: 400 });
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: `File type not allowed: ${file.type}` }, { status: 400 });
    }

    // Build the object key. Prefer the caller's key so the path stays predictable
    // (manual/<sellerId>/…), otherwise fall back to a unique one under manual/misc.
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fallback = `manual/misc/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const key = sanitizeKey(rawKey) || fallback;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToB2(buffer, key, file.type || 'image/jpeg');

    return NextResponse.json({ success: true, url, key, publicUrl: url });
  } catch (err) {
    console.error('[seller/upload] POST error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { key } = await request.json().catch(() => ({}));
    if (!key) return NextResponse.json({ success: false, error: 'key is required' }, { status: 400 });
    await deleteFromB2(sanitizeKey(key));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[seller/upload] DELETE error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Delete failed' }, { status: 500 });
  }
}

// Convenience: let callers resolve a public URL for an existing key without re-uploading.
export async function GET(request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return NextResponse.json({ success: false, error: 'key is required' }, { status: 400 });
  return NextResponse.json({ success: true, url: b2PublicUrl(sanitizeKey(key)) });
}
