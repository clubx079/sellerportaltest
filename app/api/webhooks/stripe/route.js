import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  emailPaymentReceipt,
  emailPaymentFailed,
  emailSubscriptionCreated,
  emailTrialConverted,
  emailListingPromoted,
  sendSellerEmail,
} from '@/lib/sellerEmail'

async function getSeller(supabase, sellerId) {
  if (!sellerId) return null
  const { data } = await supabase
    .from('seller_applications')
    .select('email, contact_person_name')
    .eq('id', sellerId)
    .maybeSingle()
  return data || null
}

const toISO = (ts) => (ts && ts > 0) ? new Date(ts * 1000).toISOString() : null

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe Webhook] Signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── Standard plan OR add-on payment succeeded ──────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        const { seller_id, plan_type, quantity, add_ons, property_id, promo_code_id, purpose } = pi.metadata

        // Track promo code usage
        if (promo_code_id) {
          try {
            await supabase.from('promo_code_usages').upsert(
              { promo_code_id, stripe_payment_intent_id: pi.id, portal: seller_id && add_ons ? 'seller_addon' : 'seller_standard' },
              { onConflict: 'stripe_payment_intent_id' }
            )
          } catch {}
        }

        // ── Standard plan ──
        if (seller_id && plan_type === 'standard') {
          const { data: existing } = await supabase
            .from('seller_plans')
            .select('id')
            .eq('stripe_customer_id', pi.customer)
            .eq('plan_type', 'standard')
            .maybeSingle()

          if (!existing) {
            await supabase.from('seller_plans').insert({
              seller_id,
              plan_type: 'standard',
              billing_cycle: 'one_time',
              status: 'active',
              stripe_customer_id: pi.customer,
              quantity: parseInt(quantity || '1'),
              listings_used_this_period: 0,
            })

            await supabase
              .from('seller_applications')
              .update({ status: 'approved' })
              .eq('id', seller_id)
          }

          // Link referral commission for standard plan
          if (pi.amount > 0) {
            const { data: signup } = await supabase
              .from('link_referral_signups')
              .select('referrer_id')
              .eq('referred_id', seller_id)
              .maybeSingle()

            if (signup) {
              await supabase.from('link_referral_commissions').upsert(
                {
                  referrer_id: signup.referrer_id,
                  referred_id: seller_id,
                  stripe_payment_intent_id: pi.id,
                  amount_cents: Math.round(pi.amount * 0.20),
                },
                { onConflict: 'stripe_payment_intent_id' }
              ).catch(() => {})
            }
          }

          break
        }

        // ── Listing add-ons (backup record — frontend may have already inserted) ──
        if (seller_id && add_ons) {
          const ADDON_DAYS   = { highlight: 30, boost: 7, homepage: 7, bundle: 30 }
          const ADDON_PRICES = { highlight: 999, boost: 1499, homepage: 2900, bundle: 2200 }
          const addonList = add_ons.split(',').filter(Boolean)
          const now = new Date()

          for (const addonId of addonList) {
            // Idempotency: skip if already recorded for this PI + addon_type
            const { data: existingAddon } = await supabase
              .from('listing_addons')
              .select('id')
              .eq('stripe_payment_intent_id', pi.id)
              .eq('addon_type', addonId)
              .maybeSingle()

            if (existingAddon) {
              continue // already recorded by frontend
            }

            // Check if frontend recorded without PI ID (best-effort association)
            const { data: frontendAddon } = await supabase
              .from('listing_addons')
              .select('id')
              .eq('seller_id', seller_id)
              .eq('addon_type', addonId)
              .is('stripe_payment_intent_id', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (frontendAddon) {
              // Associate the PI ID to the existing frontend record
              await supabase
                .from('listing_addons')
                .update({ stripe_payment_intent_id: pi.id })
                .eq('id', frontendAddon.id)
              continue
            }

            // Neither frontend nor prior webhook recorded it — insert now
            const days = ADDON_DAYS[addonId] || 7
            const amount = ADDON_PRICES[addonId] || 0
            await supabase.from('listing_addons').insert({
              property_id:              property_id || null,
              seller_id,
              addon_type:               addonId,
              stripe_payment_intent_id: pi.id,
              amount_paid:              amount,
              days_purchased:           days,
              starts_at:                now.toISOString(),
              ends_at:                  new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
              status:                   'active',
            })
          }
        }

        // ── Receipt + (if add-ons) listing-promoted email ──
        try {
          const seller = await getSeller(supabase, seller_id)
          if (seller?.email) {
            const amount = pi.amount_received ?? pi.amount ?? 0
            const desc = purpose === 'contract' ? 'Contract fee' : add_ons ? 'Listing promotion' : (plan_type ? `${plan_type} subscription` : 'DeelMap purchase')
            const receipt_url = pi.charges?.data?.[0]?.receipt_url || null
            const r = emailPaymentReceipt({ name: seller.contact_person_name, amount_cents: amount, description: desc, receipt_url })
            await sendSellerEmail({ to: seller.email, subject: r.subject, html: r.html })

            if (add_ons && property_id) {
              const ADDON_DAYS = { highlight: 30, boost: 7, homepage: 7, bundle: 30 }
              const ts = Date.now()
              const addons = add_ons.split(',').filter(Boolean).map(type => ({
                type,
                ends_at: new Date(ts + (ADDON_DAYS[type] || 7) * 86400000).toISOString(),
              }))
              const { data: property } = await supabase
                .from('properties')
                .select('address, city, state')
                .eq('id', property_id)
                .maybeSingle()
              const property_address = property ? [property.address, property.city, property.state].filter(Boolean).join(', ') : null
              const p = emailListingPromoted({ name: seller.contact_person_name, addons, property_address })
              await sendSellerEmail({ to: seller.email, subject: p.subject, html: p.html })
            }
          }
        } catch (e) { console.error('[stripe.payment_intent.succeeded] email failed:', e?.message || e) }

        break
      }

      // ── Pro/Enterprise subscription created (trial or paid) ──────────
      case 'customer.subscription.created': {
        const sub = event.data.object
        const { seller_id, plan_type, billing_cycle } = sub.metadata

        if (!seller_id) break

        const { data: existingPlan } = await supabase
          .from('seller_plans')
          .select('id')
          .eq('seller_id', seller_id)
          .maybeSingle()

        const planRow = {
          seller_id,
          plan_type,
          billing_cycle: billing_cycle || 'monthly',
          status: sub.status === 'trialing' ? 'trialing' : sub.status === 'incomplete' ? 'incomplete' : 'active',
          stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items.data[0]?.price?.id || null,
          trial_ends_at:        toISO(sub.trial_end),
          current_period_start: toISO(sub.current_period_start ?? sub.items?.data?.[0]?.current_period_start),
          current_period_end:   toISO(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? sub.trial_end),
          updated_at: new Date().toISOString(),
        }

        if (existingPlan) {
          await supabase.from('seller_plans').update(planRow).eq('id', existingPlan.id)
        } else {
          await supabase.from('seller_plans').insert(planRow)
        }

        await supabase
          .from('seller_applications')
          .update({ status: 'approved' })
          .eq('id', seller_id)

        // ── Subscription confirmation email ──
        try {
          const seller = await getSeller(supabase, seller_id)
          if (seller?.email) {
            const s = emailSubscriptionCreated({
              name: seller.contact_person_name,
              plan_type,
              billing_cycle: billing_cycle || 'monthly',
              trial_ends_at: toISO(sub.trial_end),
            })
            await sendSellerEmail({ to: seller.email, subject: s.subject, html: s.html })
          }
        } catch (e) { console.error('[stripe.subscription.created] email failed:', e?.message || e) }

        break
      }

      // ── Subscription updated (upgrade/downgrade/renewal/cancel-at-period-end) ──
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { plan_type: metaPlanType, billing_cycle: metaBillingCycle } = sub.metadata || {}

        // Read prior status so we can detect a trial-to-paid conversion after the update
        const { data: existingPlan } = await supabase
          .from('seller_plans')
          .select('status, seller_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        const wasInTrial = existingPlan?.status === 'trialing'

        // Derive plan_type from the live price ID — this is the authoritative source
        // when a subscription schedule transitions (metadata still has old plan type).
        const PRICE_MAP = {
          [process.env.STRIPE_PRICE_PRO_MONTHLY]:        { plan_type: 'pro',        billing_cycle: 'monthly' },
          [process.env.STRIPE_PRICE_PRO_ANNUAL]:         { plan_type: 'pro',        billing_cycle: 'annual'  },
          [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY]: { plan_type: 'enterprise', billing_cycle: 'monthly' },
          [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL]:  { plan_type: 'enterprise', billing_cycle: 'annual'  },
        }
        const livePriceId = sub.items.data[0]?.price?.id
        const liveInfo = livePriceId ? PRICE_MAP[livePriceId] : null

        // Determine logical status
        let newStatus
        if (sub.cancel_at_period_end) {
          newStatus = 'canceling'
        } else if (sub.status === 'trialing') {
          newStatus = 'trialing'
        } else if (sub.status === 'past_due') {
          newStatus = 'past_due'
        } else {
          newStatus = 'active'
        }

        const updateData = {
          status:               newStatus,
          current_period_start: toISO(sub.current_period_start ?? sub.items?.data?.[0]?.current_period_start),
          current_period_end:   toISO(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end),
          stripe_price_id:      livePriceId || null,
          updated_at:           new Date().toISOString(),
        }

        // Price ID is the authoritative source; fall back to metadata only if price is unknown
        if (liveInfo?.plan_type) {
          updateData.plan_type    = liveInfo.plan_type
          updateData.billing_cycle = liveInfo.billing_cycle
        } else {
          if (metaPlanType)    updateData.plan_type    = metaPlanType
          if (metaBillingCycle) updateData.billing_cycle = metaBillingCycle
        }

        await supabase
          .from('seller_plans')
          .update(updateData)
          .eq('stripe_subscription_id', sub.id)

        // ── Trial converted to paid? ──
        if (wasInTrial && newStatus === 'active' && existingPlan?.seller_id) {
          try {
            const seller = await getSeller(supabase, existingPlan.seller_id)
            if (seller?.email) {
              const t = emailTrialConverted({
                name: seller.contact_person_name,
                plan_type: updateData.plan_type || metaPlanType,
                billing_cycle: updateData.billing_cycle || metaBillingCycle,
                next_charge_at: updateData.current_period_end,
              })
              await sendSellerEmail({ to: seller.email, subject: t.subject, html: t.html })
            }
          } catch (e) { console.error('[stripe.subscription.updated] trial-converted email failed:', e?.message || e) }
        }

        break
      }

      // ── Subscription ended — mark canceled + deactivate all listings ──
      case 'customer.subscription.deleted': {
        const sub = event.data.object

        // Look up the seller before updating (need seller_id for deactivation)
        const { data: planRow } = await supabase
          .from('seller_plans')
          .select('seller_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()

        await supabase
          .from('seller_plans')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)

        if (planRow?.seller_id) {
          const sellerId = planRow.seller_id

          // Deactivate all active manual properties
          await supabase
            .from('properties')
            .update({ status: 'inactive', property_status: 'unavailable', updated_at: new Date().toISOString() })
            .eq('seller_id', sellerId)
            .in('status', ['active', 'under_review'])

          // Deactivate all active scraped listings (wholesale_deals)
          const { data: appRow } = await supabase
            .from('seller_applications')
            .select('temp_seller_id')
            .eq('id', sellerId)
            .maybeSingle()

          if (appRow?.temp_seller_id) {
            await supabase
              .from('wholesale_deals')
              .update({ status: 'inactive' })
              .eq('temp_seller_id', appRow.temp_seller_id)
              .eq('status', 'active')
          }
        }

        break
      }

      // ── Invoice paid: track promo code usage + link referral commission ──
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription)
            const promo_code_id = sub.metadata?.promo_code_id
            if (promo_code_id && invoice.payment_intent) {
              await supabase.from('promo_code_usages').upsert(
                { promo_code_id, stripe_payment_intent_id: invoice.payment_intent, portal: 'seller_subscription' },
                { onConflict: 'stripe_payment_intent_id' }
              )
            }

            const sellerId = sub.metadata?.seller_id
            if (sellerId && invoice.payment_intent && invoice.amount_paid > 0) {
              const { data: signup } = await supabase
                .from('link_referral_signups')
                .select('referrer_id')
                .eq('referred_id', sellerId)
                .maybeSingle()

              if (signup) {
                await supabase.from('link_referral_commissions').upsert(
                  {
                    referrer_id: signup.referrer_id,
                    referred_id: sellerId,
                    stripe_payment_intent_id: invoice.payment_intent,
                    amount_cents: Math.round(invoice.amount_paid * 0.20),
                  },
                  { onConflict: 'stripe_payment_intent_id' }
                )
              }
            }

            // ── Recurring-charge receipt email ──
            if (sellerId && invoice.amount_paid > 0) {
              const seller = await getSeller(supabase, sellerId)
              if (seller?.email) {
                const r = emailPaymentReceipt({
                  name: seller.contact_person_name,
                  amount_cents: invoice.amount_paid,
                  description: 'DeelMap subscription',
                  receipt_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
                })
                await sendSellerEmail({ to: seller.email, subject: r.subject, html: r.html })
              }
            }
          } catch (e) { console.error('[stripe.invoice.payment_succeeded] email failed:', e?.message || e) }
        }
        break
      }

      // ── Invoice payment failed ────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object

        await supabase
          .from('seller_plans')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription)

        // ── Payment-failed email ──
        try {
          if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription)
            const sellerId = sub.metadata?.seller_id
            if (sellerId) {
              const seller = await getSeller(supabase, sellerId)
              if (seller?.email) {
                const f = emailPaymentFailed({
                  name: seller.contact_person_name,
                  amount_cents: invoice.amount_due ?? invoice.amount_remaining ?? 0,
                  hosted_invoice_url: invoice.hosted_invoice_url || null,
                })
                await sendSellerEmail({ to: seller.email, subject: f.subject, html: f.html })
              }
            }
          }
        } catch (e) { console.error('[stripe.invoice.payment_failed] email failed:', e?.message || e) }

        break
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err)
  }

  return NextResponse.json({ received: true })
}
