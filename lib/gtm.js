// Google Tag Manager dataLayer push (client-only).
export function pushEvent(event, props = {}) {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...props })
  } catch { /* never break the UI for analytics */ }
}
