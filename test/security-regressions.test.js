'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const tbc = require('..')

test('vendored BN maskn(0) returns a canonical usable zero', () => {
  const zero = new tbc.crypto.BN(1).maskn(0)

  assert.equal(zero.isZero(), true)
  assert.equal(zero.length, 1)
  assert.equal(zero.words[0], 0)
  assert.equal(zero.toString(10), '0')
  assert.equal(zero.add(new tbc.crypto.BN(2)).toString(10), '2')
})
