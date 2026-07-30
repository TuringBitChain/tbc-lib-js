# Cryptography Dependency Security Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the known `elliptic` and `bn.js` vulnerabilities while preserving all valid public cryptographic and transaction behavior.

**Architecture:** Keep the existing SDK architecture and public exports. Upgrade the exact external dependencies, apply only the upstream canonical-zero invariant fix to the vendored BN copy, and protect both the security boundary and valid output compatibility with Node built-in tests.

**Tech Stack:** CommonJS, Node.js built-in `node:test` and `assert`, npm lockfile, `elliptic`, `bn.js`

## Global Constraints

- Use exact dependency versions `elliptic@6.6.1` and `bn.js@4.12.3`.
- Do not change contract APIs, transaction formats, fee behavior, address encoding, signature formats, or exported class names.
- Apply only the upstream zero-width mask fix to vendored `lib/bn.js`; do not replace the vendored implementation.
- Tests must not perform network requests or transaction broadcasts.
- Fixed-vector signatures and transaction IDs must remain byte-for-byte identical.

---

### Task 1: Vendored BN Security Regression

**Files:**
- Create: `test/security-regressions.test.js`
- Modify: `lib/bn.js:2097-2119`

**Interfaces:**
- Consumes: exported `tbc.crypto.BN`
- Produces: canonical zero from `new BN(1).maskn(0)`

- [ ] **Step 1: Install the current dependency graph for the red test**

Run:

```bash
npm install --ignore-scripts
```

Expected: current vulnerable versions are installed and a lockfile is generated.

- [ ] **Step 2: Write the failing vendored BN test**

```js
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
```

- [ ] **Step 3: Run the focused test to verify it fails**

Run:

```bash
node --test --test-name-pattern='vendored BN' test/security-regressions.test.js
```

Expected: FAIL because `maskn(0)` leaves `length === 0` and `isZero()` false.

- [ ] **Step 4: Apply the minimal upstream invariant fix**

Add before `return this.strip()` in `BN.prototype.imaskn`:

```js
if (this.length === 0) {
  this.words[0] = 0
  this.length = 1
}
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```bash
node --test --test-name-pattern='vendored BN' test/security-regressions.test.js
```

Expected: PASS with one test and zero failures.

- [ ] **Step 6: Commit the vendored BN fix**

```bash
git add lib/bn.js test/security-regressions.test.js package-lock.json
git commit -m "fix: preserve canonical BN zero after masking"
```

### Task 2: Vulnerable Dependency Upgrade

**Files:**
- Modify: `package.json:28-40`
- Modify: `package-lock.json`
- Modify: `test/security-regressions.test.js`

**Interfaces:**
- Consumes: npm dependency resolution
- Produces: `elliptic@6.6.1`, `bn.js@4.12.3`, and rejection of malformed negative signing inputs

- [ ] **Step 1: Add failing dependency security tests**

Append:

```js
test('resolved cryptography dependencies contain the security fixes', () => {
  const zero = new tbc.deps.bnjs(1).maskn(0)

  assert.equal(zero.isZero(), true)
  assert.equal(zero.toString(10), '0')
})

test('elliptic rejects a malformed negative ECDSA signing message', () => {
  const EC = require('elliptic').ec
  const ec = new EC('secp256k1')
  const privateKey = Buffer.alloc(32, 1)

  assert.throws(
    () => ec.sign(`-${'01'.repeat(32)}`, privateKey),
    /negative message/
  )
})
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
node --test --test-name-pattern='dependencies|malformed negative' test/security-regressions.test.js
```

Expected: FAIL because the current external BN produces a corrupt zero and the old elliptic signer accepts the malformed input.

- [ ] **Step 3: Update exact dependency versions**

Change `package.json` dependencies to:

```json
"bn.js": "4.12.3",
"elliptic": "6.6.1"
```

- [ ] **Step 4: Regenerate dependency resolution**

Run:

```bash
npm install --ignore-scripts
```

Expected: `package-lock.json` resolves direct `elliptic@6.6.1` and `bn.js@4.12.3`.

- [ ] **Step 5: Run all security regression tests**

Run:

```bash
node --test test/security-regressions.test.js
```

Expected: three tests pass with zero failures.

- [ ] **Step 6: Commit the dependency upgrade**

```bash
git add package.json package-lock.json test/security-regressions.test.js
git commit -m "fix: upgrade vulnerable cryptography dependencies"
```

### Task 3: Valid-Behavior Compatibility Regression

**Files:**
- Create: `test/cryptography-compatibility.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: public `tbc-lib-js` exports
- Produces: deterministic compatibility coverage for ECDSA, Schnorr, MuSig2, addresses, transactions, and serialization

- [ ] **Step 1: Add fixed-vector compatibility tests**

Create `test/cryptography-compatibility.test.js`:

```js
'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const tbc = require('..')

const privateKeyBytes = Buffer.alloc(32)
privateKeyBytes[31] = 1
const privateKey = tbc.PrivateKey.fromBuffer(privateKeyBytes)
const hash = tbc.crypto.Hash.sha256(
  Buffer.from('tbc-lib-js compatibility')
)

test('ECDSA and address output remain byte-for-byte compatible', () => {
  const signature = tbc.crypto.ECDSA.sign(hash, privateKey)

  assert.equal(
    privateKey.toAddress().toString(),
    '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm'
  )
  assert.equal(
    signature.toDER().toString('hex'),
    '3045022100fbf6337d0bd4a34ffef0ff9022671c44a5741008b89aab95f00dee7e8ecde4af02200c94e09beed7d6fdba42ca1040f801815d58ecc63077be9638be5ce16ff159c4'
  )
  assert.equal(
    tbc.crypto.ECDSA.verify(hash, signature, privateKey.publicKey),
    true
  )
})

test('Schnorr output remains byte-for-byte compatible', () => {
  const signature = tbc.crypto.Schnorr.sign(
    hash,
    privateKeyBytes,
    Buffer.alloc(32, 7)
  )

  assert.equal(
    signature.toString('hex'),
    'b3e0042ae56ff76ead7da8387e0dd1c1e68870f24f8514e248cdc405db6d74a6f193bbf091fdd564e7522e329586fb16ee651f3b7d1eec1917cfbde4f0eed937'
  )
  assert.equal(
    tbc.crypto.Schnorr.verify(
      hash,
      signature,
      privateKey.publicKey.toXOnly()
    ),
    true
  )
})

test('MuSig2 partial and aggregate signatures remain valid', () => {
  const secondPrivateKeyBytes = Buffer.alloc(32)
  secondPrivateKeyBytes[31] = 2
  const musig = tbc.crypto.MuSig2
  const firstPublicKey = musig.pubkeyFromSk(privateKeyBytes)
  const secondPublicKey = musig.pubkeyFromSk(secondPrivateKeyBytes)
  const publicKeys = musig.keySort([firstPublicKey, secondPublicKey])
  const keyContext = musig.keyAgg(publicKeys)
  const aggregatePublicKey = musig.getAggPubkey(keyContext)
  const firstNonce = musig.nonceGen({
    pk: firstPublicKey,
    sk: privateKeyBytes,
    aggpk: aggregatePublicKey,
    msg: hash
  })
  const secondNonce = musig.nonceGen({
    pk: secondPublicKey,
    sk: secondPrivateKeyBytes,
    aggpk: aggregatePublicKey,
    msg: hash
  })
  const session = musig.buildSession(
    keyContext,
    musig.nonceAgg([firstNonce.pubnonce, secondNonce.pubnonce]),
    hash
  )
  const firstPartial = musig.partialSign(
    firstNonce.secnonce,
    privateKeyBytes,
    session
  )
  const secondPartial = musig.partialSign(
    secondNonce.secnonce,
    secondPrivateKeyBytes,
    session
  )

  assert.equal(
    musig.partialVerify(
      firstPartial,
      firstNonce.pubnonce,
      firstPublicKey,
      session
    ),
    true
  )
  assert.equal(
    musig.partialVerify(
      secondPartial,
      secondNonce.pubnonce,
      secondPublicKey,
      session
    ),
    true
  )
  assert.equal(
    tbc.crypto.Schnorr.verify(
      hash,
      musig.partialSigAgg([firstPartial, secondPartial], session),
      aggregatePublicKey
    ),
    true
  )
})

test('P2PKH transaction serialization retains its txid', () => {
  const address = privateKey.toAddress()
  const lockingScript = tbc.Script.buildPublicKeyHashOut(address)
  const transaction = new tbc.Transaction()
    .from({
      txid: '11'.repeat(32),
      vout: 0,
      scriptPubKey: lockingScript.toHex(),
      satoshis: 100000
    })
    .to(address, 50000)
    .change(address)
    .fee(80)
    .sign(privateKey)

  assert.equal(transaction.isFullySigned(), true)
  assert.equal(
    transaction.id,
    'b8433a7d63510c884209465f1496cb1d26391f06478637fb1ddf30ba71b1d073'
  )
  assert.equal(
    new tbc.Transaction(transaction.serialize()).id,
    transaction.id
  )
})
```

- [ ] **Step 2: Add the npm test command**

Add to `package.json`:

```json
"scripts": {
  "test": "node --no-deprecation --test"
}
```

- [ ] **Step 3: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all security and compatibility tests pass.

- [ ] **Step 4: Run dependency and package verification**

Run:

```bash
npm ls --all
npm audit --omit=dev
npm pack --dry-run
git diff --check
```

Expected:

- dependency tree is valid;
- the two targeted advisories are absent;
- the package includes runtime files and excludes unrelated artifacts;
- no whitespace errors are reported.

- [ ] **Step 5: Commit compatibility coverage**

```bash
git add package.json package-lock.json test/cryptography-compatibility.test.js
git commit -m "test: cover cryptography upgrade compatibility"
```
