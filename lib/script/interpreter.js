'use strict'

var _ = require('../util/_')
var partial_sha256 = require('../util/partial-sha256')
var BufferWriter = require('../encoding/bufferwriter')
var Script = require('./script')
var Opcode = require('../opcode')
var BN = require('../crypto/bn')
var Hash = require('../crypto/hash')
var Signature = require('../crypto/signature')
var PublicKey = require('../publickey')
var Stack = require('./stack')
/**
 * Bitcoin transactions contain scripts. Each input has a script called the
 * scriptSig, and each output has a script called the scriptPubkey. To validate
 * an input, the input's script is concatenated with the referenced output script,
 * and the result is executed. If at the end of execution the stack contains a
 * "true" value, then the transaction is valid.
 *
 * The primary way to use this class is via the verify function.
 * e.g., Interpreter().verify( ... );
 */
var Interpreter = function Interpreter(obj) {
  if (!(this instanceof Interpreter)) {
    return new Interpreter(obj)
  }
  if (obj) {
    this.initialize()
    this.set(obj)
  } else {
    this.initialize()
  }
}

/**
 * Verifies a Script by executing it and returns true if it is valid.
 * This function needs to be provided with the scriptSig and the scriptPubkey
 * separately.
 * @param {Script} scriptSig - the script's first part (corresponding to the tx input)
 * @param {Script} scriptPubkey - the script's last part (corresponding to the tx output)
 * @param {Transaction=} tx - the Transaction containing the scriptSig in one input (used
 *    to check signature validity for some opcodes like OP_CHECKSIG)
 * @param {number} nin - index of the transaction input containing the scriptSig verified.
 * @param {number} flags - evaluation flags. See Interpreter.SCRIPT_* constants
 * @param {number} satoshisBN - amount in satoshis of the input to be verified (when FORKID signhash is used)
 *
 * Translated from bitcoind's VerifyScript
 */
Interpreter.prototype.verify = function (scriptSig, scriptPubkey, tx, nin, flags, satoshisBN, sighashScript) {
  var Transaction = require('../transaction')

  if (_.isUndefined(tx)) {
    tx = new Transaction()
  }
  if (_.isUndefined(nin)) {
    nin = 0
  }
  if (_.isUndefined(flags)) {
    flags = 0
  }

  // If FORKID is enabled, we also ensure strict encoding.
  if (flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID) {
    flags |= Interpreter.SCRIPT_VERIFY_STRICTENC

    // If FORKID is enabled, we need the input amount.
    if (!satoshisBN) {
      throw new Error('internal error - need satoshisBN to verify FORKID transactions')
    }
  }

  this.set({
    script: scriptSig,
    tx: tx,
    nin: nin,
    flags: flags,
    satoshisBN: satoshisBN,
    sighashScript: sighashScript
  })
  var stackCopy

  if ((flags & Interpreter.SCRIPT_VERIFY_SIGPUSHONLY) !== 0 && !scriptSig.isPushOnly()) {
    this.errstr = 'SCRIPT_ERR_SIG_PUSHONLY'
    return false
  }

  // evaluate scriptSig
  if (!this.evaluate('scriptSig')) {
    return false
  }

  if (flags & Interpreter.SCRIPT_VERIFY_P2SH) {
    stackCopy = this.stack.copy()
  }

  var stack = this.stack
  this.initialize()
  this.set({
    script: scriptPubkey,
    stack: stack,
    tx: tx,
    nin: nin,
    flags: flags,
    satoshisBN: satoshisBN,
    sighashScript: sighashScript
  })

  // evaluate scriptPubkey
  if (!this.evaluate('scriptPubkey')) {
    return false
  }

  if (this.stack.length === 0) {
    this.errstr = 'SCRIPT_ERR_EVAL_FALSE_NO_RESULT'
    return false
  }

  var buf = this.stack.stacktop(-1)
  if (!Interpreter.castToBool(buf)) {
    this.errstr = 'SCRIPT_ERR_EVAL_FALSE_IN_STACK'
    return false
  }

  // Additional validation for spend-to-script-hash transactions:
  if ((flags & Interpreter.SCRIPT_VERIFY_P2SH) && scriptPubkey.isScriptHashOut()) {
    // scriptSig must be literals-only or validation fails
    if (!scriptSig.isPushOnly()) {
      this.errstr = 'SCRIPT_ERR_SIG_PUSHONLY'
      return false
    }

    // stackCopy cannot be empty here, because if it was the
    // P2SH  HASH <> EQUAL  scriptPubKey would be evaluated with
    // an empty stack and the EvalScript above would return false.
    if (stackCopy.length === 0) {
      throw new Error('internal error - stack copy empty')
    }

    var redeemScriptSerialized = stackCopy.stacktop(-1)
    var redeemScript = Script.fromBuffer(redeemScriptSerialized)
    stackCopy.pop()

    this.initialize()
    this.set({
      script: redeemScript,
      stack: stackCopy,
      tx: tx,
      nin: nin,
      flags: flags,
      satoshisBN: satoshisBN
    })

    // evaluate redeemScript
    if (!this.evaluate()) {
      return false
    }

    if (stackCopy.length === 0) {
      this.errstr = 'SCRIPT_ERR_EVAL_FALSE_NO_P2SH_STACK'
      return false
    }

    if (!Interpreter.castToBool(stackCopy.stacktop(-1))) {
      this.errstr = 'SCRIPT_ERR_EVAL_FALSE_IN_P2SH_STACK'
      return false
    }
  }

  // The CLEANSTACK check is only performed after potential P2SH evaluation,
  // as the non-P2SH evaluation of a P2SH script will obviously not result in
  // a clean stack (the P2SH inputs remain). The same holds for witness
  // evaluation.
  if ((flags & Interpreter.SCRIPT_VERIFY_CLEANSTACK) !== 0) {
    // Disallow CLEANSTACK without P2SH, as otherwise a switch
    // CLEANSTACK->P2SH+CLEANSTACK would be possible, which is not a
    // softfork (and P2SH should be one).
    // if ((flags & Interpreter.SCRIPT_VERIFY_P2SH) === 0) {
    //   throw new Error('internal error - CLEANSTACK without P2SH')
    // }

    if (this.stack.length !== 1) {
      this.errstr = 'SCRIPT_ERR_CLEANSTACK'
      return false
    }
  }

  return true
}

module.exports = Interpreter

Interpreter.prototype.initialize = function (obj) {
  this.stack = new Stack([])
  this.altstack = new Stack([])
  this.pc = 0
  this.pbegincodehash = 0
  this.nOpCount = 0
  this.vfExec = []
  this.errstr = ''
  this.flags = 0
  // if OP_RETURN is found in executed branches after genesis is activated,
  // we still have to check if the rest of the script is valid
  this.nonTopLevelReturnAfterGenesis = false
  this.returned = false
}

Interpreter.prototype.set = function (obj) {
  this.script = obj.script || this.script
  this.tx = obj.tx || this.tx
  this.nin = typeof obj.nin !== 'undefined' ? obj.nin : this.nin
  this.satoshisBN = obj.satoshisBN || this.satoshisBN
  this.stack = obj.stack || this.stack
  this.altstack = obj.altstack || this.altstack
  this.pc = typeof obj.pc !== 'undefined' ? obj.pc : this.pc
  this.pbegincodehash = typeof obj.pbegincodehash !== 'undefined' ? obj.pbegincodehash : this.pbegincodehash
  this.nOpCount = typeof obj.nOpCount !== 'undefined' ? obj.nOpCount : this.nOpCount
  this.vfExec = obj.vfExec || this.vfExec
  this.errstr = obj.errstr || this.errstr
  this.flags = typeof obj.flags !== 'undefined' ? obj.flags : this.flags
  this.sighashScript = obj.sighashScript || this.sighashScript
}

Interpreter.prototype.subscript = function () {
  if (this.sighashScript) {
    return this.sighashScript.clone()
  } else {
    // Subset of script starting at the most recent codeseparator
    // CScript scriptCode(pbegincodehash, pend);
    return Script.fromChunks(this.script.chunks.slice(this.pbegincodehash))
  }
}

Interpreter.getTrue = () => Buffer.from([1])
Interpreter.getFalse = () => Buffer.from([])

Interpreter.MAX_SCRIPT_ELEMENT_SIZE = 520
Interpreter.MAXIMUM_ELEMENT_SIZE = 4

Interpreter.LOCKTIME_THRESHOLD = 500000000
Interpreter.LOCKTIME_THRESHOLD_BN = new BN(Interpreter.LOCKTIME_THRESHOLD)

// flags taken from bitcoind
// bitcoind commit: b5d1b1092998bc95313856d535c632ea5a8f9104
Interpreter.SCRIPT_VERIFY_NONE = 0

// Evaluate P2SH subscripts (softfork safe, BIP16).
Interpreter.SCRIPT_VERIFY_P2SH = (1 << 0)

// Passing a non-strict-DER signature or one with undefined hashtype to a checksig operation causes script failure.
// Passing a pubkey that is not (0x04 + 64 bytes) or (0x02 or 0x03 + 32 bytes) to checksig causes that pubkey to be
// skipped (not softfork safe: this flag can widen the validity of OP_CHECKSIG OP_NOT).
Interpreter.SCRIPT_VERIFY_STRICTENC = (1 << 1)

// Passing a non-strict-DER signature to a checksig operation causes script failure (softfork safe, BIP62 rule 1)
Interpreter.SCRIPT_VERIFY_DERSIG = (1 << 2)

// Passing a non-strict-DER signature or one with S > order/2 to a checksig operation causes script failure
// (softfork safe, BIP62 rule 5).
Interpreter.SCRIPT_VERIFY_LOW_S = (1 << 3)

// verify dummy stack item consumed by CHECKMULTISIG is of zero-length (softfork safe, BIP62 rule 7).
Interpreter.SCRIPT_VERIFY_NULLDUMMY = (1 << 4)

// Using a non-push operator in the scriptSig causes script failure (softfork safe, BIP62 rule 2).
Interpreter.SCRIPT_VERIFY_SIGPUSHONLY = (1 << 5)

// Require minimal encodings for all push operations (OP_0... OP_16, OP_1NEGATE where possible, direct
// pushes up to 75 bytes, OP_PUSHDATA up to 255 bytes, OP_PUSHDATA2 for anything larger). Evaluating
// any other push causes the script to fail (BIP62 rule 3).
// In addition, whenever a stack element is interpreted as a number, it must be of minimal length (BIP62 rule 4).
// (softfork safe)
Interpreter.SCRIPT_VERIFY_MINIMALDATA = (1 << 6)

// Discourage use of NOPs reserved for upgrades (NOP1-10)
//
// Provided so that nodes can avoid accepting or mining transactions
// containing executed NOP's whose meaning may change after a soft-fork,
// thus rendering the script invalid; with this flag set executing
// discouraged NOPs fails the script. This verification flag will never be
// a mandatory flag applied to scripts in a block. NOPs that are not
// executed, e.g.  within an unexecuted IF ENDIF block, are *not* rejected.
Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS = (1 << 7)

// Require that only a single stack element remains after evaluation. This
// changes the success criterion from "At least one stack element must
// remain, and when interpreted as a boolean, it must be true" to "Exactly
// one stack element must remain, and when interpreted as a boolean, it must
// be true".
// (softfork safe, BIP62 rule 6)
// Note: CLEANSTACK should never be used without P2SH or WITNESS.
Interpreter.SCRIPT_VERIFY_CLEANSTACK = (1 << 8)

// CLTV See BIP65 for details.
Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY = (1 << 9)

// support CHECKSEQUENCEVERIFY opcode
//
// See BIP112 for details
Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY = (1 << 10)

// Segwit script only: Require the argument of OP_IF/NOTIF to be exactly
// 0x01 or empty vector
//
Interpreter.SCRIPT_VERIFY_MINIMALIF = (1 << 13)

// Signature(s) must be empty vector if an CHECK(MULTI)SIG operation failed
//
Interpreter.SCRIPT_VERIFY_NULLFAIL = (1 << 14)

// Public keys in scripts must be compressed
Interpreter.SCRIPT_VERIFY_COMPRESSED_PUBKEYTYPE = (1 << 15)

// Do we accept signature using SIGHASH_FORKID
//
Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID = (1 << 16)

// Do we accept activate replay protection using a different fork id.
//
Interpreter.SCRIPT_ENABLE_REPLAY_PROTECTION = (1 << 17)

// Enable new opcodes.
//
Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES = (1 << 18)

// Are the Magnetic upgrade opcodes enabled?
//
Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES = (1 << 19)

/* Below flags apply in the context of BIP 68 */
/**
 * If this flag set, CTxIn::nSequence is NOT interpreted as a relative
 * lock-time.
 */
Interpreter.SEQUENCE_LOCKTIME_DISABLE_FLAG = (1 << 31)

/**
 * If CTxIn::nSequence encodes a relative lock-time and this flag is set,
 * the relative lock-time has units of 512 seconds, otherwise it specifies
 * blocks with a granularity of 1.
 */
Interpreter.SEQUENCE_LOCKTIME_TYPE_FLAG = (1 << 22)

/**
 * If CTxIn::nSequence encodes a relative lock-time, this mask is applied to
 * extract that lock-time from the sequence field.
 */
Interpreter.SEQUENCE_LOCKTIME_MASK = 0x0000ffff

Interpreter.MAX_SCRIPT_SIZE = Number.MAX_SAFE_INTEGER

Interpreter.MAX_OPCODE_COUNT = Number.MAX_SAFE_INTEGER

Interpreter.DEFAULT_FLAGS =
  // Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CLEANSTACK | // no longer applies now p2sh is deprecated: cleanstack only applies to p2sh
  Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES | // TODO: to be removed after upgrade to tbc 2.0
  Interpreter.SCRIPT_VERIFY_STRICTENC |
  Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | Interpreter.SCRIPT_VERIFY_LOW_S | Interpreter.SCRIPT_VERIFY_NULLFAIL |
  Interpreter.SCRIPT_VERIFY_DERSIG |
  Interpreter.SCRIPT_VERIFY_MINIMALDATA | Interpreter.SCRIPT_VERIFY_NULLDUMMY |
  Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS |
  Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY | Interpreter.SCRIPT_VERIFY_CLEANSTACK

Interpreter.castToBool = function (buf) {
  for (var i = 0; i < buf.length; i++) {
    if (buf[i] !== 0) {
      // can be negative zero
      if (i === buf.length - 1 && buf[i] === 0x80) {
        return false
      }
      return true
    }
  }
  return false
}

/**
 * Translated from bitcoind's CheckSignatureEncoding
 */
Interpreter.prototype.checkSignatureEncoding = function (buf) {
  var sig

  // Empty signature. Not strictly DER encoded, but allowed to provide a
  // compact way to provide an invalid signature for use with CHECK(MULTI)SIG
  if (buf.length === 0) {
    return true
  }

  if ((this.flags & (Interpreter.SCRIPT_VERIFY_DERSIG | Interpreter.SCRIPT_VERIFY_LOW_S | Interpreter.SCRIPT_VERIFY_STRICTENC)) !== 0 && !Signature.isTxDER(buf)) {
    this.errstr = 'SCRIPT_ERR_SIG_DER_INVALID_FORMAT'
    return false
  } else if ((this.flags & Interpreter.SCRIPT_VERIFY_LOW_S) !== 0) {
    sig = Signature.fromTxFormat(buf)
    if (!sig.hasLowS()) {
      this.errstr = 'SCRIPT_ERR_SIG_DER_HIGH_S'
      return false
    }
  } else if ((this.flags & Interpreter.SCRIPT_VERIFY_STRICTENC) !== 0) {
    sig = Signature.fromTxFormat(buf)
    if (!sig.hasDefinedHashtype()) {
      this.errstr = 'SCRIPT_ERR_SIG_HASHTYPE'
      return false
    }

    if (!(this.flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID) &&
      (sig.nhashtype & Signature.SIGHASH_FORKID)) {
      this.errstr = 'SCRIPT_ERR_ILLEGAL_FORKID'
      return false
    }

    if ((this.flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID) &&
      !(sig.nhashtype & Signature.SIGHASH_FORKID)) {
      this.errstr = 'SCRIPT_ERR_MUST_USE_FORKID'
      return false
    }
  }

  return true
}

/**
 * Translated from bitcoind's CheckPubKeyEncoding
 */
Interpreter.prototype.checkPubkeyEncoding = function (buf) {
  if ((this.flags & Interpreter.SCRIPT_VERIFY_STRICTENC) !== 0 && !PublicKey.isValid(buf)) {
    this.errstr = 'SCRIPT_ERR_PUBKEYTYPE'
    return false
  }
  return true
}

/**
  *
  * Check the buffer is minimally encoded (see https://github.com/bitcoincashorg/spec/blob/master/may-2018-reenabled-opcodes.md#op_bin2num)
  *
  *
  */

Interpreter._isMinimallyEncoded = function (buf, nMaxNumSize) {
  nMaxNumSize = nMaxNumSize || Interpreter.MAXIMUM_ELEMENT_SIZE
  if (buf.length > nMaxNumSize) {
    return false
  }

  if (buf.length > 0) {
    // Check that the number is encoded with the minimum possible number
    // of bytes.
    //
    // If the most-significant-byte - excluding the sign bit - is zero
    // then we're not minimal. Note how this test also rejects the
    // negative-zero encoding, 0x80.
    if ((buf[buf.length - 1] & 0x7f) === 0) {
      // One exception: if there's more than one byte and the most
      // significant bit of the second-most-significant-byte is set it
      // would conflict with the sign bit. An example of this case is
      // +-255, which encode to 0xff00 and 0xff80 respectively.
      // (big-endian).
      if (buf.length <= 1 || (buf[buf.length - 2] & 0x80) === 0) {
        return false
      }
    }
  }
  return true
}

/**
  *
  * minimally encode the buffer content
  *
  * @param {number} nMaxNumSize (max allowed size)
  */
Interpreter._minimallyEncode = function (buf) {
  if (buf.length === 0) {
    return buf
  }

  // If the last byte is not 0x00 or 0x80, we are minimally encoded.
  var last = buf[buf.length - 1]
  if (last & 0x7f) {
    return buf
  }

  // If the script is one byte long, then we have a zero, which encodes as an
  // empty array.
  if (buf.length === 1) {
    return Buffer.from('')
  }

  // If the next byte has it sign bit set, then we are minimaly encoded.
  if (buf[buf.length - 2] & 0x80) {
    return buf
  }

  // We are not minimally encoded, we need to figure out how much to trim.
  for (var i = buf.length - 1; i > 0; i--) {
    // We found a non zero byte, time to encode.
    if (buf[i - 1] !== 0) {
      if (buf[i - 1] & 0x80) {
        // We found a byte with it sign bit set so we need one more
        // byte.
        buf[i++] = last
      } else {
        // the sign bit is clear, we can use it.
        buf[i - 1] |= last
      }

      return buf.slice(0, i)
    }
  }

  // If we found the whole thing is zeros, then we have a zero.
  return Buffer.from('')
}

/**
 * Based on bitcoind's EvalScript function, with the inner loop moved to
 * Interpreter.prototype.step()
 * bitcoind commit: b5d1b1092998bc95313856d535c632ea5a8f9104
 */
Interpreter.prototype.evaluate = function (scriptType) {
  // TODO: script size should be configurable. no magic numbers
  if (this.script.toBuffer().length > Interpreter.MAX_SCRIPT_SIZE) {
    this.errstr = 'SCRIPT_ERR_SCRIPT_SIZE'
    return false
  }

  try {
    while (!this.returned && this.pc < this.script.chunks.length) {
      // fExec: if the opcode will be executed, i.e., not in a false branch
      let thisStep = { pc: this.pc, fExec: (this.vfExec.indexOf(false) === -1), opcode: Opcode.fromNumber(this.script.chunks[this.pc].opcodenum) }

      var fSuccess = this.step(scriptType)

      this._callbackStep(thisStep)

      if (!fSuccess) {
        return false
      }
    }

    // Size limits
    if (this.stack.length + this.altstack.length > 1000) {
      this.errstr = 'SCRIPT_ERR_STACK_SIZE'
      return false
    }
  } catch (e) {
    this.errstr = 'SCRIPT_ERR_UNKNOWN_ERROR: ' + e
    return false
  }

  if (this.vfExec.length > 0) {
    this.errstr = 'SCRIPT_ERR_UNBALANCED_CONDITIONAL'
    return false
  }

  return true
}

Interpreter.prototype._callbackStep = function (thisStep) {
  if (typeof this.stepListener === 'function') {
    try {
      this.stepListener(thisStep)
    } catch (err) {
      console.log(`Error in Step callback:${err}`)
    }
  }
}

/**
 * call to update stackvar
 * @param {*} stack
 */
Interpreter.prototype._callbackStack = function (stack, pc, scriptType) {
  if (typeof this.stackListener === 'function') {
    try {
      this.stackListener(stack, pc, scriptType)
    } catch (err) {
      var chunk = this.script.chunks[pc]
      console.error(`Error: ${err} in _updateStack pc: ${pc}, opcode ${Opcode.fromNumber(chunk.opcodenum).toSafeString()}`)
    }
  }
}

/**
 * Checks a locktime parameter with the transaction's locktime.
 * There are two times of nLockTime: lock-by-blockheight and lock-by-blocktime,
 * distinguished by whether nLockTime < LOCKTIME_THRESHOLD = 500000000
 *
 * See the corresponding code on bitcoin core:
 * https://github.com/bitcoin/bitcoin/blob/ffd75adce01a78b3461b3ff05bcc2b530a9ce994/src/script/interpreter.cpp#L1129
 *
 * @param {BN} nLockTime the locktime read from the script
 * @return {boolean} true if the transaction's locktime is less than or equal to
 *                   the transaction's locktime
 */
Interpreter.prototype.checkLockTime = function (nLockTime) {
  // We want to compare apples to apples, so fail the script
  // unless the type of nLockTime being tested is the same as
  // the nLockTime in the transaction.
  if (!(
    (this.tx.nLockTime < Interpreter.LOCKTIME_THRESHOLD && nLockTime.lt(Interpreter.LOCKTIME_THRESHOLD_BN)) ||
    (this.tx.nLockTime >= Interpreter.LOCKTIME_THRESHOLD && nLockTime.gte(Interpreter.LOCKTIME_THRESHOLD_BN))
  )) {
    return false
  }

  // Now that we know we're comparing apples-to-apples, the
  // comparison is a simple numeric one.
  if (nLockTime.gt(new BN(this.tx.nLockTime))) {
    return false
  }

  // Finally the nLockTime feature can be disabled and thus
  // CHECKLOCKTIMEVERIFY bypassed if every txin has been
  // finalized by setting nSequence to maxint. The
  // transaction would be allowed into the blockchain, making
  // the opcode ineffective.
  //
  // Testing if this vin is not final is sufficient to
  // prevent this condition. Alternatively we could test all
  // inputs, but testing just this input minimizes the data
  // required to prove correct CHECKLOCKTIMEVERIFY execution.
  if (this.tx.inputs[this.nin].isFinal()) {
    return false
  }

  return true
}

/**
 * Checks a sequence parameter with the transaction's sequence.
 * @param {BN} nSequence the sequence read from the script
 * @return {boolean} true if the transaction's sequence is less than or equal to
 *                   the transaction's sequence
 */
Interpreter.prototype.checkSequence = function (nSequence) {
  // Relative lock times are supported by comparing the passed in operand to
  // the sequence number of the input.
  var txToSequence = this.tx.inputs[this.nin].sequenceNumber

  // Fail if the transaction's version number is not set high enough to
  // trigger BIP 68 rules.
  if (this.tx.version < 2) {
    return false
  }

  // Sequence numbers with their most significant bit set are not consensus
  // constrained. Testing that the transaction's sequence number do not have
  // this bit set prevents using this property to get around a
  // CHECKSEQUENCEVERIFY check.
  if (txToSequence & Interpreter.SEQUENCE_LOCKTIME_DISABLE_FLAG) {
    return false
  }

  // Mask off any bits that do not have consensus-enforced meaning before
  // doing the integer comparisons
  var nLockTimeMask =
    Interpreter.SEQUENCE_LOCKTIME_TYPE_FLAG | Interpreter.SEQUENCE_LOCKTIME_MASK
  var txToSequenceMasked = new BN(txToSequence & nLockTimeMask)
  var nSequenceMasked = nSequence.and(nLockTimeMask)

  // There are two kinds of nSequence: lock-by-blockheight and
  // lock-by-blocktime, distinguished by whether nSequenceMasked <
  // CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG.
  //
  // We want to compare apples to apples, so fail the script unless the type
  // of nSequenceMasked being tested is the same as the nSequenceMasked in the
  // transaction.
  var SEQUENCE_LOCKTIME_TYPE_FLAG_BN = new BN(Interpreter.SEQUENCE_LOCKTIME_TYPE_FLAG)

  if (!((txToSequenceMasked.lt(SEQUENCE_LOCKTIME_TYPE_FLAG_BN) &&
    nSequenceMasked.lt(SEQUENCE_LOCKTIME_TYPE_FLAG_BN)) ||
    (txToSequenceMasked.gte(SEQUENCE_LOCKTIME_TYPE_FLAG_BN) &&
      nSequenceMasked.gte(SEQUENCE_LOCKTIME_TYPE_FLAG_BN)))) {
    return false
  }

  // Now that we know we're comparing apples-to-apples, the comparison is a
  // simple numeric one.
  if (nSequenceMasked.gt(txToSequenceMasked)) {
    return false
  }
  return true
}

function padBufferToSize(buf, len) {
  let b = buf
  while (b.length < len) {
    b = Buffer.concat([Buffer.from([0x00]), b])
  }
  return b
}

/**
 * Based on the inner loop of bitcoind's EvalScript function
 * bitcoind commit: b5d1b1092998bc95313856d535c632ea5a8f9104
 */
Interpreter.prototype.step = function (scriptType) {
  var self = this

  function stacktop(i) {
    return self.stack.stacktop(i)
  }

  function vartop(i) {
    return self.stack.vartop(i)
  }

  function isOpcodeDisabled(opcode) {
    switch (opcode) {
      case Opcode.OP_2MUL:
      case Opcode.OP_2DIV:

        // Disabled opcodes.
        return true

      case Opcode.OP_INVERT:
      case Opcode.OP_MUL:
      case Opcode.OP_LSHIFT:
      case Opcode.OP_RSHIFT:
        // Opcodes that have been reenabled.
        if ((self.flags & Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES) === 0) {
          return true
        }
        break
      case Opcode.OP_DIV:
      case Opcode.OP_MOD:
      case Opcode.OP_SPLIT:
      case Opcode.OP_CAT:
      case Opcode.OP_AND:
      case Opcode.OP_OR:
      case Opcode.OP_XOR:
      case Opcode.OP_BIN2NUM:
      case Opcode.OP_NUM2BIN:
        // Opcodes that have been reenabled.
        if ((self.flags & Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES) === 0) {
          return true
        }
        break
      default:
        break
    }

    return false
  }

  var fRequireMinimal = (this.flags & Interpreter.SCRIPT_VERIFY_MINIMALDATA) !== 0

  // bool fExec = !count(vfExec.begin(), vfExec.end(), false);

  var buf, buf1, buf2, spliced, n, x1, x2, bn, bn1, bn2, bufSig, bufPubkey, subscript
  var sig, pubkey
  var fValue, fSuccess
  var var1, var2, var3

  // Read instruction
  var chunk = this.script.chunks[this.pc]
  this.pc++
  var opcodenum = chunk.opcodenum
  if (_.isUndefined(opcodenum)) {
    this.errstr = 'SCRIPT_ERR_UNDEFINED_OPCODE'
    return false
  }
  if (chunk.buf && chunk.buf.length > Interpreter.MAX_SCRIPT_ELEMENT_SIZE) {
    this.errstr = 'SCRIPT_ERR_PUSH_SIZE'
    return false
  }

  // Do not execute instructions if Genesis OP_RETURN was found in executed branches.
  var fExec = (this.vfExec.indexOf(false) === -1) && (!this.nonTopLevelReturnAfterGenesis || opcodenum === Opcode.OP_RETURN)

  // Note how Opcode.OP_RESERVED does not count towards the opcode limit.
  if (opcodenum > Opcode.OP_16 && ++(this.nOpCount) > Interpreter.MAX_OPCODE_COUNT) {
    this.errstr = 'SCRIPT_ERR_OP_COUNT'
    return false
  }

  if (isOpcodeDisabled(opcodenum)) {
    this.errstr = 'SCRIPT_ERR_DISABLED_OPCODE'
    return false
  }

  if (fExec && opcodenum >= 0 && opcodenum <= Opcode.OP_PUSHDATA4) {
    if (fRequireMinimal && !this.script.checkMinimalPush(this.pc - 1)) {
      this.errstr = 'SCRIPT_ERR_MINIMALDATA'
      return false
    }
    if (!chunk.buf) {
      this.stack.push(Interpreter.getFalse())
    } else if (chunk.len !== chunk.buf.length) {
      throw new Error(`Length of push value not equal to length of data (${chunk.len},${chunk.buf.length})`)
    } else {
      this.stack.push(chunk.buf)
    }
  } else if (fExec || (Opcode.OP_IF <= opcodenum && opcodenum <= Opcode.OP_ENDIF)) {
    switch (opcodenum) {
      // Push value
      case Opcode.OP_1NEGATE:
      case Opcode.OP_1:
      case Opcode.OP_2:
      case Opcode.OP_3:
      case Opcode.OP_4:
      case Opcode.OP_5:
      case Opcode.OP_6:
      case Opcode.OP_7:
      case Opcode.OP_8:
      case Opcode.OP_9:
      case Opcode.OP_10:
      case Opcode.OP_11:
      case Opcode.OP_12:
      case Opcode.OP_13:
      case Opcode.OP_14:
      case Opcode.OP_15:
      case Opcode.OP_16:
        // ( -- value)
        // ScriptNum bn((int)opcode - (int)(Opcode.OP_1 - 1));
        n = opcodenum - (Opcode.OP_1 - 1)
        buf = new BN(n).toScriptNumBuffer()
        this.stack.push(buf)
        // The result of these opcodes should always be the minimal way to push the data
        // they push, so no need for a CheckMinimalPush here.
        break

      //
      // Control
      //
      case Opcode.OP_NOP:
        break

      case Opcode.OP_NOP2:
      case Opcode.OP_CHECKLOCKTIMEVERIFY:

        if (!(this.flags & Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY)) {
          // not enabled; treat as a NOP2
          if (this.flags & Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS) {
            this.errstr = 'SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS'
            return false
          }
          break
        }

        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        // Note that elsewhere numeric opcodes are limited to
        // operands in the range -2**31+1 to 2**31-1, however it is
        // legal for opcodes to produce results exceeding that
        // range. This limitation is implemented by CScriptNum's
        // default 4-byte limit.
        //
        // If we kept to that limit we'd have a year 2038 problem,
        // even though the nLockTime field in transactions
        // themselves is uint32 which only becomes meaningless
        // after the year 2106.
        //
        // Thus as a special case we tell CScriptNum to accept up
        // to 5-byte bignums, which are good until 2**39-1, well
        // beyond the 2**32-1 limit of the nLockTime field itself.
        var nLockTime = BN.fromScriptNumBuffer(this.stack.stacktop(-1), fRequireMinimal, 5)

        // In the rare event that the argument may be < 0 due to
        // some arithmetic being done first, you can always use
        // 0 MAX CHECKLOCKTIMEVERIFY.
        if (nLockTime.lt(new BN(0))) {
          this.errstr = 'SCRIPT_ERR_NEGATIVE_LOCKTIME'
          return false
        }

        // Actually compare the specified lock time with the transaction.
        if (!this.checkLockTime(nLockTime)) {
          this.errstr = 'SCRIPT_ERR_UNSATISFIED_LOCKTIME'
          return false
        }
        break

      case Opcode.OP_NOP3:
      case Opcode.OP_CHECKSEQUENCEVERIFY:

        if (!(this.flags & Interpreter.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)) {
          // not enabled; treat as a NOP3
          if (this.flags & Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS) {
            this.errstr = 'SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS'
            return false
          }
          break
        }

        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        // nSequence, like nLockTime, is a 32-bit unsigned
        // integer field. See the comment in CHECKLOCKTIMEVERIFY
        // regarding 5-byte numeric operands.

        var nSequence = BN.fromScriptNumBuffer(stacktop(-1), fRequireMinimal, 5)

        // In the rare event that the argument may be < 0 due to
        // some arithmetic being done first, you can always use
        // 0 MAX CHECKSEQUENCEVERIFY.
        if (nSequence.lt(new BN(0))) {
          this.errstr = 'SCRIPT_ERR_NEGATIVE_LOCKTIME'
          return false
        }

        // To provide for future soft-fork extensibility, if the
        // operand has the disabled lock-time flag set,
        // CHECKSEQUENCEVERIFY behaves as a NOP.
        if ((nSequence &
          Interpreter.SEQUENCE_LOCKTIME_DISABLE_FLAG) !== 0) {
          break
        }

        // Actually compare the specified lock time with the transaction.
        if (!this.checkSequence(nSequence)) {
          this.errstr = 'SCRIPT_ERR_UNSATISFIED_LOCKTIME'
          return false
        }
        break

      case Opcode.OP_NOP1:
      case Opcode.OP_NOP4:
      case Opcode.OP_NOP5:
      case Opcode.OP_NOP6:
      case Opcode.OP_NOP7:
      case Opcode.OP_NOP8:
      case Opcode.OP_NOP9:
      case Opcode.OP_NOP10:
        if (this.flags & Interpreter.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS) {
          this.errstr = 'SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS'
          return false
        }
        break

      case Opcode.OP_PUSH_META:
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_UNBALANCED_CONDITIONAL'
          return false
        }
        buf = stacktop(-1)
        if (buf.length === 1 && (buf[0] < 1 || buf[0] > 7)) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        this.stack.pop()
        switch (buf[0]) {
          case 1: {
            var versionBuffer = Buffer.alloc(4)
            versionBuffer.writeUInt32LE(this.tx.version, 0)
            this.stack.push(versionBuffer)
            break
          }
          case 2: {
            var nLockTimeBuffer = Buffer.alloc(4)
            nLockTimeBuffer.writeUInt32LE(this.tx.nLockTime, 0)
            this.stack.push(nLockTimeBuffer)
            break
          }
          case 3: {
            var inputsLengthBuffer = Buffer.alloc(4)
            inputsLengthBuffer.writeUInt32LE(this.tx.inputs.length, 0)
            this.stack.push(inputsLengthBuffer)
            break
          }
          case 4: {
            var outputsLengthBuffer = Buffer.alloc(4)
            outputsLengthBuffer.writeUInt32LE(this.tx.outputs.length, 0)
            this.stack.push(outputsLengthBuffer)
            break
          }
          case 5: {
            var inputsCombinedBuffers = []
            for (const input of this.tx.inputs) {
              inputsCombinedBuffers.push(Buffer.from(input.prevTxId, 'hex').reverse())
              var outputIndexBuffer = Buffer.alloc(4)
              outputIndexBuffer.writeUInt32LE(input.outputIndex, 0)
              inputsCombinedBuffers.push(outputIndexBuffer)
              var sequenceNumberBuffer = Buffer.alloc(4)
              sequenceNumberBuffer.writeUInt32LE(input.sequenceNumber, 0)
              inputsCombinedBuffers.push(sequenceNumberBuffer)
            }
            var combinedInputsBuffer = Buffer.concat(inputsCombinedBuffers)
            var inputsHash = Hash.sha256(combinedInputsBuffer)
            this.stack.push(inputsHash)
            break;
          }
          case 6: {
            var resultArray = []
            resultArray.push(Buffer.from(this.tx.inputs[this.nin].prevTxId).reverse().toString('hex'))
            var outputIndexBuffer = Buffer.alloc(4)
            outputIndexBuffer.writeUInt32LE(this.tx.inputs[this.nin].outputIndex, 0)
            resultArray.push(outputIndexBuffer.toString('hex'))
            var sequenceNumberBuffer = Buffer.alloc(4)
            sequenceNumberBuffer.writeUInt32LE(this.tx.inputs[this.nin].sequenceNumber, 0)
            resultArray.push(sequenceNumberBuffer.toString('hex'))
            var resultString = resultArray.join('')
            var resultBuffer = Buffer.from(resultString, 'hex')
            this.stack.push(resultBuffer)
            break
          }
          case 7: {
            var OutputsCombinedBuffers = []
            for (const output of this.tx.outputs) {
              var satoshisBuffer = Buffer.alloc(8)
              satoshisBuffer.writeBigUInt64LE(BigInt(output.satoshis), 0)
              OutputsCombinedBuffers.push(satoshisBuffer)
              OutputsCombinedBuffers.push(Hash.sha256(output.script.toBuffer()))
            }
            var combinedOutputsBuffer = Buffer.concat(OutputsCombinedBuffers)
            var OutputsHash = Hash.sha256(combinedOutputsBuffer)
            this.stack.push(OutputsHash)
            break
          }

          default:
            this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
            return false
        }
        break

      case Opcode.OP_PARTIAL_HASH:
        if (this.stack.length < 3) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        var bufCompleteSize = stacktop(-1)
        var bufPartialHash = stacktop(-2)
        var bufData = stacktop(-3)
        this.stack.pop()
        this.stack.pop()
        this.stack.pop()
        var bufHash
        if (bufPartialHash.length == 0 || bufPartialHash.length == 32) {
          bufHash = partial_sha256.partial_hash(bufData, bufPartialHash, bufCompleteSize)
        } else {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        this.stack.push(Buffer.from(bufHash, 'hex'))
        break

      case Opcode.OP_IF:
      case Opcode.OP_NOTIF:
        // <expression> if [statements] [else [statements]] endif
        // bool fValue = false;
        fValue = false
        if (fExec) {
          if (this.stack.length < 1) {
            this.errstr = 'SCRIPT_ERR_UNBALANCED_CONDITIONAL'
            return false
          }
          buf = stacktop(-1)

          if (this.flags & Interpreter.SCRIPT_VERIFY_MINIMALIF) {
            if (buf.length > 1) {
              this.errstr = 'SCRIPT_ERR_MINIMALIF'
              return false
            }
            if (buf.length === 1 && buf[0] !== 1) {
              this.errstr = 'SCRIPT_ERR_MINIMALIF'
              return false
            }
          }
          fValue = Interpreter.castToBool(buf)
          if (opcodenum === Opcode.OP_NOTIF) {
            fValue = !fValue
          }
          this.stack.pop()
        }
        this.vfExec.push(fValue)
        break

      case Opcode.OP_ELSE:
        if (this.vfExec.length === 0) {
          this.errstr = 'SCRIPT_ERR_UNBALANCED_CONDITIONAL'
          return false
        }
        this.vfExec[this.vfExec.length - 1] = !this.vfExec[this.vfExec.length - 1]
        break

      case Opcode.OP_ENDIF:
        if (this.vfExec.length === 0) {
          this.errstr = 'SCRIPT_ERR_UNBALANCED_CONDITIONAL'
          return false
        }
        this.vfExec.pop()
        break

      case Opcode.OP_VERIFY:
        // (true -- ) or
        // (false -- false) and return
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf = stacktop(-1)
        fValue = Interpreter.castToBool(buf)
        if (fValue) {
          this.stack.pop()
        } else {
          this.errstr = 'SCRIPT_ERR_VERIFY'
          return false
        }
        break

      case Opcode.OP_RETURN:

        if ((this.flags & Interpreter.SCRIPT_VERIFY_P2SH) === 0) { // utxo_after_genesis
          if (this.vfExec.length === 0) {
            // Terminate the execution as successful. The remaining of the script does not affect the validity (even in
            // presence of unbalanced IFs, invalid opcodes etc)
            this.returned = true
            return true
          }
          // op_return encountered inside if statement after genesis --> check for invalid grammar
          this.nonTopLevelReturnAfterGenesis = true
        } else {
          return false
        }

        break

      //
      // Stack ops
      //
      case Opcode.OP_TOALTSTACK:
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        var1 = vartop(-1)
        this.altstack.push(this.stack.pop(), var1)
        break

      case Opcode.OP_FROMALTSTACK:
        if (this.altstack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_ALTSTACK_OPERATION'
          return false
        }
        const varAlt = this.altstack.vartop(-1)
        this.stack.push(this.altstack.pop(), varAlt)
        break

      case Opcode.OP_2DROP:
        // (x1 x2 -- )
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        this.stack.pop()
        this.stack.pop()
        break

      case Opcode.OP_2DUP:
        // (x1 x2 -- x1 x2 x1 x2)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-2)
        buf2 = stacktop(-1)
        var1 = vartop(-2)
        var2 = vartop(-1)
        this.stack.push(Buffer.from(buf1), `$${var1}`)
        this.stack.push(Buffer.from(buf2), `$${var2}`)
        break

      case Opcode.OP_3DUP:
        // (x1 x2 x3 -- x1 x2 x3 x1 x2 x3)
        if (this.stack.length < 3) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-3)
        buf2 = stacktop(-2)
        var buf3 = stacktop(-1)
        var1 = vartop(-3)
        var2 = vartop(-2)
        var3 = vartop(-1)
        this.stack.push(Buffer.from(buf1), `$${var1}`)
        this.stack.push(Buffer.from(buf2), `$${var2}`)
        this.stack.push(Buffer.from(buf3), `$${var3}`)
        break

      case Opcode.OP_2OVER:
        // (x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2)
        if (this.stack.length < 4) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-4)
        buf2 = stacktop(-3)
        var1 = vartop(-4)
        var2 = vartop(-3)
        this.stack.push(Buffer.from(buf1), `$${var1}`)
        this.stack.push(Buffer.from(buf2), `$${var2}`)
        break

      case Opcode.OP_2ROT:
        // (x1 x2 x3 x4 x5 x6 -- x3 x4 x5 x6 x1 x2)
        if (this.stack.length < 6) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        var1 = vartop(-6)
        var2 = vartop(-5)

        spliced = this.stack.splice(this.stack.length - 6, 2)
        this.stack.push(spliced[0], var1)
        this.stack.push(spliced[1], var2)
        break

      case Opcode.OP_2SWAP:
        // (x1 x2 x3 x4 -- x3 x4 x1 x2)
        if (this.stack.length < 4) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        var1 = vartop(-4)
        var2 = vartop(-3)
        spliced = this.stack.splice(this.stack.length - 4, 2)
        this.stack.push(spliced[0], var1)
        this.stack.push(spliced[1], var2)
        break

      case Opcode.OP_IFDUP:
        // (x - 0 | x x)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf = stacktop(-1)
        fValue = Interpreter.castToBool(buf)
        if (fValue) {
          var1 = vartop(-1)
          this.stack.push(Buffer.from(buf), `$${var1}`)
        }
        break

      case Opcode.OP_DEPTH:
        // -- stacksize
        buf = new BN(this.stack.length).toScriptNumBuffer()
        this.stack.push(buf, '$depth')
        break

      case Opcode.OP_DROP:
        // (x -- )
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        this.stack.pop()
        break

      case Opcode.OP_DUP:
        // (x -- x x)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        var1 = vartop(-1)
        this.stack.push(Buffer.from(stacktop(-1)), `$${var1}`)
        break

      case Opcode.OP_NIP:
        // (x1 x2 -- x2)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        this.stack.splice(this.stack.length - 2, 1)
        break

      case Opcode.OP_OVER:
        // (x1 x2 -- x1 x2 x1)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        var2 = vartop(-2)
        this.stack.push(Buffer.from(stacktop(-2)), `$${var2}`)
        break

      case Opcode.OP_PICK:
      case Opcode.OP_ROLL:
        // (xn ... x2 x1 x0 n - xn ... x2 x1 x0 xn)
        // (xn ... x2 x1 x0 n - ... x2 x1 x0 xn)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf = stacktop(-1)
        bn = BN.fromScriptNumBuffer(buf, fRequireMinimal, 4)
        n = bn.toNumber()
        this.stack.pop()
        if (n < 0 || n >= this.stack.length) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf = stacktop(-n - 1)
        var1 = vartop(-n - 1)
        if (opcodenum === Opcode.OP_ROLL) {
          this.stack.splice(this.stack.length - n - 1, 1)
          this.stack.push(Buffer.from(buf), var1)
        } else {
          this.stack.push(Buffer.from(buf), `$${var1}`)
        }

        break

      case Opcode.OP_ROT:
        // (x1 x2 x3 -- x2 x3 x1)
        //  x2 x1 x3  after first swap
        //  x2 x3 x1  after second swap
        if (this.stack.length < 3) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        x1 = stacktop(-3)
        x2 = stacktop(-2)
        var x3 = stacktop(-1)
        var1 = vartop(-3)
        var2 = vartop(-2)
        var3 = vartop(-1)
        this.stack.write(-3, x2)
        this.stack.write(-2, x3)
        this.stack.write(-1, x1)
        this.stack.updateTopVars([var1, var3, var2])
        break

      case Opcode.OP_SWAP:
        // (x1 x2 -- x2 x1)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        x1 = stacktop(-2)
        x2 = stacktop(-1)
        var1 = vartop(-2)
        var2 = vartop(-1)
        this.stack.write(-2, x2)
        this.stack.write(-1, x1)
        this.stack.updateTopVars([var1, var2])
        break

      case Opcode.OP_TUCK:
        // (x1 x2 -- x2 x1 x2)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        var1 = vartop(-2)
        var2 = vartop(-1)

        this.stack.splice(this.stack.length - 2, 0, Buffer.from(stacktop(-1)))
        this.stack.updateTopVars([var2, var1, `$${var2}`])
        break

      case Opcode.OP_SIZE:
        // (in -- in size)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        bn = new BN(stacktop(-1).length)
        this.stack.push(bn.toScriptNumBuffer(), `$size`)
        break

      //
      // Bitwise logic
      //
      case Opcode.OP_AND:
      case Opcode.OP_OR:
      case Opcode.OP_XOR:
        // (x1 x2 - out)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-2)
        buf2 = stacktop(-1)

        // Inputs must be the same size
        if (buf1.length !== buf2.length) {
          this.errstr = 'SCRIPT_ERR_INVALID_OPERAND_SIZE'
          return false
        }

        // To avoid allocating, we modify vch1 in place.
        switch (opcodenum) {
          case Opcode.OP_AND:
            for (let i = 0; i < buf1.length; i++) {
              buf1[i] &= buf2[i]
            }
            break
          case Opcode.OP_OR:
            for (let i = 0; i < buf1.length; i++) {
              buf1[i] |= buf2[i]
            }
            break
          case Opcode.OP_XOR:
            for (let i = 0; i < buf1.length; i++) {
              buf1[i] ^= buf2[i]
            }
            break
          default:
            break
        }

        // And pop vch2.
        this.stack.pop()
        break

      case Opcode.OP_INVERT:
        // (x -- out)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
        }
        buf = stacktop(-1)
        for (let i = 0; i < buf.length; i++) {
          buf[i] = ~buf[i]
        }
        break

      case Opcode.OP_LSHIFT:
      case Opcode.OP_RSHIFT:
        // (x n -- out)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-2)
        if (buf1.length === 0) {
          this.stack.pop()
        } else {
          bn1 = new BN(buf1)
          bn2 = BN.fromScriptNumBuffer(stacktop(-1), fRequireMinimal, 4)
          n = bn2.toNumber()
          if (n < 0) {
            this.errstr = 'SCRIPT_ERR_INVALID_NUMBER_RANGE'
            return false
          }
          this.stack.pop()
          this.stack.pop()
          let shifted
          if (opcodenum === Opcode.OP_LSHIFT) {
            shifted = bn1.ushln(n)
          }
          if (opcodenum === Opcode.OP_RSHIFT) {
            shifted = bn1.ushrn(n)
          }
          // bitcoin client implementation of l/rshift is unconventional, therefore this implementation is a bit unconventional
          // bn library has shift functions however it expands the carried bits into a new byte
          // in contrast to the bitcoin client implementation which drops off the carried bits
          // in other words, if operand was 1 byte then we put 1 byte back on the stack instead of expanding to more shifted bytes
          let bufShifted = padBufferToSize(Buffer.from(shifted.toArray().slice(buf1.length * -1)), buf1.length)
          this.stack.push(bufShifted)
        }
        break

      case Opcode.OP_EQUAL:
      case Opcode.OP_EQUALVERIFY:
        // case Opcode.OP_NOTEQUAL: // use Opcode.OP_NUMNOTEQUAL
        // (x1 x2 - bool)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-2)
        buf2 = stacktop(-1)
        var fEqual = buf1.toString('hex') === buf2.toString('hex')
        this.stack.pop()
        this.stack.pop()
        this.stack.push(fEqual ? Interpreter.getTrue() : Interpreter.getFalse())
        if (opcodenum === Opcode.OP_EQUALVERIFY) {
          if (fEqual) {
            this.stack.pop()
          } else {
            this.errstr = 'SCRIPT_ERR_EQUALVERIFY'
            return false
          }
        }
        break

      //
      // Numeric
      //
      case Opcode.OP_1ADD:
      case Opcode.OP_1SUB:
      case Opcode.OP_NEGATE:
      case Opcode.OP_ABS:
      case Opcode.OP_NOT:
      case Opcode.OP_0NOTEQUAL:
        // (in -- out)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf = stacktop(-1)
        bn = BN.fromScriptNumBuffer(buf, fRequireMinimal)
        switch (opcodenum) {
          case Opcode.OP_1ADD:
            bn = bn.add(BN.One)
            break
          case Opcode.OP_1SUB:
            bn = bn.sub(BN.One)
            break
          case Opcode.OP_NEGATE:
            bn = bn.neg()
            break
          case Opcode.OP_ABS:
            if (bn.cmp(BN.Zero) < 0) {
              bn = bn.neg()
            }
            break
          case Opcode.OP_NOT:
            bn = new BN((bn.cmp(BN.Zero) === 0) + 0)
            break
          case Opcode.OP_0NOTEQUAL:
            bn = new BN((bn.cmp(BN.Zero) !== 0) + 0)
            break
          // default:      assert(!'invalid opcode'); break; // TODO: does this ever occur?
        }
        this.stack.pop()
        this.stack.push(bn.toScriptNumBuffer())
        break

      case Opcode.OP_ADD:
      case Opcode.OP_SUB:
      case Opcode.OP_MUL:
      case Opcode.OP_MOD:
      case Opcode.OP_DIV:
      case Opcode.OP_BOOLAND:
      case Opcode.OP_BOOLOR:
      case Opcode.OP_NUMEQUAL:
      case Opcode.OP_NUMEQUALVERIFY:
      case Opcode.OP_NUMNOTEQUAL:
      case Opcode.OP_LESSTHAN:
      case Opcode.OP_GREATERTHAN:
      case Opcode.OP_LESSTHANOREQUAL:
      case Opcode.OP_GREATERTHANOREQUAL:
      case Opcode.OP_MIN:
      case Opcode.OP_MAX:
        // (x1 x2 -- out)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        bn1 = BN.fromScriptNumBuffer(stacktop(-2), fRequireMinimal)
        bn2 = BN.fromScriptNumBuffer(stacktop(-1), fRequireMinimal)
        bn = new BN(0)

        switch (opcodenum) {
          case Opcode.OP_ADD:
            bn = bn1.add(bn2)
            break

          case Opcode.OP_SUB:
            bn = bn1.sub(bn2)
            break

          case Opcode.OP_MUL:
            bn = bn1.mul(bn2)
            break

          case Opcode.OP_DIV:
            // denominator must not be 0
            if (bn2 === 0) {
              this.errstr = 'SCRIPT_ERR_DIV_BY_ZERO'
              return false
            }
            bn = bn1.div(bn2)
            break

          case Opcode.OP_MOD:
            // divisor must not be 0
            if (bn2 === 0) {
              this.errstr = 'SCRIPT_ERR_DIV_BY_ZERO'
              return false
            }
            bn = bn1.mod(bn2)
            break

          case Opcode.OP_BOOLAND:
            bn = new BN(((bn1.cmp(BN.Zero) !== 0) && (bn2.cmp(BN.Zero) !== 0)) + 0)
            break
          // case Opcode.OP_BOOLOR:        bn = (bn1 !== bnZero || bn2 !== bnZero); break;
          case Opcode.OP_BOOLOR:
            bn = new BN(((bn1.cmp(BN.Zero) !== 0) || (bn2.cmp(BN.Zero) !== 0)) + 0)
            break
          // case Opcode.OP_NUMEQUAL:      bn = (bn1 === bn2); break;
          case Opcode.OP_NUMEQUAL:
            bn = new BN((bn1.cmp(bn2) === 0) + 0)
            break
          // case Opcode.OP_NUMEQUALVERIFY:    bn = (bn1 === bn2); break;
          case Opcode.OP_NUMEQUALVERIFY:
            bn = new BN((bn1.cmp(bn2) === 0) + 0)
            break
          // case Opcode.OP_NUMNOTEQUAL:     bn = (bn1 !== bn2); break;
          case Opcode.OP_NUMNOTEQUAL:
            bn = new BN((bn1.cmp(bn2) !== 0) + 0)
            break
          // case Opcode.OP_LESSTHAN:      bn = (bn1 < bn2); break;
          case Opcode.OP_LESSTHAN:
            bn = new BN((bn1.cmp(bn2) < 0) + 0)
            break
          // case Opcode.OP_GREATERTHAN:     bn = (bn1 > bn2); break;
          case Opcode.OP_GREATERTHAN:
            bn = new BN((bn1.cmp(bn2) > 0) + 0)
            break
          // case Opcode.OP_LESSTHANOREQUAL:   bn = (bn1 <= bn2); break;
          case Opcode.OP_LESSTHANOREQUAL:
            bn = new BN((bn1.cmp(bn2) <= 0) + 0)
            break
          // case Opcode.OP_GREATERTHANOREQUAL:  bn = (bn1 >= bn2); break;
          case Opcode.OP_GREATERTHANOREQUAL:
            bn = new BN((bn1.cmp(bn2) >= 0) + 0)
            break
          case Opcode.OP_MIN:
            bn = (bn1.cmp(bn2) < 0 ? bn1 : bn2)
            break
          case Opcode.OP_MAX:
            bn = (bn1.cmp(bn2) > 0 ? bn1 : bn2)
            break
          // default:           assert(!'invalid opcode'); break; //TODO: does this ever occur?
        }
        this.stack.pop()
        this.stack.pop()
        this.stack.push(bn.toScriptNumBuffer())

        if (opcodenum === Opcode.OP_NUMEQUALVERIFY) {
          // if (CastToBool(stacktop(-1)))
          if (Interpreter.castToBool(stacktop(-1))) {
            this.stack.pop()
          } else {
            this.errstr = 'SCRIPT_ERR_NUMEQUALVERIFY'
            return false
          }
        }
        break

      case Opcode.OP_WITHIN:
        // (x min max -- out)
        if (this.stack.length < 3) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        bn1 = BN.fromScriptNumBuffer(stacktop(-3), fRequireMinimal)
        bn2 = BN.fromScriptNumBuffer(stacktop(-2), fRequireMinimal)
        var bn3 = BN.fromScriptNumBuffer(stacktop(-1), fRequireMinimal)
        // bool fValue = (bn2 <= bn1 && bn1 < bn3);
        fValue = (bn2.cmp(bn1) <= 0) && (bn1.cmp(bn3) < 0)
        this.stack.pop()
        this.stack.pop()
        this.stack.pop()
        this.stack.push(fValue ? Interpreter.getTrue() : Interpreter.getFalse())
        break

      //
      // Crypto
      //
      case Opcode.OP_RIPEMD160:
      case Opcode.OP_SHA1:
      case Opcode.OP_SHA256:
      case Opcode.OP_HASH160:
      case Opcode.OP_HASH256:
        // (in -- hash)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf = stacktop(-1)
        // valtype vchHash((opcode === Opcode.OP_RIPEMD160 ||
        //                 opcode === Opcode.OP_SHA1 || opcode === Opcode.OP_HASH160) ? 20 : 32);
        var bufHash
        if (opcodenum === Opcode.OP_RIPEMD160) {
          bufHash = Hash.ripemd160(buf)
        } else if (opcodenum === Opcode.OP_SHA1) {
          bufHash = Hash.sha1(buf)
        } else if (opcodenum === Opcode.OP_SHA256) {
          bufHash = Hash.sha256(buf)
        } else if (opcodenum === Opcode.OP_HASH160) {
          bufHash = Hash.sha256ripemd160(buf)
        } else if (opcodenum === Opcode.OP_HASH256) {
          bufHash = Hash.sha256sha256(buf)
        }
        this.stack.pop()
        this.stack.push(bufHash)
        break

      case Opcode.OP_CODESEPARATOR:
        // Hash starts after the code separator
        this.pbegincodehash = this.pc
        break

      case Opcode.OP_CHECKSIG:
      case Opcode.OP_CHECKSIGVERIFY:
        // (sig pubkey -- bool)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        bufSig = stacktop(-2)
        bufPubkey = stacktop(-1)

        if (!this.checkSignatureEncoding(bufSig) || !this.checkPubkeyEncoding(bufPubkey)) {
          return false
        }

        // Subset of script starting at the most recent codeseparator
        // CScript scriptCode(pbegincodehash, pend);
        subscript = this.subscript()

        // Drop the signature, since there's no way for a signature to sign itself
        var tmpScript = new Script().add(bufSig)
        subscript.findAndDelete(tmpScript)

        try {
          sig = Signature.fromTxFormat(bufSig)
          pubkey = PublicKey.fromBuffer(bufPubkey, false)

          fSuccess = this.tx.verifySignature(sig, pubkey, this.nin, subscript, this.satoshisBN, this.flags)
        } catch (e) {
          // invalid sig or pubkey
          fSuccess = false
        }

        if (!fSuccess && (this.flags & Interpreter.SCRIPT_VERIFY_NULLFAIL) &&
          bufSig.length) {
          this.errstr = 'SCRIPT_ERR_NULLFAIL'
          return false
        }

        this.stack.pop()
        this.stack.pop()

        // stack.push_back(fSuccess ? vchTrue : vchFalse);
        this.stack.push(fSuccess ? Interpreter.getTrue() : Interpreter.getFalse())
        if (opcodenum === Opcode.OP_CHECKSIGVERIFY) {
          if (fSuccess) {
            this.stack.pop()
          } else {
            this.errstr = 'SCRIPT_ERR_CHECKSIGVERIFY'
            return false
          }
        }
        break

      case Opcode.OP_CHECKMULTISIG:
      case Opcode.OP_CHECKMULTISIGVERIFY:
        // ([sig ...] num_of_signatures [pubkey ...] num_of_pubkeys -- bool)

        var i = 1
        if (this.stack.length < i) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        var nKeysCount = BN.fromScriptNumBuffer(stacktop(-i), fRequireMinimal).toNumber()
        // TODO: Keys and opcount are parameterized in client. No magic numbers!
        if (nKeysCount < 0 || nKeysCount > 20) {
          this.errstr = 'SCRIPT_ERR_PUBKEY_COUNT'
          return false
        }
        this.nOpCount += nKeysCount
        if (this.nOpCount > Interpreter.MAX_OPCODE_COUNT) {
          this.errstr = 'SCRIPT_ERR_OP_COUNT'
          return false
        }
        // int ikey = ++i;
        var ikey = ++i
        i += nKeysCount

        // ikey2 is the position of last non-signature item in
        // the stack. Top stack item = 1. With
        // SCRIPT_VERIFY_NULLFAIL, this is used for cleanup if
        // operation fails.
        var ikey2 = nKeysCount + 2

        if (this.stack.length < i) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        var nSigsCount = BN.fromScriptNumBuffer(stacktop(-i), fRequireMinimal).toNumber()
        if (nSigsCount < 0 || nSigsCount > nKeysCount) {
          this.errstr = 'SCRIPT_ERR_SIG_COUNT'
          return false
        }
        // int isig = ++i;
        var isig = ++i
        i += nSigsCount
        if (this.stack.length < i) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        // Subset of script starting at the most recent codeseparator
        subscript = this.subscript()

        // Drop the signatures, since there's no way for a signature to sign itself
        for (var k = 0; k < nSigsCount; k++) {
          bufSig = stacktop(-isig - k)
          subscript.findAndDelete(new Script().add(bufSig))
        }

        fSuccess = true
        while (fSuccess && nSigsCount > 0) {
          // valtype& vchSig  = stacktop(-isig);
          bufSig = stacktop(-isig)
          // valtype& vchPubKey = stacktop(-ikey);
          bufPubkey = stacktop(-ikey)

          if (!this.checkSignatureEncoding(bufSig) || !this.checkPubkeyEncoding(bufPubkey)) {
            return false
          }

          var fOk
          try {
            sig = Signature.fromTxFormat(bufSig)
            pubkey = PublicKey.fromBuffer(bufPubkey, false)
            fOk = this.tx.verifySignature(sig, pubkey, this.nin, subscript, this.satoshisBN, this.flags)
          } catch (e) {
            // invalid sig or pubkey
            fOk = false
          }

          if (fOk) {
            isig++
            nSigsCount--
          }
          ikey++
          nKeysCount--

          // If there are more signatures left than keys left,
          // then too many signatures have failed
          if (nSigsCount > nKeysCount) {
            fSuccess = false
          }
        }

        // Clean up stack of actual arguments
        while (i-- > 1) {
          if (!fSuccess && (this.flags & Interpreter.SCRIPT_VERIFY_NULLFAIL) &&
            !ikey2 && stacktop(-1).length) {
            this.errstr = 'SCRIPT_ERR_NULLFAIL'
            return false
          }

          if (ikey2 > 0) {
            ikey2--
          }

          this.stack.pop()
        }

        // A bug causes CHECKMULTISIG to consume one extra argument
        // whose contents were not checked in any way.
        //
        // Unfortunately this is a potential source of mutability,
        // so optionally verify it is exactly equal to zero prior
        // to removing it from the stack.
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        if ((this.flags & Interpreter.SCRIPT_VERIFY_NULLDUMMY) && stacktop(-1).length) {
          this.errstr = 'SCRIPT_ERR_SIG_NULLDUMMY'
          return false
        }
        this.stack.pop()

        this.stack.push(fSuccess ? Interpreter.getTrue() : Interpreter.getFalse())

        if (opcodenum === Opcode.OP_CHECKMULTISIGVERIFY) {
          if (fSuccess) {
            this.stack.pop()
          } else {
            this.errstr = 'SCRIPT_ERR_CHECKMULTISIGVERIFY'
            return false
          }
        }
        break

      //
      // Byte string operations
      //
      case Opcode.OP_CAT:
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        buf1 = stacktop(-2)
        buf2 = stacktop(-1)
        if (buf1.length + buf2.length > Interpreter.MAX_SCRIPT_ELEMENT_SIZE) {
          this.errstr = 'SCRIPT_ERR_PUSH_SIZE'
          return false
        }
        this.stack.write(-2, Buffer.concat([buf1, buf2]))
        this.stack.pop()
        break

      case Opcode.OP_SPLIT:
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }
        buf1 = stacktop(-2)

        // Make sure the split point is apropriate.
        var position = BN.fromScriptNumBuffer(stacktop(-1), fRequireMinimal).toNumber()
        if (position < 0 || position > buf1.length) {
          this.errstr = 'SCRIPT_ERR_INVALID_SPLIT_RANGE'
          return false
        }

        // Prepare the results in their own buffer as `data`
        // will be invalidated.
        // Copy buffer data, to slice it before
        var n1 = Buffer.from(buf1)

        // Replace existing stack values by the new values.
        this.stack.write(-2, n1.slice(0, position))
        this.stack.write(-1, n1.slice(position))
        break

      //
      // Conversion operations
      //
      case Opcode.OP_NUM2BIN:
        // (in -- out)
        if (this.stack.length < 2) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        var size = BN.fromScriptNumBuffer(stacktop(-1), fRequireMinimal).toNumber()
        if (size > Interpreter.MAX_SCRIPT_ELEMENT_SIZE) {
          this.errstr = 'SCRIPT_ERR_PUSH_SIZE'
          return false
        }

        this.stack.pop()
        var rawnum = stacktop(-1)

        // Try to see if we can fit that number in the number of
        // byte requested.
        rawnum = Interpreter._minimallyEncode(rawnum)

        if (rawnum.length > size) {
          // We definitively cannot.
          this.errstr = 'SCRIPT_ERR_IMPOSSIBLE_ENCODING'
          return false
        }

        // We already have an element of the right size, we
        // don't need to do anything.
        if (rawnum.length === size) {
          this.stack.write(-1, rawnum)
          break
        }

        var signbit = 0x00
        if (rawnum.length > 0) {
          signbit = rawnum[rawnum.length - 1] & 0x80
          rawnum[rawnum.length - 1] &= 0x7f
        }

        var num = Buffer.alloc(size)
        rawnum.copy(num, 0)

        var l = rawnum.length - 1
        while (l++ < size - 2) {
          num[l] = 0x00
        }

        num[l] = signbit

        this.stack.write(-1, num)
        break

      case Opcode.OP_BIN2NUM:
        // (in -- out)
        if (this.stack.length < 1) {
          this.errstr = 'SCRIPT_ERR_INVALID_STACK_OPERATION'
          return false
        }

        buf1 = stacktop(-1)
        buf2 = Interpreter._minimallyEncode(buf1)

        this.stack.write(-1, buf2)

        // The resulting number must be a valid number.
        if (!Interpreter._isMinimallyEncoded(buf2)) {
          this.errstr = 'SCRIPT_ERR_INVALID_NUMBER_RANGE'
          return false
        }
        break

      default:
        this.errstr = 'SCRIPT_ERR_BAD_OPCODE'
        return false
    }
  }

  // only when next opcode is evaluate opcode, we update stack
  if (this.vfExec.indexOf(false) === -1) {
    this._callbackStack(this.stack, this.pc, scriptType)
  }

  return true
}
