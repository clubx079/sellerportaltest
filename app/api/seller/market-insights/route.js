import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch from both tables in parallel
    const [{ data: wholesaleDeals }, { data: manualProperties }] = await Promise.all([
      supabase
        .from('wholesale_deals')
        .select('state, price, gross_yield, cap_rate, property_type, created_at')
        .eq('status', 'active')
        .eq('is_incomplete', false),
      supabase
        .from('properties')
        .select('state, price, property_type, created_at, status, admin_status')
        .eq('admin_status', 'active')
        .in('status', ['published', 'active']),
    ]);

    // Normalise to a common shape (properties has no gross_yield/cap_rate)
    const wholesaleNorm = (wholesaleDeals || []).map(d => ({
      state: d.state || null,
      price: d.price || null,
      gross_yield: d.gross_yield || null,
      cap_rate: d.cap_rate || null,
      property_type: d.property_type || null,
      created_at: d.created_at,
    }));

    const manualNorm = (manualProperties || []).map(d => ({
      state: d.state || null,
      price: d.price || null,
      gross_yield: null,
      cap_rate: null,
      property_type: d.property_type || null,
      created_at: d.created_at,
    }));

    const all = [...wholesaleNorm, ...manualNorm];
    const total = all.length;
    const prices = all.map(d => d.price).filter(Boolean);
    const yields = all.map(d => d.gross_yield).filter(Boolean);
    const capRates = all.map(d => d.cap_rate).filter(Boolean);
    const newDeals = all.filter(d => d.created_at > thirtyDaysAgo).length;

    // By state
    const byState = {};
    all.forEach(d => {
      if (!d.state) return;
      if (!byState[d.state]) byState[d.state] = { count: 0, prices: [], yields: [] };
      byState[d.state].count++;
      if (d.price) byState[d.state].prices.push(d.price);
      if (d.gross_yield) byState[d.state].yields.push(d.gross_yield);
    });
    const topStates = Object.entries(byState)
      .map(([state, v]) => ({
        state,
        count: v.count,
        avgPrice: Math.round(avg(v.prices)),
        avgYield: +avg(v.yields).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Price distribution
    const priceBuckets = [
      { label: 'Under $100K', min: 0, max: 100000 },
      { label: '$100K–$200K', min: 100000, max: 200000 },
      { label: '$200K–$300K', min: 200000, max: 300000 },
      { label: '$300K–$500K', min: 300000, max: 500000 },
      { label: '$500K+', min: 500000, max: Infinity },
    ];
    const priceDistribution = priceBuckets.map(b => ({
      label: b.label,
      count: prices.filter(p => p >= b.min && p < b.max).length,
    }));

    // Property types
    const byType = {};
    all.forEach(d => {
      const t = d.property_type || 'Other';
      byType[t] = (byType[t] || 0) + 1;
    });
    const propertyTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));

    return NextResponse.json({
      summary: {
        total,
        avgPrice: Math.round(avg(prices)),
        avgYield: +avg(yields).toFixed(1),
        avgCapRate: +avg(capRates).toFixed(1),
        newDeals,
      },
      topStates,
      priceDistribution,
      propertyTypes,
    });
  } catch (err) {
    console.error('[seller/market-insights] error:', err);
    return NextResponse.json({ error: 'Failed to load market insights' }, { status: 500 });
  }
}
