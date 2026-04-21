'use strict'

// BIP327 MuSig2 over secp256k1.
// Works on plain 33-byte compressed public keys; the final aggregate key is
// emitted as a 32-byte x-only pubkey compatible with lib/crypto/schnorr.js.
// This implementation does NOT support tweaks (taproot or plain); add them
// later by extending keyAggCtx with {gacc, tacc}.

var BN = require('./bn')
var Hash = require('./hash')
var Random = require('./random')
var Schnorr = require('./schnorr')
var EC = require('elliptic').ec
var ec = new EC('secp256k1')
var curve = ec.curve
var G = curve.g
var n = curve.n
var p = curve.p

var taggedHash = Schnorr.taggedHash

// ---------- byte/point helpers ----------

function toBuf32 (bn) {
  return bn.toArrayLike(Buffer, 'be', 32)
}

function intMod (buf) {
  return new BN(buf).umod(n)
}

function hasEvenY (P) {
  return !P.getY().isOdd()
}

function xOnlyFromPoint (P) {
  return toBuf32(P.getX().umod(p))
}

function cbytes (P) {
  if (P.isInfinity()) throw new Error('cbytes: infinity')
  var prefix = P.getY().isOdd() ? 0x03 : 0x02
  return Buffer.concat([Buffer.from([prefix]), toBuf32(P.getX().umod(p))])
}

function cbytesExt (P) {
  if (P === null || P.isInfinity()) return Buffer.alloc(33, 0)
  return cbytes(P)
}

function cpoint (buf33) {
  if (!Buffer.isBuffer(buf33) || buf33.length !== 33) throw new Error('cpoint: length')
  var prefix = buf33[0]
  if (prefix !== 0x02 && prefix !== 0x03) throw new Error('cpoint: prefix')
  var x = new BN(buf33.slice(1))
  if (x.gte(p)) throw new Error('cpoint: x>=p')
  try {
    return curve.pointFromX(x, prefix === 0x03)
  } catch (e) {
    throw new Error('cpoint: not on curve')
  }
}

function cpointExt (buf33) {
  if (buf33.length === 33 && buf33.equals(Buffer.alloc(33, 0))) return null // infinity
  return cpoint(buf33)
}

function pointAdd (A, B) {
  if (A === null) return B
  if (B === null) return A
  var S = A.add(B)
  return S.isInfinity() ? null : S
}

function pointMul (P, k) {
  if (P === null) return null
  var R = P.mul(k)
  return R.isInfinity() ? null : R
}

// Derive the 33-byte compressed pubkey from a 32-byte private key.
function pubkeyFromSk (sk32) {
  if (!Buffer.isBuffer(sk32) || sk32.length !== 32) throw new Error('pubkeyFromSk: sk length')
  var d = new BN(sk32)
  if (d.isZero() || d.gte(n)) throw new Error('pubkeyFromSk: sk out of range')
  return cbytes(G.mul(d))
}

// ---------- key aggregation ----------

function keySort (pubkeys33) {
  return pubkeys33.slice().sort(Buffer.compare)
}

function hashKeys (pubkeys33) {
  return taggedHash('KeyAgg list', Buffer.concat(pubkeys33))
}

function getSecondKey (pubkeys33) {
  for (var i = 1; i < pubkeys33.length; i++) {
    if (!pubkeys33[i].equals(pubkeys33[0])) return pubkeys33[i]
  }
  return Buffer.alloc(33, 0)
}

function keyAggCoeff (pk33, secondKey33, L) {
  var zero33 = Buffer.alloc(33, 0)
  if (!secondKey33.equals(zero33) && pk33.equals(secondKey33)) {
    return new BN(1)
  }
  return intMod(taggedHash('KeyAgg coefficient', Buffer.concat([L, pk33])))
}

function keyAgg (pubkeys33) {
  if (!Array.isArray(pubkeys33) || pubkeys33.length === 0) {
    throw new Error('keyAgg: empty pubkey list')
  }
  for (var i = 0; i < pubkeys33.length; i++) {
    if (!Buffer.isBuffer(pubkeys33[i]) || pubkeys33[i].length !== 33) {
      throw new Error('keyAgg: pubkeys must be 33-byte compressed')
    }
  }
  var L = hashKeys(pubkeys33)
  var secondKey = getSecondKey(pubkeys33)
  var Q = null
  var coefs = []
  for (i = 0; i < pubkeys33.length; i++) {
    var P = cpoint(pubkeys33[i])
    var a = keyAggCoeff(pubkeys33[i], secondKey, L)
    coefs.push(a)
    Q = pointAdd(Q, pointMul(P, a))
  }
  if (Q === null) throw new Error('keyAgg: Q is point at infinity')
  return {
    Q: Q,
    // BIP327: KeyAgg initializes gacc=1 and tacc=0. Parity adjustment is
    // applied in sign/verify via `g = has_even_y(Q) ? 1 : -1`.
    gacc: new BN(1),
    tacc: new BN(0),
    L: L,
    pubkeys: pubkeys33.map(function (b) { return Buffer.from(b) }),
    coefs: coefs
  }
}

function getAggPubkey (keyAggCtx) {
  return xOnlyFromPoint(keyAggCtx.Q)
}

// ---------- nonce generation & aggregation ----------

function u8 (x) { return Buffer.from([x & 0xff]) }

function u32BE (x) {
  var b = Buffer.alloc(4)
  b.writeUInt32BE(x >>> 0, 0)
  return b
}

function u64BE (x) {
  var hi = Math.floor(x / 0x100000000)
  var lo = x >>> 0
  var b = Buffer.alloc(8)
  b.writeUInt32BE(hi, 0)
  b.writeUInt32BE(lo, 4)
  return b
}

// nonceGen({pk: Buffer(33), sk?: Buffer(32), aggpk?: Buffer(32), msg?: Buffer, extra?: Buffer})
// Returns { secnonce: Buffer(97), pubnonce: Buffer(66) }.
function nonceGen (opts) {
  opts = opts || {}
  var pk33 = opts.pk
  if (!Buffer.isBuffer(pk33) || pk33.length !== 33) {
    throw new Error('nonceGen: pk must be 33-byte compressed')
  }
  var rand = Random.getRandomBuffer(32)
  var randPrime = rand
  if (opts.sk) {
    if (!Buffer.isBuffer(opts.sk) || opts.sk.length !== 32) {
      throw new Error('nonceGen: sk length')
    }
    var auxH = taggedHash('MuSig/aux', rand)
    randPrime = Buffer.alloc(32)
    for (var i = 0; i < 32; i++) randPrime[i] = opts.sk[i] ^ auxH[i]
  }
  var aggpk = opts.aggpk || Buffer.alloc(0)
  if (!Buffer.isBuffer(aggpk)) throw new Error('nonceGen: aggpk type')
  if (aggpk.length !== 0 && aggpk.length !== 32) throw new Error('nonceGen: aggpk must be 32 bytes or empty')

  var msg = opts.msg
  var msgField
  if (msg == null) {
    msgField = u8(0)
  } else {
    if (!Buffer.isBuffer(msg)) throw new Error('nonceGen: msg type')
    msgField = Buffer.concat([u8(1), u64BE(msg.length), msg])
  }
  var extra = opts.extra || Buffer.alloc(0)
  if (!Buffer.isBuffer(extra)) throw new Error('nonceGen: extra type')
  if (extra.length > 0xffffffff) throw new Error('nonceGen: extra too long')

  var pkField = Buffer.concat([u8(pk33.length), pk33])
  var aggpkField = Buffer.concat([u8(aggpk.length), aggpk])
  var extraField = Buffer.concat([u32BE(extra.length), extra])

  var k = [null, null]
  for (var idx = 0; idx < 2; idx++) {
    var data = Buffer.concat([
      randPrime,
      pkField,
      aggpkField,
      msgField,
      extraField,
      u8(idx)
    ])
    var h = taggedHash('MuSig/nonce', data)
    k[idx] = intMod(h)
    if (k[idx].isZero()) throw new Error('nonceGen: k is zero')
  }
  var R1 = G.mul(k[0])
  var R2 = G.mul(k[1])
  var pubnonce = Buffer.concat([cbytes(R1), cbytes(R2)])
  var secnonce = Buffer.concat([toBuf32(k[0]), toBuf32(k[1]), pk33])
  return { secnonce: secnonce, pubnonce: pubnonce }
}

function nonceAgg (pubnonces) {
  if (!Array.isArray(pubnonces) || pubnonces.length === 0) {
    throw new Error('nonceAgg: empty')
  }
  var R1 = null
  var R2 = null
  for (var i = 0; i < pubnonces.length; i++) {
    var pn = pubnonces[i]
    if (!Buffer.isBuffer(pn) || pn.length !== 66) {
      throw new Error('nonceAgg: pubnonce must be 66 bytes')
    }
    R1 = pointAdd(R1, cpoint(pn.slice(0, 33)))
    R2 = pointAdd(R2, cpoint(pn.slice(33, 66)))
  }
  return Buffer.concat([cbytesExt(R1), cbytesExt(R2)])
}

// ---------- session & partial signing ----------

function buildSession (keyAggCtx, aggnonce66, msg32) {
  if (!Buffer.isBuffer(aggnonce66) || aggnonce66.length !== 66) {
    throw new Error('buildSession: aggnonce')
  }
  if (!Buffer.isBuffer(msg32) || msg32.length !== 32) {
    throw new Error('buildSession: msg must be 32 bytes')
  }
  var QxOnly = xOnlyFromPoint(keyAggCtx.Q)
  var b = intMod(taggedHash('MuSig/noncecoef',
    Buffer.concat([aggnonce66, QxOnly, msg32])))
  var R1ext = cpointExt(aggnonce66.slice(0, 33))
  var R2ext = cpointExt(aggnonce66.slice(33, 66))
  var bR2 = pointMul(R2ext, b)
  var Rtmp = pointAdd(R1ext, bR2)
  var R = Rtmp === null ? G : Rtmp // BIP327 fallback
  var RxOnly = xOnlyFromPoint(R)
  var e = intMod(taggedHash('BIP0340/challenge',
    Buffer.concat([RxOnly, QxOnly, msg32])))
  return {
    keyAggCtx: keyAggCtx,
    aggnonce: aggnonce66,
    msg: msg32,
    b: b,
    R: R,
    RxOnly: RxOnly,
    e: e
  }
}

function findCoef (keyAggCtx, pk33) {
  for (var i = 0; i < keyAggCtx.pubkeys.length; i++) {
    if (keyAggCtx.pubkeys[i].equals(pk33)) return keyAggCtx.coefs[i]
  }
  throw new Error('signer not in key set')
}

function partialSign (secnonce97, sk32, session) {
  if (!Buffer.isBuffer(secnonce97) || secnonce97.length !== 97) {
    throw new Error('partialSign: secnonce')
  }
  if (!Buffer.isBuffer(sk32) || sk32.length !== 32) {
    throw new Error('partialSign: sk length')
  }
  var k1p = new BN(secnonce97.slice(0, 32))
  var k2p = new BN(secnonce97.slice(32, 64))
  if (k1p.isZero() || k1p.gte(n) || k2p.isZero() || k2p.gte(n)) {
    throw new Error('partialSign: k out of range')
  }
  var k1, k2
  if (hasEvenY(session.R)) { k1 = k1p; k2 = k2p }
  else { k1 = n.sub(k1p); k2 = n.sub(k2p) }

  var dp = new BN(sk32)
  if (dp.isZero() || dp.gte(n)) throw new Error('partialSign: sk out of range')
  var P = G.mul(dp)
  var pkStored = secnonce97.slice(64, 97)
  if (!cbytes(P).equals(pkStored)) throw new Error('partialSign: pk mismatch')
  var a = findCoef(session.keyAggCtx, pkStored)
  var g = hasEvenY(session.keyAggCtx.Q) ? new BN(1) : n.sub(new BN(1))
  var d = g.mul(session.keyAggCtx.gacc).umod(n).mul(dp).umod(n)
  var s = k1
    .add(session.b.mul(k2).umod(n))
    .umod(n)
    .add(session.e.mul(a).umod(n).mul(d).umod(n))
    .umod(n)
  return toBuf32(s)
}

function partialVerify (psig32, pubnonce66, pk33, session) {
  if (!Buffer.isBuffer(psig32) || psig32.length !== 32) return false
  var s = new BN(psig32)
  if (s.gte(n)) return false
  var Ri1 = cpoint(pubnonce66.slice(0, 33))
  var Ri2 = cpoint(pubnonce66.slice(33, 66))
  var Ri2b = Ri2.mul(session.b)
  var Rstar
  if (hasEvenY(session.R)) Rstar = Ri1.add(Ri2b)
  else Rstar = Ri1.neg().add(Ri2b.neg())
  var P = cpoint(pk33)
  var a = findCoef(session.keyAggCtx, pk33)
  var g = hasEvenY(session.keyAggCtx.Q) ? new BN(1) : n.sub(new BN(1))
  var Peff = P.mul(g.mul(session.keyAggCtx.gacc).umod(n))
  var left = G.mul(s)
  var right = Rstar.add(Peff.mul(session.e.mul(a).umod(n)))
  return left.eq(right)
}

function partialSigAgg (psigs32, session) {
  if (!Array.isArray(psigs32) || psigs32.length === 0) {
    throw new Error('partialSigAgg: empty')
  }
  var s = new BN(0)
  for (var i = 0; i < psigs32.length; i++) {
    var psig = psigs32[i]
    if (!Buffer.isBuffer(psig) || psig.length !== 32) {
      throw new Error('partialSigAgg: psig length')
    }
    var si = new BN(psig)
    if (si.gte(n)) throw new Error('partialSigAgg: psig out of range')
    s = s.add(si).umod(n)
  }
  // tacc = 0 without tweaks; no adjustment.
  return Buffer.concat([session.RxOnly, toBuf32(s)])
}

module.exports = {
  // key aggregation
  keySort: keySort,
  keyAgg: keyAgg,
  getAggPubkey: getAggPubkey,
  pubkeyFromSk: pubkeyFromSk,
  // nonce lifecycle
  nonceGen: nonceGen,
  nonceAgg: nonceAgg,
  // session & signing
  buildSession: buildSession,
  partialSign: partialSign,
  partialVerify: partialVerify,
  partialSigAgg: partialSigAgg
}
