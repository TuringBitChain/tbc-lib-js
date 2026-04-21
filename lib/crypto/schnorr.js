'use strict'

// BIP340 Schnorr signatures over secp256k1.
// TBC node verification path (see TBCNODE x_only_pubkey.cpp / secp256k1_schnorrsig)
// accepts exactly this scheme: 32-byte x-only pubkey, 64-byte signature (r||s).

var BN = require('./bn')
var Hash = require('./hash')
var Random = require('./random')
var EC = require('elliptic').ec
var ec = new EC('secp256k1')
var curve = ec.curve
var G = curve.g
var n = curve.n
var p = curve.p

function bnToBuf32 (bn) {
  var b = bn.toArrayLike(Buffer, 'be', 32)
  return b
}

function taggedHash (tag, data) {
  var tagHash = Hash.sha256(Buffer.from(tag, 'utf8'))
  return Hash.sha256(Buffer.concat([tagHash, tagHash, data]))
}

function liftX (xBuf) {
  var x = new BN(xBuf)
  if (x.gte(p)) return null
  // y^2 = x^3 + 7 mod p; pick even y.
  var point
  try {
    // elliptic's pointFromX(x, odd=false) gives even-y point.
    point = curve.pointFromX(x, false)
  } catch (e) {
    return null
  }
  return point
}

function pointToXBuf (P) {
  return bnToBuf32(P.getX().umod(p))
}

function hasEvenY (P) {
  return !P.getY().isOdd()
}

function sign (msg32, privKey32, aux32) {
  if (!Buffer.isBuffer(msg32) || msg32.length !== 32) throw new Error('msg must be 32 bytes')
  if (!Buffer.isBuffer(privKey32) || privKey32.length !== 32) throw new Error('privKey must be 32 bytes')
  var d0 = new BN(privKey32)
  if (d0.isZero() || d0.gte(n)) throw new Error('invalid private key')

  var P = G.mul(d0)
  var d = hasEvenY(P) ? d0 : n.sub(d0)

  if (!aux32) aux32 = Random.getRandomBuffer(32)
  if (aux32.length !== 32) throw new Error('aux must be 32 bytes')

  var t = Buffer.alloc(32)
  var dBuf = bnToBuf32(d)
  var auxHash = taggedHash('BIP0340/aux', aux32)
  for (var i = 0; i < 32; i++) t[i] = dBuf[i] ^ auxHash[i]

  var Pxb = pointToXBuf(P)
  var kHash = taggedHash('BIP0340/nonce', Buffer.concat([t, Pxb, msg32]))
  var kPrime = new BN(kHash).umod(n)
  if (kPrime.isZero()) throw new Error('kPrime is zero')

  var R = G.mul(kPrime)
  var k = hasEvenY(R) ? kPrime : n.sub(kPrime)

  var Rxb = pointToXBuf(R)
  var eHash = taggedHash('BIP0340/challenge', Buffer.concat([Rxb, Pxb, msg32]))
  var e = new BN(eHash).umod(n)

  var s = k.add(e.mul(d)).umod(n)
  var sig = Buffer.concat([Rxb, bnToBuf32(s)])

  if (!verify(msg32, sig, Pxb)) throw new Error('signing produced invalid signature')
  return sig
}

function verify (msg32, sig64, xOnlyPub32) {
  if (!Buffer.isBuffer(msg32) || msg32.length !== 32) return false
  if (!Buffer.isBuffer(sig64) || sig64.length !== 64) return false
  if (!Buffer.isBuffer(xOnlyPub32) || xOnlyPub32.length !== 32) return false

  var P = liftX(xOnlyPub32)
  if (!P) return false

  var r = new BN(sig64.slice(0, 32))
  var s = new BN(sig64.slice(32, 64))
  if (r.gte(p)) return false
  if (s.gte(n)) return false

  var eHash = taggedHash('BIP0340/challenge', Buffer.concat([sig64.slice(0, 32), xOnlyPub32, msg32]))
  var e = new BN(eHash).umod(n)

  // R = s*G - e*P
  var sG = G.mul(s)
  var eP = P.mul(e)
  var R = sG.add(eP.neg())
  if (R.isInfinity()) return false
  if (!hasEvenY(R)) return false
  if (!R.getX().umod(p).eq(r)) return false
  return true
}

module.exports = {
  sign: sign,
  verify: verify,
  taggedHash: taggedHash,
  liftX: liftX
}
