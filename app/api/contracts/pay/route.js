import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getWorkspaceSellerId } from '@/lib/workspace'

// Per-contract ("per envelope") fee. Both values are env-overridable so they
// can be changed without a deploy.
const CONTRACT_FEE_CENTS = parseInt(process.env.CONTRACT_FEE_CENTS || '299', 10)
const ENTERPRISE_FREE_CONTRACTS = parseInt(process.env.ENTERPRISE_FREE_CONTRACTS || '10', 10)

const getClients = () => ({
  supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
})

// Resolve the effective seller (handles team-member workspaces).
async function resolveSellerId(request, fallback) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return fallback
  const sellerId = auth.slice(7).trim()
  try {
    const { effectiveId } = await getWorkspaceSellerId(sellerId)
    return effectiveId || sellerId || fallback
  } catch {
    return sellerId || fallback
  }
}

// Decide what this seller owes for sending one contract.
async function computeFee(supabase, sellerId) {
  // 1. Lifetime-free internal accounts never pay.
  const { data: app } = await supabase
    .from('seller_applications')
    .select('admin_notes')
    .eq('id', sellerId)
    .maybeSingle()
  if (app?.admin_notes === 'LIFETIME_FREE') {
    return { amount: 0, reason: 'lifetime_free' }
  }

  // 2. Enterprise plans get a free allowance of contracts PER BILLING MONTH
  //    (N = ENTERPRISE_FREE_CONTRACTS). The allowance resets every billing cycle,
  //    so we only count envelopes sent since the current period started.
  const { data: plan } = await supabase
    .from('seller_plans')
    .select('plan_type, status, current_period_start')
    .eq('seller_id', sellerId)
    .maybeSingle()

  const isActivePlan = plan && ['active', 'trialing', 'canceling', 'past_due'].includes(plan.status)
  if (isActivePlan && plan.plan_type === 'enterprise') {
    let q = supabase
      .from('contract_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .in('status', ['sent', 'signed', 'completed'])
    // Only count contracts sent in the current billing period (monthly reset).
    if (plan.current_period_start) q = q.gte('created_at', plan.current_period_start)
    const { count } = await q
    const used = count || 0
    if (used < ENTERPRISE_FREE_CONTRACTS) {
      return { amount: 0, reason: 'enterprise_free', remaining: ENTERPRISE_FREE_CONTRACTS - used - 1 }
    }
  }

  // 3. Everyone else (free, standard, pro, enterprise past quota) pays the flat fee.
  return { amount: CONTRACT_FEE_CENTS, reason: 'paid' }
}

async function getOrCreateCustomer(supabase, stripe, sellerId) {
  const { data: existingPlan } = await supabase
    .from('seller_plans')
    .select('stripe_customer_id')
    .eq('seller_id', sellerId)
    .not('stripe_customer_id', 'is', null)
    .maybeSingle()
  if (existingPlan?.stripe_customer_id) return existingPlan.stripe_customer_id

  const { data: app } = await supabase
    .from('seller_applications')
    .select('email, contact_person_name, stripe_customer_id')
    .eq('id', sellerId)
    .maybeSingle()
  if (app?.stripe_customer_id) return app.stripe_customer_id

  const customer = await stripe.customers.create({
    email: app?.email,
    name: app?.contact_person_name || app?.email,
    metadata: { seller_id: sellerId, source: 'deelmap_contract' },
  })
  await supabase.from('seller_applications').update({ stripe_customer_id: customer.id }).eq('id', sellerId)
  return customer.id
}

export async function POST(request) {
  const { supabase, stripe } = getClients()
  try {
    const body = await request.json().catch(() => ({}))
    const sellerId = await resolveSellerId(request, body.seller_id)
    if (!sellerId) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })
    const draftId = body.draft_id || null

    const fee = await computeFee(supabase, sellerId)

    // Quote mode: report what this contract will cost WITHOUT charging. Used to
    // show the price in the wizard before the seller commits.
    if (body.quote) {
      return NextResponse.json({
        quote: true,
        amount: fee.amount,
        free: fee.amount === 0,
        reason: fee.reason,
        ...(fee.remaining != null ? { remaining: fee.remaining } : {}),
      })
    }

    // Free for this seller → no charge, let the send proceed.
    if (fee.amount === 0) {
      return NextResponse.json({ free: true, reason: fee.reason, ...(fee.remaining != null ? { remaining: fee.remaining } : {}) })
    }

    const customerId = await getOrCreateCustomer(supabase, stripe, sellerId)

    // Always present an on-session payment form so the seller explicitly reviews
    // and confirms the charge (consistent with add-ons / plans). The customer is
    // attached so any saved card is offered for one-click selection inside the
    // payment form, and setup_future_usage stores a new card for next time.
    const pi = await stripe.paymentIntents.create({
      amount: fee.amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      metadata: { seller_id: sellerId, purpose: 'contract', draft_id: draftId || '' },
    })
    return NextResponse.json({ clientSecret: pi.client_secret, amount: fee.amount })
  } catch (e) {
    console.error('[contracts/pay] error:', e?.message || e)
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 500 })
  }
}
