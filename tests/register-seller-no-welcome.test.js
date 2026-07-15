import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(
  join(here, '..', 'app', 'api', 'auth', 'register-seller', 'route.js'),
  'utf8',
)

test('register-seller does not trigger the welcome at signup', () => {
  assert.ok(!/seller_welcome/.test(src), 'must not reference seller_welcome')
  assert.ok(!/enrollAutomation/.test(src), 'must not call enrollAutomation')
  assert.ok(!/emailSellerWelcome/.test(src), 'must not send the welcome directly')
})

test('register-seller destructures phone from the request body', () => {
  assert.match(
    src,
    /const\s*\{[^}]*\bphone\b[^}]*\}\s*=\s*await\s+request\.json\(\)/,
    'handler should destructure phone from the JSON request body',
  )
})
