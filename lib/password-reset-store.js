let resetStore = null;

function ensureStore() {
  if (resetStore) return resetStore;
  if (typeof global !== 'undefined') {
    if (!global.__sellerPasswordResetStore) {
      global.__sellerPasswordResetStore = new Map();
    }
    resetStore = global.__sellerPasswordResetStore;
    return resetStore;
  }
  resetStore = new Map();
  return resetStore;
}

export function setResetOtp(email, otp, ttlMs = 15 * 60 * 1000) {
  const store = ensureStore();
  store.set(String(email).toLowerCase().trim(), {
    otp: String(otp),
    expires: Date.now() + ttlMs,
    verified: false
  });
}

export function getResetOtp(email) {
  const store = ensureStore();
  return store.get(String(email).toLowerCase().trim()) || null;
}

export function markResetOtpVerified(email) {
  const store = ensureStore();
  const key = String(email).toLowerCase().trim();
  const row = store.get(key);
  if (!row) return false;
  store.set(key, { ...row, verified: true });
  return true;
}

export function clearResetOtp(email) {
  const store = ensureStore();
  store.delete(String(email).toLowerCase().trim());
}

export function cleanupExpiredResetOtps() {
  const store = ensureStore();
  const now = Date.now();
  for (const [key, row] of store.entries()) {
    if (!row || !row.expires || row.expires < now) {
      store.delete(key);
    }
  }
}

if (typeof global !== 'undefined' && !global.__sellerPasswordResetCleanupInterval) {
  global.__sellerPasswordResetCleanupInterval = setInterval(cleanupExpiredResetOtps, 5 * 60 * 1000);
}
