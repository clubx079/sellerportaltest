import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setPendingSignup, getPendingSignup, deletePendingSignup } from './pendingSignupStore.js'

test('setPendingSignup then getPendingSignup returns the stored data', () => {
  setPendingSignup('a@example.com', { email: 'a@example.com', phone: '(555) 111-2222', password_hash: 'xyz' })
  const got = getPendingSignup('a@example.com')
  assert.equal(got.email, 'a@example.com')
  assert.equal(got.phone, '(555) 111-2222')
  assert.equal(got.password_hash, 'xyz')
})

test('getPendingSignup returns null for an unknown email', () => {
  assert.equal(getPendingSignup('missing@example.com'), null)
})

test('deletePendingSignup removes the record', () => {
  setPendingSignup('b@example.com', { email: 'b@example.com' })
  assert.ok(getPendingSignup('b@example.com'))
  deletePendingSignup('b@example.com')
  assert.equal(getPendingSignup('b@example.com'), null)
})
