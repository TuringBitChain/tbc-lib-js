# Cryptography Dependency Security Fix Design

## Goal

Remove the known `elliptic@6.5.4` and `bn.js@4.11.9` vulnerabilities from
`tbc-lib-js` without changing its public API or the output of valid ECDSA,
Schnorr, MuSig2, address, and transaction operations.

## Scope

- Upgrade the direct `elliptic` dependency to `6.6.1`.
- Upgrade the direct `bn.js` dependency to `4.12.3`.
- Apply the upstream `bn.js@4.12.3` zero-width mask fix to the vendored
  `lib/bn.js` implementation.
- Add security regression and cryptographic compatibility tests using Node's
  built-in test runner.

The fix does not change contract APIs, transaction formats, fee behavior,
address encoding, signature formats, or exported class names.

## Considered Approaches

### 1. Minimal upstream-compatible patch (selected)

Upgrade the two dependencies and copy only the upstream `maskn(0)` invariant
fix into the vendored BN implementation.

This has the smallest behavior surface and preserves all valid cryptographic
outputs. It also avoids coupling the SDK's internal BN wrapper to a new module
layout.

### 2. Remove the vendored BN implementation

Replace `lib/bn.js` with the npm `bn.js` package and keep the extensions in
`lib/crypto/bn.js`.

This removes duplicated code, but changes a foundational type used throughout
transactions and scripts. It requires a much broader compatibility audit and
is outside this security patch.

### 3. Replace `elliptic`

Move all elliptic-curve operations to the native `secp256k1` package or another
maintained implementation.

This may be desirable later, but it would change Point, Schnorr, MuSig2, and
browser behavior simultaneously. It is not appropriate for a minimal patch.

## Implementation

### Dependency updates

`package.json` will use exact versions:

- `elliptic`: `6.6.1`
- `bn.js`: `4.12.3`

The repository intentionally excludes package-manager lockfiles because it is
a published library. The two security-sensitive dependencies therefore remain
exact versions in `package.json`; a locally generated ignored lockfile may be
used during verification but will not be committed.

### Vendored BN fix

When `imaskn(0)` reduces a positive number, the current vendored code produces
an invalid BN with `length === 0`. The patch will restore the canonical zero
invariant:

```js
if (this.length === 0) {
  this.words[0] = 0
  this.length = 1
}
```

No other vendored BN changes will be included.

### Tests

The repository will use `node --test` with focused regression tests:

1. Vendored `BN.maskn(0)` returns canonical zero and remains usable by
   `toString()` and arithmetic.
2. The resolved dependency versions are `elliptic@6.6.1` and `bn.js@4.12.3`.
3. `elliptic` rejects the malformed negative-string signing input covered by
   the security advisory.
4. Fixed-vector ECDSA and Schnorr outputs remain byte-for-byte identical.
5. MuSig2 aggregation and partial signatures verify.
6. A signed P2PKH transaction retains its expected txid after serialization
   and parsing.

## Error Handling and Compatibility

Valid 32-byte signing inputs retain their existing behavior. Malformed or
non-canonical inputs that vulnerable `elliptic` versions accepted may now be
rejected; that is the intended security boundary.

The security tests will use fixed private keys only as deterministic test
vectors. They will not perform network requests or broadcasts.

## Success Criteria

- Security regression tests fail on the current code before implementation.
- All regression tests pass after the minimal patch.
- Fixed valid signatures, address, serialized transaction, and txid match the
  pre-upgrade values.
- `npm audit --omit=dev` no longer reports the fixed `elliptic` private-key
  extraction advisory or the `bn.js` infinite-loop advisory.
- The working tree contains no unrelated changes.
