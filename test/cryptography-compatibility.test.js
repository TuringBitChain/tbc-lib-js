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
