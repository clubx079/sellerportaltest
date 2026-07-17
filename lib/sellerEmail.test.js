import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailVerificationCodeOnboarding } from './sellerEmail.js'

test('emailVerificationCodeOnboarding returns a subject and html containing the code', () => {
  const { subject, html } = emailVerificationCodeOnboarding({ code: '482913' })
  assert.match(subject, /verification code/i)
  assert.ok(html.includes('482913'), 'html must contain the 6-digit code')
  assert.match(html, /DeelMap/)
})
