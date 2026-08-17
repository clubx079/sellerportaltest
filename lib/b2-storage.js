// Backblaze B2 storage (S3-compatible), private bucket — SERVER-SIDE ONLY.
//
// Seller-portal listing photos are uploaded here (the same private "Deelmap" bucket
// the DeelScout scraper + buyer portal use) and SERVED by the DeelScout signing
// endpoint at IMG_PUBLIC_BASE (`<IMG_PUBLIC_BASE>/api/img/<key>`), which mints a
// short-lived presigned B2 GET and 302-redirects. So the URL stored in the DB is
// that /api/img URL.
//
// Never import this from client components — it holds the B2 secret. Upload/delete
// happen through the /api/seller/upload server route.
//
// Env:
//   B2_S3_ENDPOINT   e.g. https://s3.us-east-005.backblazeb2.com
//   B2_REGION        e.g. us-east-005
//   B2_BUCKET        e.g. Deelmap   (MUST match the DeelScout bucket so /api/img can serve it)
//   B2_KEY_ID        Backblaze application keyID
//   B2_APP_KEY       Backblaze applicationKey
//   IMG_PUBLIC_BASE  origin that hosts /api/img (e.g. https://cloudfare.apps.airosofts.com)
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.B2_REGION || 'us-east-005';
const ENDPOINT = process.env.B2_S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
export const B2_BUCKET = process.env.B2_BUCKET || 'Deelmap';
const KEY_ID = process.env.B2_KEY_ID;
const APP_KEY = process.env.B2_APP_KEY;
const IMG_BASE = (process.env.IMG_PUBLIC_BASE || '').replace(/\/$/, '');

let _client = null;
function client() {
  if (!KEY_ID || !APP_KEY) throw new Error('B2 credentials not configured (B2_KEY_ID / B2_APP_KEY)');
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      credentials: { accessKeyId: KEY_ID, secretAccessKey: APP_KEY },
      forcePathStyle: true, // path-style avoids virtual-host DNS/casing issues with the bucket name
    });
  }
  return _client;
}

// B2 upload + a reachable signing endpoint are both required to serve the image.
export function isB2Configured() {
  return Boolean(KEY_ID && APP_KEY && IMG_BASE);
}

// The stable URL stored in the DB — the DeelScout signing endpoint, NOT a direct B2 URL.
export function b2PublicUrl(key) {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return IMG_BASE ? `${IMG_BASE}/api/img/${encoded}` : `/api/img/${encoded}`;
}

// Upload a new object to the private bucket; returns the stable /api/img URL.
export async function uploadToB2(buffer, key, contentType = 'image/jpeg') {
  await client().send(new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return b2PublicUrl(key);
}

// Remove an object (used when a seller deletes a photo before publishing).
export async function deleteFromB2(key) {
  await client().send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key }));
}
