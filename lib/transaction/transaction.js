'use strict'

var _ = require('../util/_')
var $ = require('../util/preconditions')
var buffer = require('buffer')

var errors = require('../errors')
var JSUtil = require('../util/js')
var BufferReader = require('../encoding/bufferreader')
var BufferWriter = require('../encoding/bufferwriter')
var Varint = require('../encoding/varint')
var Hash = require('../crypto/hash')
var Signature = require('../crypto/signature')
var Sighash = require('./sighash')

var Address = require('../address')
var UnspentOutput = require('./unspentoutput')
var Input = require('./input')
var PublicKeyHashInput = Input.PublicKeyHash
var PublicKeyInput = Input.PublicKey
var MultiSigScriptHashInput = Input.MultiSigScriptHash
var MultiSigInput = Input.MultiSig
var Output = require('./output')
var Script = require('../script')
var PrivateKey = require('../privatekey')
var BN = require('../crypto/bn')
/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */
function Transaction(serialized) {
  if (!(this instanceof Transaction)) {
    return new Transaction(serialized)
  }
  this.inputs = []
  this.outputs = []
  this._inputAmount = undefined
  this._outputAmount = undefined
  this._inputsMap = new Map()
  this._outputsMap = new Map()
  this._privateKey = undefined
  this._sigType = undefined
  this.sealed = false
  if (serialized) {
    if (serialized instanceof Transaction) {
      return Transaction.shallowCopy(serialized)
    } else if (JSUtil.isHexa(serialized)) {
      this.fromString(serialized)
    } else if (Buffer.isBuffer(serialized)) {
      this.fromBuffer(serialized)
    } else if (_.isObject(serialized)) {
      this.fromObject(serialized)
    } else {
      throw new errors.InvalidArgument('Must provide an object or string to deserialize a transaction')
    }
  } else {
    this._newTransaction()
  }
}

var CURRENT_VERSION = 10
var DEFAULT_NLOCKTIME = 0

// Minimum amount for an output for it not to be considered a dust output
Transaction.DUST_AMOUNT = 42

// Margin of error to allow fees in the vecinity of the expected value but doesn't allow a big difference
Transaction.FEE_SECURITY_MARGIN = 150

// max amount of satoshis in circulation
Transaction.MAX_MONEY = 21000000 * 1e8

// nlocktime limit to be considered block height rather than a timestamp
Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT = 5e8

// Max value for an unsigned 32 bit value
Transaction.NLOCKTIME_MAX_VALUE = 4294967295

// Value used for fee estimation (satoshis per kilobyte)
Transaction.FEE_PER_KB = 100

// Safe upper bound for change address script size in bytes
Transaction.CHANGE_OUTPUT_MAX_SIZE = 20 + 4 + 34 + 4

/**
 * a dummy privatekey
 */
Transaction.DUMMY_PRIVATEKEY = PrivateKey.fromWIF('cQ3nCBQB9RsFSyjNQM15NQLVpXXMtWh9PUyeFz5KxLJCHsuRH2Su')

/* Constructors and Serialization */

/**
 * Create a 'shallow' copy of the transaction, by serializing and deserializing
 * it dropping any additional information that inputs and outputs may have hold
 *
 * @param {Transaction} transaction
 * @return {Transaction}
 */
Transaction.shallowCopy = function (transaction) {
  var copy = new Transaction(transaction.toBuffer())
  return copy
}

var hashProperty = {
  configurable: false,
  enumerable: true,
  get: function () {
    this._hash = new BufferReader(this._getHash()).readReverse().toString('hex')
    return this._hash
  }
}
Object.defineProperty(Transaction.prototype, 'hash', hashProperty)
Object.defineProperty(Transaction.prototype, 'id', hashProperty)

var ioProperty = {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._getInputAmount()
  }
}
Object.defineProperty(Transaction.prototype, 'inputAmount', ioProperty)
ioProperty.get = function () {
  return this._getOutputAmount()
}
Object.defineProperty(Transaction.prototype, 'outputAmount', ioProperty)

/**
 * Retrieve the little endian hash of the transaction (used for serialization)
 * @return {Buffer}
 */
Transaction.prototype._getHash = function () {
  if (this.version >= 10) {
    return Hash.sha256sha256(this.newTxHeader().toBuffer())
  }
  return Hash.sha256sha256(this.toBuffer())
}

/**
 * Retrieve a hexa string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @param {Object|boolean=} unsafe if true, skip all tests. if it's an object,
 *   it's expected to contain a set of flags to skip certain tests:
 * * `disableAll`: disable all checks
 * * `disableLargeFees`: disable checking for fees that are too large
 * * `disableIsFullySigned`: disable checking if all inputs are fully signed
 * * `disableDustOutputs`: disable checking if there are no outputs that are dust amounts
 * * `disableMoreOutputThanInput`: disable checking if the transaction spends more bitcoins than the sum of the input amounts
 * @return {string}
 */
Transaction.prototype.serialize = function (unsafe) {
  if (unsafe === true || (unsafe && unsafe.disableAll)) {
    return this.uncheckedSerialize()
  } else {
    return this.checkedSerialize(unsafe)
  }
}

Transaction.prototype.uncheckedSerialize = Transaction.prototype.toString = function () {
  return this.toBuffer().toString('hex')
}

/**
 * Retrieve a hexa string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @param {Object} opts allows to skip certain tests. {@see Transaction#serialize}
 * @return {string}
 */
Transaction.prototype.checkedSerialize = function (opts) {
  var serializationError = this.getSerializationError(opts)
  if (serializationError) {
    throw serializationError
  }
  return this.uncheckedSerialize()
}

Transaction.prototype.invalidSatoshis = function () {
  var invalid = false
  for (var i = 0; i < this.outputs.length; i++) {
    if (this.outputs[i].invalidSatoshis()) {
      invalid = true
    }
  }
  return invalid
}

/**
 * Retrieve a possible error that could appear when trying to serialize and
 * broadcast this transaction.
 *
 * @param {Object} opts allows to skip certain tests. {@see Transaction#serialize}
 * @return {tbc.Error}
 */
Transaction.prototype.getSerializationError = function (opts) {
  opts = opts || {}

  if (this.invalidSatoshis()) {
    return new errors.Transaction.InvalidSatoshis()
  }

  var unspent = this.getUnspentValue()
  var unspentError
  if (unspent < 0) {
    if (!opts.disableMoreOutputThanInput) {
      unspentError = new errors.Transaction.InvalidOutputAmountSum()
    }
  } else {
    unspentError = this._hasFeeError(opts, unspent)
  }

  return unspentError ||
    this._hasDustOutputs(opts) ||
    this._isMissingSignatures(opts)
}

Transaction.prototype._hasFeeError = function (opts, unspent) {
  if (!_.isUndefined(this._fee) && this._fee !== unspent) {
    return new errors.Transaction.FeeError.Different(
      'Unspent value is ' + unspent + ' but specified fee is ' + this._fee
    )
  }

  if (!opts.disableLargeFees) {
    var maximumFee = Math.floor(Transaction.FEE_SECURITY_MARGIN * this._estimateFee())
    if (unspent > maximumFee) {
      if (this._missingChange()) {
        return new errors.Transaction.ChangeAddressMissing(
          'Fee is too large and no change address was provided'
        )
      }
      return new errors.Transaction.FeeError.TooLarge(
        'expected less than ' + maximumFee + ' but got ' + unspent
      )
    }
  }
}

Transaction.prototype._missingChange = function () {
  return !this._changeScript
}

Transaction.prototype._hasDustOutputs = function (opts) {
  if (opts.disableDustOutputs) {
    return
  }
  var index, output
  for (index in this.outputs) {
    output = this.outputs[index]
    if (output.satoshis < Transaction.DUST_AMOUNT && !output.script.isDataOut() && !output.script.isSafeDataOut()) {
      return new errors.Transaction.DustOutputs()
    }
  }
}

Transaction.prototype._isMissingSignatures = function (opts) {
  if (opts.disableIsFullySigned) {
    return
  }
  if (!this.isFullySigned()) {
    return new errors.Transaction.MissingSignatures()
  }
}

Transaction.prototype.inspect = function () {
  return '<Transaction: ' + this.uncheckedSerialize() + '>'
}

Transaction.prototype.toBuffer = function () {
  var writer = new BufferWriter()
  return this.toBufferWriter(writer).toBuffer()
}

Transaction.prototype.toBufferWriter = function (writer) {
  writer.writeUInt32LE(this.version)
  writer.writeVarintNum(this.inputs.length)
  _.each(this.inputs, function (input) {
    input.toBufferWriter(writer)
  })
  writer.writeVarintNum(this.outputs.length)
  _.each(this.outputs, function (output) {
    output.toBufferWriter(writer)
  })
  writer.writeUInt32LE(this.nLockTime)
  return writer
}

Transaction.prototype.newTxHeader = function () {
  var writer = new BufferWriter()
  writer.writeUInt32LE(this.version)
  writer.writeUInt32LE(this.nLockTime)
  writer.writeInt32LE(this.inputs.length)
  writer.writeInt32LE(this.outputs.length)

  const inputWriter = new BufferWriter()
  const inputWriter2 = new BufferWriter()
  for (const input of this.inputs) {
    inputWriter.writeReverse(input.prevTxId)
    inputWriter.writeUInt32LE(input.outputIndex)
    inputWriter.writeUInt32LE(input.sequenceNumber)

    inputWriter2.write(Hash.sha256(input.script.toBuffer()))
  }
  writer.write(Hash.sha256(inputWriter.toBuffer()))
  writer.write(Hash.sha256(inputWriter2.toBuffer()))

  const outputWriter = new BufferWriter()
  for (const output of this.outputs) {
    outputWriter.writeUInt64LEBN(output.satoshisBN)
    outputWriter.write(Hash.sha256(output.script.toBuffer()))
  }
  writer.write(Hash.sha256(outputWriter.toBuffer()))
  return writer
}

Transaction.prototype.fromBuffer = function (buffer) {
  var reader = new BufferReader(buffer)
  return this.fromBufferReader(reader)
}

Transaction.prototype.fromBufferReader = function (reader) {
  $.checkArgument(!reader.finished(), 'No transaction data received')
  var i, sizeTxIns, sizeTxOuts

  this.version = reader.readInt32LE()
  sizeTxIns = reader.readVarintNum()
  for (i = 0; i < sizeTxIns; i++) {
    var input = Input.fromBufferReader(reader)
    this.inputs.push(input)
  }
  sizeTxOuts = reader.readVarintNum()
  for (i = 0; i < sizeTxOuts; i++) {
    this.outputs.push(Output.fromBufferReader(reader))
  }
  this.nLockTime = reader.readUInt32LE()
  return this
}

Transaction.prototype.toObject = Transaction.prototype.toJSON = function toObject() {
  var inputs = []
  this.inputs.forEach(function (input) {
    inputs.push(input.toObject())
  })
  var outputs = []
  this.outputs.forEach(function (output) {
    outputs.push(output.toObject())
  })
  var obj = {
    hash: this.hash,
    version: this.version,
    inputs: inputs,
    outputs: outputs,
    nLockTime: this.nLockTime
  }
  if (this._changeScript) {
    obj.changeScript = this._changeScript.toString()
  }

  if (this._changeScript) {
    obj.changeAddress = this._changeAddress.toString()
  }

  if (!_.isUndefined(this._changeIndex)) {
    obj.changeIndex = this._changeIndex
  }
  if (!_.isUndefined(this._fee)) {
    obj.fee = this._fee
  }
  return obj
}

Transaction.prototype.fromObject = function fromObject(arg) {
  $.checkArgument(_.isObject(arg) || arg instanceof Transaction)
  var self = this
  var transaction
  if (arg instanceof Transaction) {
    transaction = transaction.toObject()
  } else {
    transaction = arg
  }
  _.each(transaction.inputs, function (input) {
    if (!input.output || !input.output.script) {
      self.uncheckedAddInput(new Input(input))
      return
    }
    var script = new Script(input.output.script)
    var txin
    if (script.isPublicKeyHashOut()) {
      txin = new Input.PublicKeyHash(input)
    } else if (script.isScriptHashOut() && input.publicKeys && input.threshold) {
      txin = new Input.MultiSigScriptHash(
        input, input.publicKeys, input.threshold, input.signatures
      )
    } else if (script.isPublicKeyOut()) {
      txin = new Input.PublicKey(input)
    } else {
      throw new errors.Transaction.Input.UnsupportedScript(input.output.script)
    }
    self.addInput(txin)
  })
  _.each(transaction.outputs, function (output) {
    self.addOutput(new Output(output))
  })
  if (transaction.changeIndex) {
    this._changeIndex = transaction.changeIndex
  }
  if (transaction.changeScript) {
    this._changeScript = new Script(transaction.changeScript)
  }
  if (transaction.changeAddress) {
    this._changeAddress = Address.fromString(transaction.changeAddress)
  }
  if (transaction.fee) {
    this._fee = transaction.fee
  }
  this.nLockTime = transaction.nLockTime
  this.version = transaction.version
  this._checkConsistency(arg)
  return this
}

Transaction.prototype._checkConsistency = function (arg) {
  if (!_.isUndefined(this._changeIndex)) {
    $.checkState(this._changeScript, 'Change script is expected.')
    $.checkState(this._changeAddress, 'Change address is expected.')
    $.checkState(this.outputs[this._changeIndex], 'Change index points to undefined output.')
    $.checkState(this.outputs[this._changeIndex].script.toString() ===
      this._changeScript.toString(), 'Change output has an unexpected script.')
  }
  if (arg && arg.hash) {
    $.checkState(arg.hash === this.hash, 'Hash in object does not match transaction hash.')
  }
}

/**
 * Sets nLockTime so that transaction is not valid until the desired date(a
 * timestamp in seconds since UNIX epoch is also accepted)
 *
 * @param {Date | Number} time
 * @return {Transaction} this
 */
Transaction.prototype.lockUntilDate = function (time) {
  $.checkArgument(time)
  if (_.isNumber(time) && time < Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    throw new errors.Transaction.LockTimeTooEarly()
  }
  if (_.isDate(time)) {
    time = time.getTime() / 1000
  }

  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].sequenceNumber === Input.DEFAULT_SEQNUMBER) {
      this.inputs[i].sequenceNumber = Input.DEFAULT_LOCKTIME_SEQNUMBER
    }
  }

  this.nLockTime = time
  return this
}

/**
 * Sets nLockTime so that transaction is not valid until the desired block
 * height.
 *
 * @param {Number} height
 * @return {Transaction} this
 */
Transaction.prototype.lockUntilBlockHeight = function (height) {
  $.checkArgument(_.isNumber(height))
  if (height >= Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    throw new errors.Transaction.BlockHeightTooHigh()
  }
  if (height < 0) {
    throw new errors.Transaction.NLockTimeOutOfRange()
  }

  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].sequenceNumber === Input.DEFAULT_SEQNUMBER) {
      this.inputs[i].sequenceNumber = Input.DEFAULT_LOCKTIME_SEQNUMBER
    }
  }

  this.nLockTime = height
  return this
}

/**
 *  Returns a semantic version of the transaction's nLockTime.
 *  @return {Number|Date}
 *  If nLockTime is 0, it returns null,
 *  if it is < 500000000, it returns a block height (number)
 *  else it returns a Date object.
 */
Transaction.prototype.getLockTime = function () {
  if (!this.nLockTime) {
    return null
  }
  if (this.nLockTime < Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    return this.nLockTime
  }
  return new Date(1000 * this.nLockTime)
}

Transaction.prototype.fromString = function (string) {
  this.fromBuffer(buffer.Buffer.from(string, 'hex'))
}

Transaction.prototype._newTransaction = function () {
  this.version = CURRENT_VERSION
  this.nLockTime = DEFAULT_NLOCKTIME
}

/* Transaction creation interface */

/**
 * @typedef {Object} Transaction~fromObject
 * @property {string} prevTxId
 * @property {number} outputIndex
 * @property {(Buffer|string|Script)} script
 * @property {number} satoshis
 */

/**
 * Add an input to this transaction. This is a high level interface
 * to add an input, for more control, use @{link Transaction#addInput}.
 *
 * Can receive, as output information, the output of bitcoind's `listunspent` command,
 * and a slightly fancier format recognized by tbc:
 *
 * ```
 * {
 *  address: 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1',
 *  txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
 *  outputIndex: 0,
 *  script: Script.empty(),
 *  satoshis: 1020000
 * }
 * ```
 * Where `address` can be either a string or a tbc Address object. The
 * same is true for `script`, which can be a string or a tbc Script.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @example
 * ```javascript
 * var transaction = new Transaction();
 *
 * // From a pay to public key hash output from bitcoind's listunspent
 * transaction.from({'txid': '0000...', vout: 0, amount: 0.1, scriptPubKey: 'OP_DUP ...'});
 *
 * // From a pay to public key hash output
 * transaction.from({'txId': '0000...', outputIndex: 0, satoshis: 1000, script: 'OP_DUP ...'});
 *
 * // From a multisig P2SH output
 * transaction.from({'txId': '0000...', inputIndex: 0, satoshis: 1000, script: '... OP_HASH'},
 *                  ['03000...', '02000...'], 2);
 * ```
 *
 * @param {(Array.<Transaction~fromObject>|Transaction~fromObject)} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 */
Transaction.prototype.from = function (utxo, pubkeys, threshold) {
  if (_.isArray(utxo)) {
    var self = this
    _.each(utxo, function (utxo) {
      self.from(utxo, pubkeys, threshold)
    })
    return this
  }
  var exists = _.some(this.inputs, function (input) {
    // TODO: Maybe prevTxId should be a string? Or defined as read only property?
    return input.prevTxId.toString('hex') === utxo.txId && input.outputIndex === utxo.outputIndex
  })
  if (exists) {
    return this
  }
  if (pubkeys && threshold) {
    this._fromMultisigUtxo(utxo, pubkeys, threshold)
  } else {
    this._fromNonP2SH(utxo)
  }
  return this
}

Transaction.prototype._fromNonP2SH = function (utxo) {
  var Clazz
  utxo = new UnspentOutput(utxo)
  if (utxo.script.isPublicKeyHashOut()) {
    Clazz = PublicKeyHashInput
  } else if (utxo.script.isPublicKeyOut()) {
    Clazz = PublicKeyInput
  } else {
    Clazz = Input
  }
  this.addInput(new Clazz({
    output: new Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    script: Script.empty()
  }))
}

Transaction.prototype._fromMultisigUtxo = function (utxo, pubkeys, threshold) {
  $.checkArgument(threshold <= pubkeys.length,
    'Number of required signatures must be greater than the number of public keys')
  var Clazz
  utxo = new UnspentOutput(utxo)
  if (utxo.script.isMultisigOut()) {
    Clazz = MultiSigInput
  } else if (utxo.script.isScriptHashOut()) {
    Clazz = MultiSigScriptHashInput
  } else {
    throw new Error('@TODO')
  }
  this.addInput(new Clazz({
    output: new Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    script: Script.empty()
  }, pubkeys, threshold))
}

/**
 * Add an input to this transaction. The input must be an instance of the `Input` class.
 * It should have information about the Output that it's spending, but if it's not already
 * set, two additional parameters, `outputScript` and `satoshis` can be provided.
 *
 * @param {Input} input
 * @param {String|Script} outputScript
 * @param {number} satoshis
 * @return Transaction this, for chaining
 */
Transaction.prototype.addInput = function (input, outputScript, satoshis) {
  $.checkArgumentType(input, Input, 'input')
  if (!input.output && (_.isUndefined(outputScript) || _.isUndefined(satoshis))) {
    throw new errors.Transaction.NeedMoreInfo('Need information about the UTXO script and satoshis')
  }
  if (!input.output && outputScript && !_.isUndefined(satoshis)) {
    outputScript = outputScript instanceof Script ? outputScript : new Script(outputScript)
    $.checkArgumentType(satoshis, 'number', 'satoshis')
    input.output = new Output({
      script: outputScript,
      satoshis: satoshis
    })
  }
  return this.uncheckedAddInput(input)
}

/**
 * Add an input to this transaction, without checking that the input has information about
 * the output that it's spending.
 *
 * @param {Input} input
 * @return Transaction this, for chaining
 */
Transaction.prototype.uncheckedAddInput = function (input) {
  $.checkArgumentType(input, Input, 'input')
  this.inputs.push(input)
  this._inputAmount = undefined
  this._updateChangeOutput()
  return this
}

/**
 * Returns true if the transaction has enough info on all inputs to be correctly validated
 *
 * @return {boolean}
 */
Transaction.prototype.hasAllUtxoInfo = function () {
  return _.every(this.inputs.map(function (input) {
    return !!input.output
  }))
}

/**
 * Manually set the fee for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 *
 * @param {number} amount satoshis to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.fee = function (amount) {
  $.checkArgument(_.isNumber(amount), 'amount must be a number')
  this._fee = amount
  this._updateChangeOutput()
  return this
}

/**
 * Manually set the fee per KB for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 *
 * @param {number} amount satoshis per KB to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.feePerKb = function (amount) {
  $.checkArgument(_.isNumber(amount), 'amount must be a number')
  this._feePerKb = amount
  this._updateChangeOutput()
  return this
}

/* Output management */

/**
 * Set the change address for this transaction
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Address} address An address for change to be sent to.
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.change = function (address) {
  $.checkArgument(address, 'address is required')
  this._changeScript = Script.fromAddress(address)
  this._changeAddress = Address(address)
  this._updateChangeOutput()
  return this
}

/**
 * @return {Output} change output, if it exists
 */
Transaction.prototype.getChangeOutput = function () {
  if (!_.isUndefined(this._changeIndex)) {
    return this.outputs[this._changeIndex]
  }
  return null
}

/**
 * @return {Address | null} change address, if it exists
 */
Transaction.prototype.getChangeAddress = function () {
  return this._changeAddress ? this._changeAddress : null
}

/**
 * @typedef {Object} Transaction~toObject
 * @property {(string|Address)} address
 * @property {number} satoshis
 */

/**
 * Add an output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {(string|Address|Array.<Transaction~toObject>)} address
 * @param {number} amount in satoshis
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.to = function (address, amount) {
  if (_.isArray(address)) {
    var self = this
    _.each(address, function (to) {
      self.to(to.address, to.satoshis)
    })
    return this
  }

  $.checkArgument(
    JSUtil.isNaturalNumber(amount),
    'Amount is expected to be a positive integer'
  )
  this.addOutput(new Output({
    script: Script(new Address(address)),
    satoshis: amount
  }))
  return this
}

/**
 * Add an OP_RETURN output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Buffer|string} value the data to be stored in the OP_RETURN output.
 *    In case of a string, the UTF-8 representation will be stored
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addData = function (value) {
  this.addOutput(new Output({
    script: Script.buildDataOut(value),
    satoshis: 0
  }))
  return this
}

/**
 * Add an OP_FALSE | OP_RETURN output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Buffer|string} value the data to be stored in the OP_RETURN output.
 *    In case of a string, the UTF-8 representation will be stored
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addSafeData = function (value) {
  this.addOutput(new Output({
    script: Script.buildSafeDataOut(value),
    satoshis: 0
  }))
  return this
}

/**
 * Add an output to the transaction.
 *
 * @param {Output} output the output to add.
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addOutput = function (output) {
  $.checkArgumentType(output, Output, 'output')
  this._addOutput(output)
  this._updateChangeOutput()
  return this
}

/**
 * Remove all outputs from the transaction.
 *
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.clearOutputs = function () {
  this.outputs = []
  this._clearSignatures()
  this._outputAmount = undefined
  this._changeIndex = undefined
  this._updateChangeOutput()
  return this
}

Transaction.prototype._addOutput = function (output) {
  this.outputs.push(output)
  this._outputAmount = undefined
}

/**
 * Calculates or gets the total output amount in satoshis
 *
 * @return {Number} the transaction total output amount
 */
Transaction.prototype._getOutputAmount = function () {
  if (_.isUndefined(this._outputAmount)) {
    var self = this
    this._outputAmount = 0
    _.each(this.outputs, function (output) {
      self._outputAmount += output.satoshis
    })
  }
  return this._outputAmount
}

/**
 * Calculates or gets the total input amount in satoshis
 *
 * @return {Number} the transaction total input amount
 */
Transaction.prototype._getInputAmount = function () {
  if (_.isUndefined(this._inputAmount)) {
    var self = this
    this._inputAmount = 0
    _.each(this.inputs, function (input) {
      if (_.isUndefined(input.output)) {
        throw new errors.Transaction.Input.MissingPreviousOutput()
      }
      self._inputAmount += input.output.satoshis
    })
  }
  return this._inputAmount
}

Transaction.prototype._updateChangeOutput = function () {
  if (this.sealed) {
    throw new errors.Transaction.TransactionAlreadySealed()
  }

  if (!this._changeScript) {
    return
  }
  if (!_.isUndefined(this._changeIndex)) {
    this._removeOutput(this._changeIndex)
  }
  this._changeIndex = this.outputs.length
  this._addOutput(new Output({
    script: this._changeScript,
    satoshis: 0
  }))
  var available = this.getUnspentValue()
  var fee = this.getFee()
  var changeAmount = available - fee
  this._removeOutput(this._changeIndex)
  this._changeIndex = undefined
  if (changeAmount >= Transaction.DUST_AMOUNT) {
    this._changeIndex = this.outputs.length
    this._addOutput(new Output({
      script: this._changeScript,
      satoshis: changeAmount
    }))
  }
  this._clearSignatures()
}
/**
 * Calculates the fee of the transaction.
 *
 * If there's a fixed fee set, return that.
 *
 * If there is no change output set, the fee is the
 * total value of the outputs minus inputs. Note that
 * a serialized transaction only specifies the value
 * of its outputs. (The value of inputs are recorded
 * in the previous transaction outputs being spent.)
 * This method therefore raises a "MissingPreviousOutput"
 * error when called on a serialized transaction.
 *
 * If there's no fee set and no change address,
 * estimate the fee based on size.
 *
 * @return {Number} fee of this transaction in satoshis
 */
Transaction.prototype.getFee = function () {
  if (this.isCoinbase()) {
    return 0
  }
  if (!_.isUndefined(this._fee)) {
    return this._fee
  }
  // if no change output is set, fees should equal all the unspent amount
  if (!this._changeScript) {
    return this.getUnspentValue()
  }
  return this._estimateFee()
}

/**
 * Estimates fee from serialized transaction size in bytes.
 */
Transaction.prototype._estimateFee = function () {
  var estimatedSize = this._estimateSize()
  return Math.ceil(estimatedSize / 1000 * (this._feePerKb || Transaction.FEE_PER_KB))
}

Transaction.prototype.getUnspentValue = function () {
  return this._getInputAmount() - this._getOutputAmount()
}

Transaction.prototype._clearSignatures = function () {
  _.each(this.inputs, function (input) {
    input.clearSignatures()
  })
}

// 4    version
// ???  num inputs (VARINT)
// --- input list ---
//
// ???  num outputs (VARINT)
// --- output list ---
//      8       value
//      ???     script size (VARINT)
//      ???     script
//
// 4    locktime
Transaction.prototype.getEstimateSize = function () {
  return this._estimateSize()
}

Transaction.prototype._estimateSize = function () {
  var result = 4 + 4 // size of version + size of locktime
  result += Varint(this.inputs.length).toBuffer().length
  result += Varint(this.outputs.length).toBuffer().length
  _.each(this.inputs, function (input) {
    result += input._estimateSize()
  })
  _.each(this.outputs, function (output) {
    result += output.getSize()
  })
  return result
}

Transaction.prototype._removeOutput = function (index) {
  var output = this.outputs[index]
  this.outputs = _.without(this.outputs, output)
  this._outputAmount = undefined
}

Transaction.prototype.removeOutput = function (index) {
  this._removeOutput(index)
  this._updateChangeOutput()
}

/**
 * Sort a transaction's inputs and outputs according to BIP69
 *
 * @see {https://github.com/bitcoin/bips/blob/master/bip-0069.mediawiki}
 * @return {Transaction} this
 */
Transaction.prototype.sort = function () {
  this.sortInputs(function (inputs) {
    var copy = Array.prototype.concat.apply([], inputs)
    copy.sort(function (first, second) {
      return first.prevTxId.compare(second.prevTxId) ||
        first.outputIndex - second.outputIndex
    })
    return copy
  })
  this.sortOutputs(function (outputs) {
    var copy = Array.prototype.concat.apply([], outputs)
    copy.sort(function (first, second) {
      return first.satoshis - second.satoshis ||
        first.script.toBuffer().compare(second.script.toBuffer())
    })
    return copy
  })
  return this
}

/**
 * Randomize this transaction's outputs ordering. The shuffling algorithm is a
 * version of the Fisher-Yates shuffle.
 *
 * @return {Transaction} this
 */
Transaction.prototype.shuffleOutputs = function () {
  return this.sortOutputs(_.shuffle)
}

/**
 * Sort this transaction's outputs, according to a given sorting function that
 * takes an array as argument and returns a new array, with the same elements
 * but with a different order. The argument function MUST NOT modify the order
 * of the original array
 *
 * @param {Function} sortingFunction
 * @return {Transaction} this
 */
Transaction.prototype.sortOutputs = function (sortingFunction) {
  var outs = sortingFunction(this.outputs)
  return this._newOutputOrder(outs)
}

/**
 * Sort this transaction's inputs, according to a given sorting function that
 * takes an array as argument and returns a new array, with the same elements
 * but with a different order.
 *
 * @param {Function} sortingFunction
 * @return {Transaction} this
 */
Transaction.prototype.sortInputs = function (sortingFunction) {
  this.inputs = sortingFunction(this.inputs)
  this._clearSignatures()
  return this
}

Transaction.prototype._newOutputOrder = function (newOutputs) {
  var isInvalidSorting = (this.outputs.length !== newOutputs.length ||
    _.difference(this.outputs, newOutputs).length !== 0)
  if (isInvalidSorting) {
    throw new errors.Transaction.InvalidSorting()
  }

  if (!_.isUndefined(this._changeIndex)) {
    var changeOutput = this.outputs[this._changeIndex]
    this._changeIndex = newOutputs.indexOf(changeOutput)
  }

  this.outputs = newOutputs
  return this
}

Transaction.prototype.removeInput = function (txId, outputIndex) {
  var index
  if (!outputIndex && _.isNumber(txId)) {
    index = txId
  } else {
    index = _.findIndex(this.inputs, function (input) {
      return input.prevTxId.toString('hex') === txId && input.outputIndex === outputIndex
    })
  }
  if (index < 0 || index >= this.inputs.length) {
    throw new errors.Transaction.InvalidIndex(index, this.inputs.length)
  }
  var input = this.inputs[index]
  this.inputs = _.without(this.inputs, input)
  this._inputAmount = undefined
  this._updateChangeOutput()
}

/* Signature handling */

/**
 * Sign the transaction using one or more private keys.
 *
 * It tries to sign each input, verifying that the signature will be valid
 * (matches a public key).
 *
 * @param {Array|String|PrivateKey} privateKey
 * @param {number} sigtype
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.sign = function (privateKey, sigtype) {
  $.checkState(this.hasAllUtxoInfo(), 'Not all utxo information is available to sign the transaction.')
  var self = this
  if (_.isArray(privateKey)) {
    _.each(privateKey, function (privateKey) {
      self.sign(privateKey, sigtype)
    })
    return this
  }
  _.each(this.getSignatures(privateKey, sigtype), function (signature) {
    self.applySignature(signature)
  })

  this._privateKey = privateKey
  this._sigType = sigtype
  return this
}

Transaction.prototype.getSignatures = function (privKey, sigtype) {
  privKey = new PrivateKey(privKey)
  // By default, signs using ALL|FORKID
  sigtype = sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID)
  var transaction = this
  var results = []
  var hashData = Hash.sha256ripemd160(privKey.publicKey.toBuffer())
  _.each(this.inputs, function forEachInput(input, index) {
    _.each(input.getSignatures(transaction, privKey, index, sigtype, hashData), function (signature) {
      results.push(signature)
    })
  })
  return results
}

/**
 * Add a signature to the transaction
 *
 * @param {Object} signature
 * @param {number} signature.inputIndex
 * @param {number} signature.sigtype
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.applySignature = function (signature) {
  this.inputs[signature.inputIndex].addSignature(this, signature)
  return this
}

Transaction.prototype.isFullySigned = function () {
  _.each(this.inputs, function (input) {
    if (input.isFullySigned === Input.prototype.isFullySigned) {
      throw new errors.Transaction.UnableToVerifySignature(
        'Unrecognized script kind, or not enough information to execute script.' +
        'This usually happens when creating a transaction from a serialized transaction'
      )
    }
  })
  return _.every(_.map(this.inputs, function (input) {
    return input.isFullySigned()
  }))
}

Transaction.prototype.isValidSignature = function (signature) {
  var self = this
  if (this.inputs[signature.inputIndex].isValidSignature === Input.prototype.isValidSignature) {
    throw new errors.Transaction.UnableToVerifySignature(
      'Unrecognized script kind, or not enough information to execute script.' +
      'This usually happens when creating a transaction from a serialized transaction'
    )
  }
  return this.inputs[signature.inputIndex].isValidSignature(self, signature)
}

/**
 * @returns {bool} whether the signature is valid for this transaction input
 */
Transaction.prototype.verifySignature = function (sig, pubkey, nin, subscript, satoshisBN, flags) {
  return Sighash.verify(this, sig, pubkey, nin, subscript, satoshisBN, flags)
}

/**
 * Check that a transaction passes basic sanity tests. If not, return a string
 * describing the error. This function contains the same logic as
 * CheckTransaction in bitcoin core.
 */
Transaction.prototype.verify = function (notVerifyInput) {
  // Basic checks that don't depend on any context
  if (this.inputs.length === 0) {
    return 'transaction txins empty'
  }

  if (this.outputs.length === 0) {
    return 'transaction txouts empty'
  }

  // Check for negative or overflow output values
  var valueoutbn = new BN(0)
  for (var i = 0; i < this.outputs.length; i++) {
    var txout = this.outputs[i]

    if (txout.invalidSatoshis()) {
      return 'transaction txout ' + i + ' satoshis is invalid'
    }
    if (txout._satoshisBN.gt(new BN(Transaction.MAX_MONEY, 10))) {
      return 'transaction txout ' + i + ' greater than MAX_MONEY'
    }
    valueoutbn = valueoutbn.add(txout._satoshisBN)
    if (valueoutbn.gt(new BN(Transaction.MAX_MONEY))) {
      return 'transaction txout ' + i + ' total output greater than MAX_MONEY'
    }
  }

  // Check for duplicate inputs
  var txinmap = {}
  for (i = 0; i < this.inputs.length; i++) {
    var txin = this.inputs[i]

    var inputid = txin.prevTxId + ':' + txin.outputIndex
    if (!_.isUndefined(txinmap[inputid])) {
      return 'transaction input ' + i + ' duplicate input'
    }
    txinmap[inputid] = true
  }

  var isCoinbase = this.isCoinbase()
  if (isCoinbase) {
    var buf = this.inputs[0]._scriptBuffer
    if (buf.length < 2 || buf.length > 100) {
      return 'coinbase transaction script size invalid'
    }
  } else {
    for (i = 0; i < this.inputs.length; i++) {
      if (this.inputs[i].isNull()) {
        return 'transaction input ' + i + ' has null input'
      }

      if (!notVerifyInput) {
        var res = this.inputs[i].verify(this, i)
        if (!res.success) {
          return 'transaction input ' + i + ' VerifyError: ' + res.error
        }
      }
    }
  }
  return true
}

/**
 * Analogous to bitcoind's IsCoinBase function in transaction.h
 */
Transaction.prototype.isCoinbase = function () {
  return (this.inputs.length === 1 && this.inputs[0].isNull())
}

/**
 *
 * @param {number | object} inputIndex or option
 * @param {Script|(tx, output) => Script} unlockScriptOrCallback  unlockScript or a callback returns unlockScript
 * @returns unlockScript of the special input
 */
Transaction.prototype.setInputScript = function (options, unlockScriptOrCallback) {
  var inputIndex = 0
  var privateKey
  var sigtype
  var isLowS = false
  if (typeof options === 'number') {
    inputIndex = options
    sigtype = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
  } else {
    inputIndex = options.inputIndex || 0
    privateKey = options.privateKey
    sigtype = options.sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID)
    isLowS = options.isLowS || false
  }

  if (unlockScriptOrCallback instanceof Function) {
    var outputInPrevTx = this.inputs[inputIndex].output
    this._inputsMap.set(inputIndex, {
      sigtype,
      privateKey,
      isLowS,
      callback: unlockScriptOrCallback
    })
    var unlockScript = unlockScriptOrCallback(this, outputInPrevTx)
    this.inputs[inputIndex].setScript(unlockScript)
  } else {
    this.inputs[inputIndex].setScript(unlockScriptOrCallback)
  }

  return this
}

/**
 *
 * @param {number | object} inputIndex or option
 * @param {(tx, output) => Promise<Script>} unlockScriptOrCallback  a callback returns a unlocking script
 * @returns A promise which resolves to unlockScript of the special input
 */
Transaction.prototype.setInputScriptAsync = async function (options, unlockScriptOrCallback) {
  var inputIndex = 0
  var sigtype
  var isLowS = false
  if (typeof options === 'number') {
    inputIndex = options
    sigtype = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
  } else {
    inputIndex = options.inputIndex || 0
    sigtype = options.sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID)
    isLowS = options.isLowS || false
  }

  if (unlockScriptOrCallback instanceof Function) {
    var outputInPrevTx = this.inputs[inputIndex].output
    this._inputsMap.set(inputIndex, {
      sigtype,
      isLowS,
      callback: unlockScriptOrCallback
    })
    var unlockScript = await unlockScriptOrCallback(this, outputInPrevTx)
    this.inputs[inputIndex].setScript(unlockScript)
  } else {
    throw new errors.InvalidArgument('Must provide a callback returns a unlocking script')
  }

  return this
}

Transaction.prototype.setInputSequence = function (inputIndex, sequence) {
  this.inputs[inputIndex].sequenceNumber = sequence
  return this
}

/**
 *
 * @param {number} outputIndex
 * @param {Output|(tx) => Output} outputOrcb  output or a callback returns output
 * @returns output
 */
Transaction.prototype.setOutput = function (outputIndex, outputOrcb) {
  if (outputOrcb instanceof Function) {
    this._outputsMap.set(outputIndex, outputOrcb)
    this.outputs[outputIndex] = outputOrcb(this)
  } else {
    this.outputs[outputIndex] = outputOrcb
  }

  this._updateChangeOutput()
  return this
}

/**
 * Seal a transaction. After the transaction is sealed, except for the unlock script entered,
 * other attributes of the transaction cannot be modified
 */
Transaction.prototype.seal = function () {
  var self = this

  this._outputsMap.forEach(function (callback, key) {
    self.outputs[key] = callback(self)
  })

  this._updateChangeOutput()

  this._inputsMap.forEach(function (options, key) {
    var outputInPrevTx = self.inputs[key].output
    var unlockScript = options.callback(self, outputInPrevTx)
    self.inputs[key].setScript(unlockScript)
  })

  if (this._privateKey) {
    this.sign(this._privateKey, this._sigType)
  }

  this.sealed = true

  return this
}

/**
 * Seal a transaction asynchronously. After the transaction is sealed, except for the unlock script entered,
 * other attributes of the transaction cannot be modified
 */
Transaction.prototype.sealAsync = async function () {
  var self = this

  this._outputsMap.forEach(function (callback, key) {
    self.outputs[key] = callback(self)
  })

  this._updateChangeOutput()

  var promises = []

  this._inputsMap.forEach(function (options, key) {
    var outputInPrevTx = self.inputs[key].output

    promises.push(
      Promise.resolve(options.callback(self, outputInPrevTx)).then(unlockScript => {
        return { key, unlockScript }
      })
    )
  })

  await Promise.all(promises).then(items => {
    items.forEach(({ key, unlockScript }) => {
      self.inputs[key].setScript(unlockScript)
    })
  })

  if (this._privateKey) {
    this.sign(this._privateKey, this._sigType)
  }

  this.sealed = true

  return this
}

Transaction.prototype.setLockTime = function (nLockTime) {
  this.nLockTime = nLockTime
  return this
}

/**
 *
 * @returns satoshis of change output
 */
Transaction.prototype.getChangeAmount = function () {
  if (_.isUndefined(this._changeIndex)) {
    return 0
  }

  return this.outputs[this._changeIndex].satoshis
}

/**
 *
 * @returns estimate fee by transaction size
 */
Transaction.prototype.getEstimateFee = function () {
  return this._estimateFee()
}

/**
 *
 * @param {number} feePerKb the fee per KB for this transaction
 * @returns true or false
 */
Transaction.prototype.checkFeeRate = function (feePerKb) {
  var fee = this.getUnspentValue()

  var estimatedSize = this._estimateSize()
  var expectedRate = (feePerKb || this._feePerKb || Transaction.FEE_PER_KB) / 1000
  var realFeeRate = fee / estimatedSize
  return realFeeRate >= expectedRate
}

/**
 *
 * @returns the serialization of all input outpoints
 */
Transaction.prototype.prevouts = function () {
  var writer = new BufferWriter()

  _.each(this.inputs, function (input) {
    writer.writeReverse(input.prevTxId)
    writer.writeUInt32LE(input.outputIndex)
  })

  var buf = writer.toBuffer()
  return buf.toString('hex')
}

/**
 *
 * @returns if the transaction is sealed
 */
Transaction.prototype.isSealed = function () {
  return this.sealed
}

Transaction.prototype.getPreimage = function (inputIndex, sigtype, isLowS, csIdx) {
  $.checkArgumentType(inputIndex, 'number', 'inputIndex')
  sigtype = sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID)
  isLowS = isLowS || false
  inputIndex = inputIndex || 0
  var preimage = this.inputs[inputIndex].getPreimage(this, inputIndex, sigtype, isLowS, csIdx)
  return preimage.toString('hex')
}

Transaction.prototype.getSignature = function (inputIndex, privateKeys, sigtypes) {
  $.checkArgumentType(inputIndex, 'number', 'inputIndex')
  var results = []
  var inputOpt = (this._inputsMap || new Map()).get(inputIndex)

  privateKeys = privateKeys ||
    (inputOpt ? inputOpt.privateKey : this._privateKey)

  if (privateKeys) {
    sigtypes = sigtypes || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID)
    var sigs = this.inputs[inputIndex].getSignatures(this, privateKeys, inputIndex, sigtypes)

    _.each(sigs, function (sig) {
      results.push(sig.signature.toTxFormat().toString('hex'))
    })

    if (results.length === 1) {
      return results[0]
    }

    return results
  }

  return []
}

Transaction.prototype.addInputFromPrevTx = function (prevTx, outputIndex) {
  $.checkArgumentType(prevTx, Transaction, 'prevTx')

  var outputIdx = outputIndex || 0

  const output = prevTx.outputs[outputIdx]

  if (output.script.isPublicKeyHashOut()) {
    return this.addInput(new PublicKeyHashInput({
      prevTxId: prevTx.id,
      outputIndex: outputIdx,
      script: new Script(''), // placeholder
      output: output
    }))
  } else {
    return this.addInput(new Input({
      prevTxId: prevTx.id,
      outputIndex: outputIdx,
      script: new Script(''), // placeholder
      output: output
    }))
  }
}

Transaction.prototype.addDummyInput = function (script, satoshis) {
  $.checkArgumentType(script, Script, 'script')
  $.checkArgumentType(satoshis, 'number', 'satoshis')

  return this.addInput(new Input({
    prevTxId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: new Script(''), // placeholder
    output: new Output({
      script: script,
      satoshis: satoshis
    })
  }))
}

/**
 * Same as change(addresss), but using the address of Transaction.DUMMY_PRIVATEKEY as default change address
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.dummyChange = function () {
  return this.change(Transaction.DUMMY_PRIVATEKEY.toAddress())
}

Transaction.prototype.verifyScript = function (inputIndex) {
  $.checkArgumentType(inputIndex, 'number', 'inputIndex')

  if (!this.inputs[inputIndex]) {
    throw new errors.Transaction.Input.MissingInput()
  }

  return this.inputs[inputIndex].verify(this, inputIndex)
}

/**
 * @deprecated, please use `verifyScript` instead
 */
Transaction.prototype.verifyInputScript = function (inputIndex) {
  return this.verifyScript(inputIndex)
}

Transaction.prototype.getInputAmount = function (inputIndex) {
  $.checkArgumentType(inputIndex, 'number', 'inputIndex')

  if (!this.inputs[inputIndex]) {
    throw new errors.Transaction.Input.MissingInput()
  }

  return this.inputs[inputIndex].output.satoshis
}

Transaction.prototype.getOutputAmount = function (outputIndex) {
  $.checkArgumentType(outputIndex, 'number', 'outputIndex')

  if (!this.outputs[outputIndex]) {
    throw new errors.Transaction.MissingOutput()
  }

  return this.outputs[outputIndex].satoshis
}

module.exports = Transaction
