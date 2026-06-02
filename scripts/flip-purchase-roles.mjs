// Flip the Purchase contract so the wholesaler (our logged-in user, who signs
// first = First Party) is the BUYER, and the outside property owner (emailed
// second = Second Party) is the SELLER.
//
// Wholesalers don't own the house — when they lock up a deal they sign as the
// BUYER against the owner. The template shipped with First Party=Seller, which
// is backwards for that flow. This reassigns ONLY the signing block:
//   buyer_signature / buyer_print_name   -> First Party  (our user)
//   seller*_signature / seller*_print_name -> Second Party (the owner)
// All other (read-only, pre-filled) fields keep their submitter — assignment is
// irrelevant for locked fields. Field NAMES are never changed.
//
// Must be run on BOTH DocuSeal accounts (main + staging) so the shared code in
// lib/contract-templates.js stays in sync:
//   DOCUSEAL_API_KEY=<main key>    node scripts/flip-purchase-roles.mjs 3801788
//   DOCUSEAL_API_KEY=<staging key> node scripts/flip-purchase-roles.mjs 3802527

const KEY = process.env.DOCUSEAL_API_KEY
if (!KEY) { console.error('DOCUSEAL_API_KEY env var required'); process.exit(1) }

const BASE = 'https://api.docuseal.com'
const headers = { 'X-Auth-Token': KEY, 'Content-Type': 'application/json' }

async function flip(templateId) {
  const t = await (await fetch(`${BASE}/templates/${templateId}`, { headers })).json()
  if (!t || !Array.isArray(t.fields)) {
    console.error(`  ${templateId}: could not load (${t?.error || 'unknown'})`); return
  }
  const first = (t.submitters || []).find(s => s.name === 'First Party')?.uuid
  const second = (t.submitters || []).find(s => s.name === 'Second Party')?.uuid
  if (!first || !second) { console.error(`  ${templateId}: missing First/Second Party roles`); return }

  const fields = t.fields.map(f => {
    if (/^buyer_(signature|print_name)$/i.test(f.name)) return { ...f, submitter_uuid: first }
    if (/^seller\d?_(signature|print_name)$/i.test(f.name)) return { ...f, submitter_uuid: second }
    return f
  })

  const put = await fetch(`${BASE}/templates/${templateId}`, {
    method: 'PUT', headers, body: JSON.stringify({ fields }),
  })
  const out = await put.json()
  if (!put.ok) { console.error(`  ${templateId}: PUT failed — ${out?.error || put.status}`); return }
  console.log(`  ${templateId} (${t.name}): buyer signs first (First Party), seller signs second (Second Party)`)
}

const ids = process.argv.slice(2)
if (!ids.length) { console.error('Pass at least one template ID'); process.exit(1) }
console.log('Flipping Purchase roles…')
for (const id of ids) await flip(id)
console.log('Done.')
