// Shared currency formatting so prices look consistent across the portal.

// amount in DOLLARS.
//   cents: 'always' → always 2 decimals (receipts)
//   cents: 'smart'  → 2 decimals only when fractional ($299, but $758.40)
//   cents: 'never'  → whole dollars
export function formatUSD(amount, { cents = 'smart' } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0';
  const showCents = cents === 'always' || (cents === 'smart' && n % 1 !== 0);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })}`;
}

// amount in CENTS (Stripe).
export function formatCents(amountInCents, opts = {}) {
  return formatUSD(Number(amountInCents || 0) / 100, opts);
}
