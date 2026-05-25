/**
 * Friendly metadata + DocuSeal field mapping for the contracts wizard.
 *
 * The wizard at /contracts/new collects a normalized set of fields
 * (property_address, purchase_price, emd, closing_date, buyer_name, buyer_email,
 * financing_type, special_terms). On "Send Contract" we POST to /api/contracts
 * which maps these into DocuSeal field names via the `fieldMap` below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *   TODO (user): populate TEMPLATE_CONFIG with the real DocuSeal template ids
 *   and the exact field names from each template in your DocuSeal account.
 *
 *   Steps:
 *     1. Hit GET /api/contracts?type=templates while logged in (or call
 *        DocuSeal's /templates endpoint directly) to list every template id +
 *        the field names defined on it.
 *     2. Pick the templates you want to expose in the wizard, and for each one
 *        add an entry below keyed by the numeric template id (as a string).
 *     3. Make sure each `fieldMap` value matches the EXACT field name on the
 *        DocuSeal template (case-sensitive). If a name doesn't match, that
 *        field won't pre-fill on the document.
 *
 *   Example entry:
 *     '12345': {
 *       slug: 'purchase',
 *       label: 'Purchase Contract',
 *       description: "Use this when you're selling a property you own.",
 *       sortOrder: 1,
 *       fieldMap: {
 *         property_address: 'Property Address',
 *         purchase_price:   'Purchase Price',
 *         emd:              'Earnest Money',
 *         closing_date:     'Closing Date',
 *         buyer_name:       'Buyer Name',
 *         buyer_email:      'Buyer Email',
 *         financing_type:   'Financing',
 *         special_terms:    'Special Terms',
 *       },
 *     },
 *
 *   Until populated, the wizard will gracefully fall back to showing the raw
 *   DocuSeal template name + a generic description, and "Send Contract" will
 *   still work — it just won't pre-fill DocuSeal fields by name.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const TEMPLATE_CONFIG = {
  // '12345': { slug, label, description, sortOrder, fieldMap }
}

/**
 * Decorate a raw DocuSeal templates response with our friendly metadata.
 *
 * - Templates present in TEMPLATE_CONFIG are returned with full friendly data
 *   in their configured sortOrder.
 * - Templates NOT present are still returned (so the wizard remains usable
 *   before the config is populated), with a fallback label/description and
 *   pushed to the end of the list.
 *
 * Each returned item has shape:
 *   { id, name, label, description, slug, sortOrder, fieldMap, raw }
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
 * shape for a given template, using TEMPLATE_CONFIG[templateId].fieldMap.
 *
 * Returns a plain object { 'DocuSeal Field Name': value, ... } that can be
 * passed as submitters[0].values in the DocuSeal submission POST.
 *
 * Falls back to passing the values through with their wizard keys if the
 * template has no fieldMap configured — DocuSeal will simply ignore unknown
 * field names rather than erroring.
 */
export function mapFieldValues(templateId, fieldValues) {
  const cfg = TEMPLATE_CONFIG[String(templateId)]
  const fieldMap = cfg?.fieldMap || {}
  const out = {}
  for (const [wizardKey, value] of Object.entries(fieldValues || {})) {
    if (value === undefined || value === null || value === '') continue
    const docusealKey = fieldMap[wizardKey] || wizardKey
    out[docusealKey] = value
  }
  return out
}
