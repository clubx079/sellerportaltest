// Apply human-readable signer-facing titles + lock all deal-term fields
// (readonly) on a DocuSeal contract template.
//
// DocuSeal shows `title` to signers and falls back to the raw field `name`
// (e.g. "closing_day", "seller1_signature") when no title is set — which is the
// code-looking text Roland flagged. We keep every field `name` untouched (our
// app's field-mapping depends on it) and only ADD a title + readonly flag.
//
// Rule: every field stays read-only EXCEPT the signing block —
//   anything whose name contains "signature" or "print_name".
// That leaves only signatures, signature dates, and print-names interactive;
// all the pre-filled deal terms become display-only.
//
// Usage:
//   DOCUSEAL_API_KEY=<key> node scripts/apply-docuseal-titles-readonly.mjs <templateId> [<templateId> ...]
//
// Re-run it against the STAGING DocuSeal account (its own key) for templates
// 3807293 (Assignment v3) + 3802527 (Purchase v3) to bring staging in line.

const KEY = process.env.DOCUSEAL_API_KEY
if (!KEY) { console.error('DOCUSEAL_API_KEY env var required'); process.exit(1) }

const BASE = 'https://api.docuseal.com'
const headers = { 'X-Auth-Token': KEY, 'Content-Type': 'application/json' }

// Friendly labels keyed by DocuSeal field name. Anything not listed falls back
// to a humanized version of the name (underscores → spaces, capitalized).
const TITLES = {
  // Shared / Purchase
  property_address: 'Property address',
  contract_date: 'Contract date',
  buyer_name: 'Buyer name',
  seller_name: 'Seller name',
  buyer_address: 'Buyer address',
  seller_address: 'Seller address',
  property_tax_id: 'Property tax ID',
  other_description: 'Other description',
  sale_price: 'Purchase price',
  source_of_funds: 'Source of funds',
  emd_amount: 'Earnest money deposit',
  emd_escrow: 'Escrow / title company',
  due_diligence_days: 'Due diligence period (days)',
  acceptance_deadline: 'Acceptance deadline',
  closing_date: 'Closing date',
  closing_location: 'Closing location',
  seller1_print_name: 'Seller — print name',
  seller1_signature: 'Seller — signature',
  seller2_print_name: 'Co-seller — print name',
  seller2_signature: 'Co-seller — signature',
  buyer_print_name: 'Buyer — print name',
  buyer_signature: 'Buyer — signature',
  // Assignment
  agreement_day: 'Agreement day',
  agreement_month: 'Agreement month',
  agreement_year: 'Agreement year',
  assignor_name: 'Assignor name',
  assignee_name: 'Assignee name',
  assignor_name_whereas: 'Assignor name',
  original_seller_name: 'Original seller name',
  original_psa_day: 'Original contract day',
  original_psa_month: 'Original contract month',
  original_psa_year: 'Original contract year',
  assignment_fee: 'Assignment fee',
  nonrefundable_deposit: 'Nonrefundable deposit',
  closing_day: 'Closing day',
  closing_month: 'Closing month',
  closing_year: 'Closing year',
  additional_terms_1: 'Additional term 1',
  additional_terms_2: 'Additional term 2',
  additional_terms_3: 'Additional term 3',
  additional_terms_4: 'Additional term 4',
  additional_terms_5: 'Additional term 5',
  additional_terms_6: 'Additional term 6',
  assignor_signature: 'Assignor — signature',
  assignor_signature_date: 'Assignor — date signed',
  assignor_print_name: 'Assignor — print name',
  assignee_signature: 'Assignee — signature',
  assignee_signature_date: 'Assignee — date signed',
  assignee_print_name: 'Assignee — print name',
}

const humanize = (name) =>
  String(name).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

// Interactive (NOT readonly): the signing block only.
const isInteractive = (name) => /signature|print_name/i.test(name)

async function applyTo(templateId) {
  const res = await fetch(`${BASE}/templates/${templateId}`, { headers })
  const t = await res.json()
  if (!t || !Array.isArray(t.fields)) {
    console.error(`  ${templateId}: could not load template (${t?.error || 'unknown'})`)
    return
  }

  const fields = t.fields.map(f => ({
    ...f,
    title: TITLES[f.name] || humanize(f.name),
    readonly: !isInteractive(f.name),
  }))

  const put = await fetch(`${BASE}/templates/${templateId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ fields }),
  })
  const out = await put.json()
  if (!put.ok) {
    console.error(`  ${templateId}: PUT failed — ${out?.error || put.status}`)
    return
  }
  const locked = fields.filter(f => f.readonly).length
  const open = fields.length - locked
  console.log(`  ${templateId} (${t.name}): titled ${fields.length} fields · locked ${locked} · ${open} interactive (signing block)`)
}

const ids = process.argv.slice(2)
if (!ids.length) { console.error('Pass at least one template ID'); process.exit(1) }
console.log('Applying titles + readonly…')
for (const id of ids) await applyTo(id)
console.log('Done.')
