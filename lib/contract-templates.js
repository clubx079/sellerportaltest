/**
 * Friendly metadata + DocuSeal field mapping for the contracts wizard.
 *
 * The wizard at /contracts/new collects these normalized fields:
 *
 *   Universal across templates:
 *     - property_address      from selected listing
 *     - buyer_name            counterparty name (Buyer on Purchase, Assignee on Assignment)
 *     - buyer_email           used only for DocuSeal delivery
 *     - purchase_price        sale_price (Purchase) / assignment_fee (Assignment)
 *     - emd                   emd_amount (Purchase) / nonrefundable_deposit (Assignment)
 *     - closing_date          single ISO date; split for Assignment
 *     - special_terms         free text; split for Assignment into terms 1-6
 *
 *   Purchase Contract specific (seller portal: OUR user is the Seller):
 *     - financing_type        'cash' | 'loan'
 *     - seller_address        OUR user's address (profile default)
 *     - buyer_address         counterparty's address
 *     - property_tax_id       parcel / tax ID
 *     - other_description     additional property notes
 *     - emd_escrow            title company / escrow agent (profile default)
 *     - due_diligence_days    inspection period (default 14)
 *     - acceptance_deadline   ISO date the buyer must accept by
 *     - closing_location      title company address (profile default)
 *
 *   Assignment Contract specific:
 *     - original_seller_name  property owner from the underlying PSA
 *     - original_psa_date     ISO date the Assignor signed the underlying PSA
 *
 * On "Send Contract" the API calls `mapFieldValues(templateId, fieldValues, ctx)`
 * to translate wizard data into DocuSeal's `submitters[].values` shape using the
 * per-template fieldMap + transform + autoFields below.
 *
 * Field names on DocuSeal were labeled via PUT /templates/{id} on 2026-05-25
 * (script: scripts/label-docuseal-templates.py).
 */
// Shared per-template configs — aliased under both the local and staging
// DocuSeal account IDs so the same wizard code works in either environment.
export const TEMPLATE_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // 3801788 · Deelmap Purchase Contract (Buyer/Seller v2)
  //   In the seller portal, OUR user = SELLER (First Party). Counterparty = BUYER (Second Party).
  //   Replaces archived template 3718826 (which had "Deelmap" hard-coded on
  //   line 1 + had buyer/seller roles inverted relative to the seller-portal flow).
  //
  //   22 named DocuSeal fields. Wizard pre-fills 16 of them; the remaining 6
  //   are signatures + print_name fields handled by the DocuSeal signing flow.
  // ─────────────────────────────────────────────────────────────────────────
  '3801788': /* local DocuSeal */ {
    slug: 'purchase',
    label: 'Purchase Contract',
    description: "Use this when you're selling a property to a buyer. You sign as the Seller; the counterparty signs as the Buyer.",
    sortOrder: 1,
    fieldMap: {
      property_address:    'property_address',
      buyer_name:          'buyer_name',          // wizard's counterparty = Buyer on the contract
      purchase_price:      'sale_price',
      emd:                 'emd_amount',
      closing_date:        'closing_date',
      financing_type:      'source_of_funds',
      seller_address:      'seller_address',      // OUR user's address (profile default)
      buyer_address:       'buyer_address',       // counterparty's address
      property_tax_id:     'property_tax_id',
      other_description:   'other_description',
      emd_escrow:          'emd_escrow',          // title company / escrow holder
      due_diligence_days:  'due_diligence_days',
      acceptance_deadline: 'acceptance_deadline',
      closing_location:    'closing_location',
      co_seller_name:      'seller2_print_name', // optional second seller on the print/sign line
    },
    autoFields: (ctx) => {
      const out = {
        contract_date: ctx?.todayISO || new Date().toISOString().slice(0, 10),
      }
      // OUR user is the Seller — auto-fill their name in both the top-of-doc
      // seller_name and the seller1_print_name signing field.
      if (ctx?.sellerName) {
        out.seller_name        = ctx.sellerName
        out.seller1_print_name = ctx.sellerName
      }
      // Counterparty is the Buyer — pre-fill their print-name on the signing line
      // so the buyer doesn't have to retype what we already collected in Step 2.
      if (ctx?.buyerName) {
        out.buyer_print_name = ctx.buyerName
      }
      return out
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3706747 · Assignment of Sale Contract
  //   User = ASSIGNOR. Counterparty = ASSIGNEE (end buyer).
  //   28 named DocuSeal fields. closing_date and original_psa_date are
  //   split into day/month/year via `transform`. special_terms is split
  //   into additional_terms_1..6 by newline.
  // ─────────────────────────────────────────────────────────────────────────
  '3706747': /* local DocuSeal */ {
    slug: 'assignment',
    label: 'Assignment of Contract',
    description: "Use this when you have a property under contract and are assigning your rights to a new buyer. You're the Assignor; the new buyer signs as the Assignee.",
    sortOrder: 2,
    fieldMap: {
      property_address:     'property_address',
      buyer_name:           'assignee_name',
      purchase_price:       'assignment_fee',
      emd:                  'nonrefundable_deposit',
      // closing_date           → split via transform (closing_day/month/year)
      // special_terms          → split via transform (additional_terms_1..6)
      // original_psa_date      → split via transform (original_psa_day/month/year)
      original_seller_name: 'original_seller_name',
    },
    transform: (fieldValues) => {
      const out = {}

      // closing_date → 3 fields (day=number, month=text long-form, year=2-digit number)
      const splitDate = (iso, prefix) => {
        if (!iso) return
        const d = new Date(iso)
        if (isNaN(d.getTime())) return
        out[`${prefix}_day`]   = String(d.getDate())
        out[`${prefix}_month`] = d.toLocaleString('en-US', { month: 'long' })
        out[`${prefix}_year`]  = String(d.getFullYear()).slice(-2)
      }
      splitDate(fieldValues?.closing_date,      'closing')
      splitDate(fieldValues?.original_psa_date, 'original_psa')

      // special_terms (single textarea) → additional_terms_1..6 (one line per field).
      // Trim blank lines; cap at 6 to match the form layout. Overflow text is lost
      // (Step5Review surfaces this as a warning before send if it ever happens).
      if (fieldValues?.special_terms) {
        const lines = String(fieldValues.special_terms)
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
        for (let i = 0; i < Math.min(lines.length, 6); i++) {
          out[`additional_terms_${i + 1}`] = lines[i]
        }
      }

      return out
    },
    autoFields: (ctx) => {
      const today = ctx?.today instanceof Date ? ctx.today : new Date()
      const out = {
        agreement_day:   String(today.getDate()),
        agreement_month: today.toLocaleString('en-US', { month: 'long' }),
        agreement_year:  String(today.getFullYear()).slice(-2),
      }
      // The assignor is our logged-in seller; their identity goes into three
      // separate fields on the contract.
      if (ctx?.sellerName) {
        out.assignor_name         = ctx.sellerName
        out.assignor_name_whereas = ctx.sellerName
        out.assignor_print_name   = ctx.sellerName
      }
      return out
    },
  },
  // Staging DocuSeal account uses different template IDs for the same docs.
  '3802120': /* staging DocuSeal v1 (archived) */ null,
  '3802527': /* staging DocuSeal v3 */ null,
  '3759339': /* staging DocuSeal v1 (archived) */ null,
  '3806781': /* staging DocuSeal Assignment v2 */ null,
  '3807291': /* local DocuSeal Assignment v3 — REPLACED 3706747 */ null,
  '3807293': /* staging DocuSeal Assignment v3 — REPLACED 3806781 */ null,

}
// Map staging template IDs to the same config objects as their local counterparts.
TEMPLATE_CONFIG['3802120'] = TEMPLATE_CONFIG['3801788']
TEMPLATE_CONFIG['3802527'] = TEMPLATE_CONFIG['3801788']
TEMPLATE_CONFIG['3759339'] = TEMPLATE_CONFIG['3706747']
TEMPLATE_CONFIG['3806781'] = TEMPLATE_CONFIG['3706747']
TEMPLATE_CONFIG['3807291'] = TEMPLATE_CONFIG['3706747']
TEMPLATE_CONFIG['3807293'] = TEMPLATE_CONFIG['3706747']



/**
 * Decorate raw DocuSeal templates with our friendly metadata.
 */
export function decorateTemplates(rawTemplates) {
  if (!Array.isArray(rawTemplates)) return []
  const decorated = rawTemplates.map((t) => {
    const cfg = TEMPLATE_CONFIG[String(t.id)]
    if (cfg) {
      return {
        id: t.id,
        name: t.name,
        label: cfg.label,
        description: cfg.description,
        slug: cfg.slug,
        sortOrder: cfg.sortOrder ?? 999,
        fieldMap: cfg.fieldMap || {},
        configured: true,
        raw: t,
      }
    }
    return {
      id: t.id,
      name: t.name,
      label: t.name || `Contract ${t.id}`,
      description: 'Standard contract template.',
      slug: `template-${t.id}`,
      sortOrder: 999,
      fieldMap: {},
      configured: false,
      raw: t,
    }
  })
  return decorated.sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.label).localeCompare(String(b.label)))
}

/**
 * Compose the DocuSeal `values` object for a template:
 *   1. autoFields(ctx)        derived defaults
 *   2. fieldMap renames       wizard key → docuseal key (1-to-1)
 *   3. transform(fieldValues) custom expansions (1-to-many)
 *
 * Last-wins on key collisions.
 */
export function mapFieldValues(templateId, fieldValues = {}, ctx = {}) {
  const cfg = TEMPLATE_CONFIG[String(templateId)]
  const out = {}

  if (cfg?.autoFields) {
    try { Object.assign(out, cfg.autoFields(ctx) || {}) }
    catch (e) { console.error('autoFields error for template', templateId, e) }
  }

  const fieldMap = cfg?.fieldMap || {}
  for (const [wizardKey, value] of Object.entries(fieldValues || {})) {
    if (value === undefined || value === null || value === '') continue
    const docusealKey = fieldMap[wizardKey]
    if (docusealKey) out[docusealKey] = value
  }

  if (cfg?.transform) {
    try { Object.assign(out, cfg.transform(fieldValues) || {}) }
    catch (e) { console.error('transform error for template', templateId, e) }
  }

  return out
}
