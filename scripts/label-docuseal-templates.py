#!/usr/bin/env python3
"""
label-docuseal-templates.py — one-time setup script that PUTs field names onto
the two DocuSeal contract templates the seller portal uses.

Why this script exists:
  DocuSeal templates start with field markers placed on the PDF but with no
  names (each field's `name` is ''). Until names are set, we can't pre-fill
  the contract with values from our wizard (`submitters[].values` is keyed
  by field name).

  This script encodes the UUID → semantic name mapping derived from each
  field's (page, y, x) position on the PDFs.

When to run:
  - Once, after the templates are first uploaded to DocuSeal (already done
    2026-05-25).
  - Again if you replace either template with a new version (the UUIDs will
    change → update the mappings below to point to the new UUIDs).
  - Never as part of normal deploys.

Usage:
  python3 scripts/label-docuseal-templates.py
"""
import json, urllib.request, urllib.error

import os, re
# Read DOCUSEAL_API_KEY from .env.local (sibling to scripts/)
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
KEY = ''
for line in open(env_path):
    m = re.match(r'^DOCUSEAL_API_KEY=\"?([^\"\n]+)\"?', line)
    if m: KEY = m.group(1).strip(); break
assert KEY, 'DOCUSEAL_API_KEY not found in .env.local'

# UUID → semantic name mapping derived from PDF position analysis.
# Validated against the PDFs the user provided.
PURCHASE_MAP = {
    '8a15e7c1-019c-45a1-90fc-da782c0ce92b': 'contract_date',
    'b4129a6f-f55b-418e-8c88-a3742bd3346a': 'buyer_address',
    '355fff3e-80bb-4973-955d-75621ddad190': 'seller_name',
    '9e90a8fb-248e-47e5-b7c9-29f1b8bac563': 'seller_address',
    '86dc27dd-ee36-4790-922b-4c9c796e18a2': 'property_address',
    'e88e8995-44b7-4b97-b502-7f17fc8fba6f': 'property_tax_id',
    'e3e7fa13-3cef-465c-8c13-851afa069c27': 'other_description',
    '4dff0112-96c9-4127-a134-27efbce2008d': 'sale_price',
    'fade37c4-9dfb-4074-8535-58bdf6148cae': 'source_of_funds',
    '2ea350f7-d5fa-4e97-9e06-e7967b15a52f': 'emd_amount',
    'bad6fc9f-c2d5-4827-a9a9-1196e8fa6a44': 'emd_escrow',
    'b343c22d-28c7-4046-ab0c-69590eb7ede7': 'due_diligence_days',
    'ced6eb96-d950-452e-94c8-8fbfc2fb7b55': 'acceptance_deadline',
    '4b75fdaf-82cc-4ad8-913a-569f65320ffa': 'closing_date',
    'd59e1770-3c0a-4505-aa3b-b10d3e4cdd91': 'closing_location',
    'c9713fb8-8e08-4e10-aa1b-d9d0aa61998a': 'buyer_print_name',
    '5fc4619a-1e7e-4567-9ada-9e80359bc02e': 'buyer_signature',
    'd0c126b8-41a2-493d-a6cd-971cded65b4d': 'seller1_print_name',
    'aa27587d-5a15-4380-b527-6fb38d71ee5d': 'seller1_signature',
    '1bcf2bbe-584d-4c06-804c-306b5233e03e': 'seller2_print_name',
    'd051017e-4c01-40b9-85ad-b5a28bfdabe4': 'seller2_signature',
}

ASSIGNMENT_MAP = {
    '9e3621f7-5f21-42ff-b8b2-ed1f50f970d5': 'property_address',
    'f6d0cee2-6fea-4916-93b4-859511de43a7': 'agreement_day',
    '01b99f9c-9095-49b8-a10d-6691deb23a6a': 'agreement_month',
    '976d2a97-9117-4cce-afba-93a9de0ce175': 'agreement_year',
    '245c907a-4fc7-43e0-9795-401448b96808': 'assignor_name',
    '203c7262-5b0f-4aa2-99e5-e77dea388934': 'assignee_name',
    '2b5b2f24-f753-471a-885f-b4ba30c04273': 'assignor_name_whereas',
    '1650357b-a228-4160-9ab8-03bd4fa1637e': 'original_seller_name',
    'b0809259-03cc-45eb-b91a-657986cff846': 'original_psa_day',
    '471f4f22-e69b-4fa6-9a24-50fd838d8624': 'original_psa_month',
    '36157409-b219-4454-8595-c5b316f228dd': 'original_psa_year',
    'd7f4ebb9-9e9d-4341-8477-607a3f8438e3': 'assignment_fee',
    'ad2e15fe-5190-402d-b43f-7280b6a3cc77': 'nonrefundable_deposit',
    'f5a2d32d-982a-4306-8fd3-11d901b0845d': 'closing_day',
    '61a7d183-f767-4ee1-9865-c120b879b8c8': 'closing_month',
    'c9eafd72-80ee-4ae7-8bce-25e8198bd3f7': 'closing_year',
    '0653251b-c663-474c-b2f2-98d4f545f96d': 'additional_terms_1',
    '5e8cb2d4-960b-4d10-adf5-3dbcbe580e53': 'additional_terms_2',
    '8d0e8e1c-9bc6-4e37-ac05-9c0cda091d0f': 'additional_terms_3',
    'c8fc1bea-e8c2-4641-ac12-210a321667c9': 'additional_terms_4',
    '065e64c6-42b5-4e40-b8a4-063b2768b8df': 'additional_terms_5',
    'b620e507-a924-4420-bc58-4a7587a3ff26': 'additional_terms_6',
    '4c6f82b4-11fb-46dc-8654-86d6f8bd2d2b': 'assignor_signature',
    '01a69580-919c-473d-9eed-3025d666e486': 'assignor_signature_date',
    '301ea831-b358-4f42-9603-8ccc3c9c64b2': 'assignor_print_name',
    'ed0e5afa-5977-4bca-8aaa-5084e12e9161': 'assignee_signature',
    'fe9a714f-2109-464b-a75e-b1319f42ec87': 'assignee_signature_date',
    '9b075076-8ff6-451a-b920-708afc664176': 'assignee_print_name',
}

def update_template(template_id, uuid_to_name, current_file):
    print(f"\n--- Updating template {template_id} ---")
    with open(current_file) as f:
      tpl = json.load(f)
    
    # Build the new fields list - keep all existing properties, just set the name
    new_fields = []
    for fld in tpl['fields']:
        new_fld = dict(fld)
        if fld['uuid'] in uuid_to_name:
            new_fld['name'] = uuid_to_name[fld['uuid']]
        new_fields.append(new_fld)
    
    body = {'fields': new_fields}
    payload = json.dumps(body).encode()
    
    req = urllib.request.Request(
        f"https://api.docuseal.com/templates/{template_id}",
        data=payload,
        method='PUT',
        headers={
            'X-Auth-Token': KEY,
            'Content-Type': 'application/json',
        }
    )
    try:
        resp = urllib.request.urlopen(req).read().decode()
        print(f"  ✓ PUT succeeded (response size: {len(resp)} bytes)")
        return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ PUT failed: {e.code} {e.reason}")
        print(f"  body: {e.read().decode()[:500]}")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

ok1 = update_template(3718826, PURCHASE_MAP, '/tmp/template_purchase.json'  # produced by the verify step above)
ok2 = update_template(3706747, ASSIGNMENT_MAP, '/tmp/template_assignment.json'  # produced by the verify step above)

print(f"\nResult: purchase={ok1}, assignment={ok2}")
