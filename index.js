'use strict'

var tbc = module.exports

// module information
tbc.version = 'v' + require('./package.json').version
tbc.versionGuard = function (version) {
  if (version !== undefined) {
    var message = `
      More than one instance of tbc found.
      Please make sure to require tbc and check that submodules do
      not also include their own tbc dependency.`
    console.warn(message)
  }
}
tbc.versionGuard(globalThis._bsv)
globalThis._bsv = tbc.version

// crypto
tbc.crypto = {}
tbc.crypto.BN = require('./lib/crypto/bn')
tbc.crypto.ECDSA = require('./lib/crypto/ecdsa')
tbc.crypto.Hash = require('./lib/crypto/hash')
tbc.crypto.Random = require('./lib/crypto/random')
tbc.crypto.Point = require('./lib/crypto/point')
tbc.crypto.Signature = require('./lib/crypto/signature')

// encoding
tbc.encoding = {}
tbc.encoding.Base58 = require('./lib/encoding/base58')
tbc.encoding.Base58Check = require('./lib/encoding/base58check')
tbc.encoding.BufferReader = require('./lib/encoding/bufferreader')
tbc.encoding.BufferWriter = require('./lib/encoding/bufferwriter')
tbc.encoding.Varint = require('./lib/encoding/varint')

// utilities
tbc.util = {}
tbc.util.js = require('./lib/util/js')
tbc.util.preconditions = require('./lib/util/preconditions')

// errors thrown by the library
tbc.errors = require('./lib/errors')

// dependencies, subject to change
tbc.deps = {}
tbc.deps.bnjs = require('bn.js')
tbc.deps.bs58 = require('bs58')
tbc.deps.Buffer = Buffer
tbc.deps.elliptic = require('elliptic')
tbc.deps._ = require('./lib/util/_')

// main bitcoin library
tbc.Address = require('./lib/address')
tbc.Block = require('./lib/block')
tbc.MerkleBlock = require('./lib/block/merkleblock')
tbc.BlockHeader = require('./lib/block/blockheader')
tbc.HDPrivateKey = require('./lib/hdprivatekey.js')
tbc.HDPublicKey = require('./lib/hdpublickey.js')
tbc.Networks = require('./lib/networks')
tbc.Opcode = require('./lib/opcode')
tbc.PrivateKey = require('./lib/privatekey')
tbc.PublicKey = require('./lib/publickey')
tbc.Script = require('./lib/script')
tbc.Transaction = require('./lib/transaction')
tbc.ECIES = require('./lib/ecies')
tbc.HashCache = require('./lib/hash-cache')
tbc.Mnemonic = require('./lib/mnemonic/mnemonic.js')
tbc.Message = require('./lib/message/message.js')
tbc.FT = require('./lib/contract/ft.js')
tbc.NFT = require('./lib/contract/nft.js')
tbc.Multisig = require('./lib/contract/multiSig.js')
tbc.poolNFT = require('./lib/contract/poolNFT.js')


// Internal usage, exposed for testing/advanced tweaking
tbc.Transaction.sighash = require('./lib/transaction/sighash')
