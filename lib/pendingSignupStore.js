// In-memory store for pending seller signups awaiting OTP verification.
//
// Nothing about a signup is written to the database until the OTP is verified.
// register-seller validates the input and stashes it here (password already
// hashed); verify-otp reads it back and creates the seller_applications row.
//
// Keyed by lowercased email. Same per-instance lifetime semantics as the OTP
// store (global.sellerOtpStore): if the server instance restarts within the
// verification window, the pending signup is lost and the user restarts step 1.
// TTL is 15 minutes — comfortably longer than the 10-minute OTP validity.

const TTL_MS = 15 * 60 * 1000

function store() {
  if (typeof global !== 'undefined') {
    if (!global.sellerPendingSignups) global.sellerPendingSignups = new Map()
    return global.sellerPendingSignups
  }
  return new Map()
}

export function setPendingSignup(email, data) {
  store().set(email, { data, expires: Date.now() + TTL_MS })
}

export function getPendingSignup(email) {
  const rec = store().get(email)
  if (!rec) return null
  if (rec.expires < Date.now()) {
    store().delete(email)
    return null
  }
  return rec.data
}

export function deletePendingSignup(email) {
  store().delete(email)
}
