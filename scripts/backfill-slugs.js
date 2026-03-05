#!/usr/bin/env node
/**
 * Backfill short slugs for existing properties and wholesale_deals.
 * Run from seller dashboard root with: node scripts/backfill-slugs.js
 * Loads .env.local from project root (no dotenv required).
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env.local from project root (same folder as package.json)
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Add them to .env.local in the seller dashboard root, or set the env vars before running.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function shortSlugFromId(id) {
  return crypto.createHash('md5').update(String(id)).digest('hex').slice(0, 8);
}

async function backfillProperties() {
  const { data: rows, error: fetchError } = await supabase
    .from('properties')
    .select('id');

  if (fetchError) {
    throw new Error('properties: ' + fetchError.message);
  }
  if (!rows?.length) {
    console.log('  No properties to update.');
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    const slug = shortSlugFromId(row.id);
    const { error: updateError } = await supabase
      .from('properties')
      .update({ slug })
      .eq('id', row.id);

    if (updateError) throw new Error('properties update: ' + updateError.message);
    updated++;
  }
  return updated;
}

async function backfillWholesaleDeals() {
  const { data: rows, error: fetchError } = await supabase
    .from('wholesale_deals')
    .select('id')
    .is('slug', null);

  if (fetchError) {
    throw new Error('wholesale_deals: ' + fetchError.message);
  }
  if (!rows?.length) {
    console.log('  No wholesale_deals with NULL slug.');
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    const slug = shortSlugFromId(row.id);
    const { error: updateError } = await supabase
      .from('wholesale_deals')
      .update({ slug })
      .eq('id', row.id);

    if (updateError) throw new Error('wholesale_deals update: ' + updateError.message);
    updated++;
  }
  return updated;
}

async function main() {
  console.log('Backfilling short slugs (8-char hex from id)...\n');

  console.log('1. properties (seller dashboard manual listings)');
  const pCount = await backfillProperties();
  console.log('   Updated', pCount, 'row(s).\n');

  console.log('2. wholesale_deals (Cloudflare / SMS)');
  const wCount = await backfillWholesaleDeals();
  console.log('   Updated', wCount, 'row(s).\n');

  console.log('Done. Total:', pCount + wCount, 'slugs set.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
