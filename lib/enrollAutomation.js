// Best-effort bridge into the admin dashboard's dynamic follow-up engine.
// Fires POST {ADMIN_AUTOMATIONS_URL}/api/automations/enroll so the engine enrolls
// the seller into any active flow whose trigger matches `event` (#4 pro-usage on
// listing_went_live, #5 cancellation on subscription_canceled).
//
// No-op unless ADMIN_AUTOMATIONS_URL is set — safe to deploy ahead of the automation
// cutover, and never throws into the caller.
export async function enrollAutomation(event, recipient_id, context = {}) {
  const base = (process.env.ADMIN_AUTOMATIONS_URL || '').replace(/\/+$/, '')
  if (!base || !recipient_id) return
  try {
    await fetch(`${base}/api/automations/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({ event, recipient_id, recipient_type: 'seller', context }),
    })
  } catch (e) {
    console.error('[enrollAutomation]', event, e?.message || e)
  }
}
