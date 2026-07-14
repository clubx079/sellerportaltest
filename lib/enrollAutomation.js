// Best-effort bridge into the admin dashboard's dynamic follow-up engine.
// Returns the parsed engine response ({ ok, enrolled, sent }) on success, or null
// on any failure / when ADMIN_AUTOMATIONS_URL is unset — callers use null to fall
// back to a direct send. Never throws into the caller.
export async function enrollAutomation(event, recipient_id, context = {}, opts = {}) {
  const base = (process.env.ADMIN_AUTOMATIONS_URL || '').replace(/\/+$/, '')
  if (!base || !recipient_id) return null
  try {
    const res = await fetch(`${base}/api/automations/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({ event, recipient_id, recipient_type: 'seller', context, immediate: !!opts.immediate }),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch (e) {
    console.error('[enrollAutomation]', event, e?.message || e)
    return null
  }
}
