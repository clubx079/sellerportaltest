/**
 * Friendly metadata + DocuSeal field mapping for the contracts wizard.
 *
 * The wizard at /contracts/new collects a normalized set of fields:
 *   - property_address    (from the chosen listing)
 *   - buyer_name          (the OTHER party — seller on Purchase, assignee on Assignment)
 *   - buyer_email         (used only for DocuSeal delivery, not on the contract body)
 *   - purchase_price      (sale price on Purchase, assignment fee on Assignment)
 *   - emd                 (earnest money on Purchase, nonrefundable deposit on Assignment)
 *   - closing_date        (single ISO date; split into day/month/year for Assignment)
 *   - financing_type      ('Cash' | 'Loan')
 *   - special_terms       (free text)
 *
 * On "Send Contract" the wizard POSTs to /api/contracts which calls
 * `mapFieldValues(templateId, fieldValues, ctx)` to translate wizard data into
 * DocuSeal's `submitters[].values` shape using the per-template fieldMap +
 * transform + autoFields below.
 *
 * Field names on DocuSeal were labeled via PUT /templates/{id} on 2026-05-25.
 * If you re-upload a template, re-run scripts/label-docuseal.py against it.
 */
export const TEMPLATE_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // (A to B) Deelmap Purchase Contract - Assignable
  //   The seller portal user (us) is the BUYER.
  //   Counterparty entered by user in the wizard = property owner (SELLER).
  //   21 named DocuSeal fields total — wizard pre-fills the high-value ones,
  //   the rest (buyer_address, property_tax_id, due_diligence_days, etc.) are
  //   left blank for the seller to fill inline when signing.
  // ─────────────────────────────────────────────────────────────────────────
  '3718826': {
    slug: 'purchase',
    label: 'Purchase Contract',
    description: "Use this when you're buying a property from its owner. You're the Buyer; the owner signs as the Seller.",
    sortOrder: 1,
    fieldMap: {
      property_address: 'property_address',
      buyer_name:       'seller_name',     // wizard's "other party" = Seller on this contract
      purchase_price:   'sale_price',
      emd:              'emd_amount',
      closing_date:     'closing_date',
      financing_type:   'source_of_funds',
      // special_terms: no equivalent field on this template; the seller writes
      // notes inline if needed.
    },
    // Auto-filled values that don't come from the wizard.
    // ctx provides { sellerName, sellerEmail, today } from the API caller.
    autoFields: (ctx) => ({
      contract_date: ctx?.todayISO || new Date().toISOString().slice(0, 10),
    }),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Assignment of Sale Contract
  //   The seller portal user (us) is the ASSIGNOR.
  //   Counterparty entered by user in the wizard = end buyer (ASSIGNEE).
  //   28 named DocuSeal fields total. The PDF has closing date as three
  //   separate fields (day / month / year) so we split the wizard's ISO date
  //   in the transform below.
  // ─────────────────────────────────────────────────────────────────────────
  '3706747': {
    slug: 'assignment',
    label: 'Assignment of Contract',
    description: "Use this when you have a property under contract and are assigning your rights to a new buyer. You're the Assignor; the new buyer signs as the Assignee.",
    sortOrder: 2,
    fieldMap: {
      property_address: 'property_address',
      buyer_name:       'assignee_name',         // wizard's "other party" = Assignee
      purchase_price:   'assignment_fee',        // your wholesale fee
      emd:              'nonrefundable_deposit',
      special_terms:    'additional_terms_1',    // first line; long notes spill over manually
      // closing_date → split into closing_day/month/year by the transform below.
      // financing_type: no equivalent field on this template.
    },
    transform: (fieldValues) => {
      const out = {};
      if (fieldValues?.closing_date) {
        const d = new Date(fieldValues.closing_date);
        if (!isNaN(d.getTime())) {
          out.closing_day   = String(d.getDate());
          out.closing_month = d.toLocaleString('en-US', { month: 'long' });
          out.closing_year  = String(d.getFullYear()).slice(-2); // 2-digit year (template prints "20__")
        }
      }
      return out;
    },
    autoFields: (ctx) => {
      const today = ctx?.today instanceof Date ? ctx.today : new Date();
      const out = {
        agreement_day:   String(today.getDate()),
        agreement_month: today.toLocaleString('en-US', { month: 'long' }),
        agreement_year:  String(today.getFullYear()).slice(-2),
      };
      // Auto-fill the Assignor name fields from the logged-in seller's profile.
      if (ctx?.sellerName) {
        out.assignor_name         = ctx.sellerName;
        out.assignor_name_whereas = ctx.sellerName;
        out.assignor_print_name   = ctx.sellerName;
      }
      return out;
    },
  },
}

/**
 * Decorate raw DocuSeal templates with our friendly metadata.
 * - Configured templates → full friendly data + sortOrder.
 * - Unconfigured templates → fallback to raw name, pushed to end.
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
 * Map the wizard's normalized field_values into DocuSeal's expected `values`
 * shape for a given template.
 *
 * Composition order (later wins on key collisions):
 *   1. autoFields(ctx)          — derived values (today's date, profile data, etc.)
 *   2. fieldMap rename of fieldValues — simple wizardKey → docusealName renames
 *   3. transform(fieldValues)   — complex expansions (e.g. one date → three fields)
 *
 * @param {string|number} templateId
 * @param {object} fieldValues   — wizard-collected field_values
 * @param {object} ctx           — { sellerName, sellerEmail, today, todayISO, ... }
 * @returns {object}             — { 'DocuSeal Field Name': value, ... }
 */
export function mapFieldValues(templateId, fieldValues = {}, ctx = {}) {
  const cfg = TEMPLATE_CONFIG[String(templateId)]
  const out = {}

  // 1. autoFields (derived defaults)
  if (cfg?.autoFields) {
    try {
      Object.assign(out, cfg.autoFields(ctx) || {})
    } catch (e) {
      // Defensive: never let a bad autoFields function take down the send.
      console.error('autoFields error for template', templateId, e)
    }
  }

  // 2. fieldMap renames
  const fieldMap = cfg?.fieldMap || {}
  for (const [wizardKey, value] of Object.entries(fieldValues || {})) {
    if (value === undefined || value === null || value === '') continue
    const docusealKey = fieldMap[wizardKey]
    if (docusealKey) out[docusealKey] = value
    // If no mapping, drop the value — without an explicit map we'd be writing
    // to a field DocuSeal doesn't recognize.
  }

  // 3. transform (complex expansions like one date → three fields)
  if (cfg?.transform) {
    try {
      Object.assign(out, cfg.transform(fieldValues) || {})
    } catch (e) {
      console.error('transform error for template', templateId, e)
    }
  }

  return out
}
