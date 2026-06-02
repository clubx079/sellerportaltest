// Set which DocuSeal role signs which side of the Purchase & Sale Agreement.
//
// On DealMap our logged-in user signs first (= First Party); the counterparty
// is emailed (= Second Party). The default/correct direction is SELLER-first:
// our user is the Seller selling to the Buyer.
//   --to seller (default):  seller*_signature/print -> First Party (our user)
//                           buyer_signature/print   -> Second Party (the buyer)
//   --to buyer:             the reverse (only for the off-platform "wholesaler
//                           buys from owner" variant — not used on DealMap).
//
// Only the signing block is reassigned; read-only pre-filled fields keep their
// submitter and field NAMES are never changed. Run on BOTH DocuSeal accounts
// (main + staging) so the shared code in lib/contract-templates.js stays in sync:
//   DOCUSEAL_API_KEY=<main key>    node scripts/flip-purchase-roles.mjs 3801788
//   DOCUSEAL_API_KEY=<staging key> node scripts/flip-purchase-roles.mjs 3802527

const KEY = process.env.DOCUSEAL_API_KEY
if (!KEY) { console.error('DOCUSEAL_API_KEY env var required'); process.exit(1) }

const BASE = 'https://api.docuseal.com'
const headers = { 'X-Auth-Token': KEY, 'Content-Type': 'application/json' }

const args = process.argv.slice(2)
const toIdx = args.indexOf('--to')
const direction = toIdx !== -1 ? args[toIdx + 1] : 'seller'
const ids = args.filter((a, i) => a !== '--to' && i !== toIdx + 1)
if (!['seller', 'buyer'].includes(direction)) { console.error("--to must be 'seller' or 'buyer'"); process.exit(1) }

async function flip(templateId) {
  const t = await (await fetch(`${BASE}/templates/${templateId}`, { headers })).json()
  if (!t || !Array.isArray(t.fields)) {
    console.error(`  ${templateId}: could not load (${t?.error || 'unknown'})`); return
  }
  const first = (t.submitters || []).find(s => s.name === 'First Party')?.uuid
  const second = (t.submitters || []).find(s => s.name === 'Second Party')?.uuid
  if (!first || !second) { console.error(`  ${templateId}: missing First/Second Party roles`); return }

  // seller-first: our user (First Party) = Seller; buyer (Second Party) = Buyer.
  const sellerRole = direction === 'seller' ? first : second
  const buyerRole  = direction === 'seller' ? second : first

  const fields = t.fields.map(f => {
    if (/^buyer_(signature|print_name)$/i.test(f.name)) return { ...f, submitter_uuid: buyerRole }
    if (/^seller\d?_(signature|print_name)$/i.test(f.name)) return { ...f, submitter_uuid: sellerRole }
    return f
  })

  const put = await fetch(`${BASE}/templates/${templateId}`, {
    method: 'PUT', headers, body: JSON.stringify({ fields }),
  })
  const out = await put.json()
  if (!put.ok) { console.error(`  ${templateId}: PUT failed — ${out?.error || put.status}`); return }
  const who = direction === 'seller'
    ? 'seller signs first (First Party), buyer signs second (Second Party)'
    : 'buyer signs first (First Party), seller signs second (Second Party)'
  console.log(`  ${templateId} (${t.name}): ${who}`)
}

if (!ids.length) { console.error('Pass at least one template ID'); process.exit(1) }
console.log(`Setting Purchase roles (--to ${direction})…`)
for (const id of ids) await flip(id)
console.log('Done.')
