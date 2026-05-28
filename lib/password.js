import bcrypt from 'bcryptjs';

const BCRYPT_RE = /^\$2[aby]\$/;

export function isHashed(stored) {
  return typeof stored === 'string' && BCRYPT_RE.test(stored);
}

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}

// Verifies a plaintext password against a stored value. Handles BOTH bcrypt
// hashes and legacy plaintext (so logins keep working before/during migration).
export async function verifyPassword(plain, stored) {
  if (stored == null) return false;
  if (isHashed(stored)) return bcrypt.compare(String(plain), stored);
  return String(plain) === String(stored); // legacy plaintext
}
