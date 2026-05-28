// In-memory store for pending email-change verifications.
// Mirrors lib/password-reset-store.js. OTP is sent to the NEW email to prove
// ownership; the change only completes once it's verified.
let store = null;

function ensureStore() {
  if (store) return store;
  if (typeof global !== 'undefined') {
    if (!global.__sellerEmailChangeStore) global.__sellerEmailChangeStore = new Map();
    store = global.__sellerEmailChangeStore;
    return store;
  }
  store = new Map();
  return store;
}

// Keyed by seller id. Holds the new email + OTP + expiry.
export function setEmailChange(sellerId, newEmail, otp, ttlMs = 15 * 60 * 1000) {
  ensureStore().set(String(sellerId), {
    newEmail: String(newEmail).toLowerCase().trim(),
    otp: String(otp),
    expires: Date.now() + ttlMs,
  });
}

export function getEmailChange(sellerId) {
  const row = ensureStore().get(String(sellerId));
  if (!row) return null;
  if (row.expires < Date.now()) { ensureStore().delete(String(sellerId)); return null; }
  return row;
}

export function clearEmailChange(sellerId) {
  ensureStore().delete(String(sellerId));
}
