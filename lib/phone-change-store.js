// In-memory store for pending phone-change verifications. Mirrors
// lib/email-change-store.js. OTP is sent by SMS to the NEW phone.
let store = null;
function ensureStore() {
  if (store) return store;
  if (typeof global !== 'undefined') {
    if (!global.__sellerPhoneChangeStore) global.__sellerPhoneChangeStore = new Map();
    store = global.__sellerPhoneChangeStore; return store;
  }
  store = new Map(); return store;
}
export function setPhoneChange(sellerId, newPhone, otp, ttlMs = 15 * 60 * 1000) {
  ensureStore().set(String(sellerId), { newPhone: String(newPhone), otp: String(otp), expires: Date.now() + ttlMs });
}
export function getPhoneChange(sellerId) {
  const row = ensureStore().get(String(sellerId));
  if (!row) return null;
  if (row.expires < Date.now()) { ensureStore().delete(String(sellerId)); return null; }
  return row;
}
export function clearPhoneChange(sellerId) { ensureStore().delete(String(sellerId)); }
