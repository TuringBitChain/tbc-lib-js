const axios = require('axios');
const Transaction = require('tbc-lib-js/lib/transaction/transaction');
const Output = require('tbc-lib-js/lib/transaction/output');
const BufferWriter = require('tbc-lib-js/lib/encoding/bufferwriter');
const Signature = require('tbc-lib-js/lib/crypto/signature');
const Script = require('tbc-lib-js/lib/script');
const tbc = require('tbc-lib-js');
const Hash = require('tbc-lib-js/lib/crypto/hash');
const TBCNft = {};

/**
 * Fetch the public key hash of a transaction output.
 * This function retrieves the raw transaction hex from the network and extracts the public key hash
 * from the second output of the transaction (standard P2PKH script).
 *
 * @param {string} txid - The transaction ID.
 * @return {Promise<string>} - A promise that resolves with the public key hash.
 * @throws {Error} - Throws an error if the output script is invalid or cannot be found.
 */
TBCNft.fetchpubkeyhash = async function (txid) {
  const url = `https://turingwallet/v1/tbc/main/tx/hex/${txid}`;
  try {
    const response = await axios.get(url);
    const rawtx = response.data;
    const tx = Transaction.fromHex(rawtx);
    const outputScript = tx.outputs[1].script; // Fetch the locking script of the second output.

    if (!outputScript) {
      throw new Error("Invalid output script or script not found.");
    }

    const chunks = outputScript.toString().split(' ');
    if (chunks.length === 5 && chunks[0] === 'OP_DUP' && chunks[1] === 'OP_HASH160' && chunks[3] === 'OP_EQUALVERIFY' && chunks[4] === 'OP_CHECKSIG') {
      return chunks[2]; // Extract and return the public key hash.
    } else {
      throw new Error("The output script is not a standard P2PKH script.");
    }
  } catch (error) {
    console.error("Error fetching pubkeyhash:", error);
    throw new Error("Failed to fetch pubkeyhash.");
  }
};

/**
 * Fetch the raw transaction data from the network.
 * This function retrieves the raw transaction hex and processes it using a provided function.
 *
 * @param {string} txid - The transaction ID.
 * @param {Function} generateDataFn - The function to process the transaction.
 * @return {Promise<string>} - A promise that resolves with the processed transaction data.
 * @throws {Error} - Throws an error if the transaction data cannot be fetched or processed.
 */
TBCNft.fetchTransactionData = async function (txid, generateDataFn) {
  const url = `https://turingwallet/v1/tbc/main/tx/hex/${txid}`;
  try {
    const response = await axios.get(url);
    const rawtx = response.data;
    const tx = Transaction.fromHex(rawtx);
    return generateDataFn(tx, 0); // Generate and return the data.
  } catch (error) {
    console.error("Error fetching transaction data:", error);
    throw new Error("Failed to fetch transaction data.");
  }
};

/**
 * Generate the previous transaction data.
 * This function creates a serialized buffer from the previous transaction's inputs and outputs.
 *
 * @param {Transaction} tx - The transaction object.
 * @param {number} vout - The index of the output.
 * @return {string} - The serialized data in hex format.
 */
TBCNft.generatePreTxData = function (tx, vout) {
  const writer = new BufferWriter();
  writer.write(tx.inputs[vout].prevTxId);
  writer.writeUInt32LE(tx.inputs[vout].outputIndex);
  writer.write(Hash.sha256(Buffer.from(tx.outputs[vout].script.toHex())));
  return writer.toBuffer().toString('hex');
};

/**
 * Generate the data of the transaction before the previous one.
 * This function creates a serialized buffer from the grandparent transaction's inputs and outputs.
 *
 * @param {Transaction} tx - The transaction object.
 * @param {number} vout - The index of the output.
 * @return {string} - The serialized data in hex format.
 */
TBCNft.generatePrepreTxData = function (tx, vout) {
  const writer = new BufferWriter();
  writer.write(tx.id);
  writer.writeUInt32LE(tx.inputs[vout].outputIndex);
  writer.write(Hash.sha256(Buffer.from(tx.outputs[vout].script.toHex())));
  return writer.toBuffer().toString('hex');
};

/**
 * Generate verification data for the specified UTXO.
 * This function serializes the UTXO information for later verification.
 *
 * @param {Object} utxo - The unspent transaction output object.
 * @return {string} - The serialized UTXO data in hex format.
 */
TBCNft.generateVerifyData = function (utxo) {
  const writer = new BufferWriter();
  writer.write(Buffer.from(utxo.txid, 'hex')); // Write the UTXO's transaction ID.
  writer.writeUInt32LE(utxo.vout);
  writer.write('ffffffff'); // Custom structure.
  return writer.toBuffer().toString('hex');
};

/**
 * Fetch verification data for all outputs in the transaction.
 * This function combines and hashes the output scripts and values.
 *
 * @param {Transaction} tx - The transaction object.
 * @return {string} - The serialized and hashed output verification data.
 */
TBCNft.fetchOutputsVerifyData = function (tx) {
  const OutputsCombinedBuffers = [];
  // Iterate through all outputs and serialize their data.
  for (const output of tx.outputs) {
    const satoshisBuffer = Buffer.alloc(8);
    satoshisBuffer.writeBigUInt64LE(BigInt(output.satoshis), 0);
    OutputsCombinedBuffers.push(satoshisBuffer);
    OutputsCombinedBuffers.push(Hash.sha256(output.script.toBuffer()));
  }
  const combinedOutputsBuffer = Buffer.concat(OutputsCombinedBuffers);
  return Hash.sha256(combinedOutputsBuffer).toString('hex');
};

/**
 * Generate the special locking script for the NFT.
 * This script controls the conditions under which the NFT can be spent.
 *
 * @param {string} txid - The transaction ID.
 * @param {number} vout - The output index.
 * @return {Script} - The generated locking script.
 */
TBCNft.getNFTlock = function (txid, vout) {
  const writer = new BufferWriter();
  writer.write(Buffer.from(txid, 'hex'));
  writer.writeUInt32LE(vout);
  const IsutxoHex = writer.toBuffer().toString('hex');

  const lockingScript = new Script.fromASM(
    `OP_TOALTSTACK OP_DUP OP_HASH160 OP_FROMALTSTACK OP_EQUALVERIFY OP_CHECKSIG OP_1 OP_EQUALVERIFY OP_6 OP_PUSH_META OP_EQUALVERIFY OP_7 OP_PUSH_META OP_EQUALVERIFY 36 OP_SPLIT OP_SWAP OP_TOALTSTACK OP_TOALTSTACK 36 OP_SPLIT OP_FROMALTSTACK OP_EQUAL OP_IF OP_DROP OP_TRUE OP_RETURN OP_ELSE OP_DUP OP_FROMALTSTACK OP_EQUALVERIFY ${IsutxoHex} OP_EQUAL OP_ENDIF`
  );

  return lockingScript;
};

/**
 * Generate the special unlocking script for the NFT.
 * This script is used to unlock and spend the NFT based on specified conditions.
 *
 * @param {PrivateKey} privkey - The private key used for signing.
 * @param {Object} utxo - The UTXO object being spent.
 * @param {Transaction} tx - The transaction object.
 * @param {number} index - The input index.
 * @return {Promise<Script>} - A promise that resolves with the generated unlocking script.
 */
TBCNft.getNFTunlock = async function (privkey, utxo, tx, index = 0) {
  const OutputsVerifyData = TBCNft.fetchOutputsVerifyData(tx);
  const pubKeyHash = await TBCNft.fetchpubkeyhash(utxo.txid);
  const InputsVerifyData = Hash.sha256(Buffer.from(TBCNft.generateVerifyData(utxo), 'hex')).toString('hex');
  const PreTxData = await TBCNft.fetchTransactionData(utxo.txid, TBCNft.generatePreTxData);
  const PrepreTxData = await TBCNft.fetchTransactionData(PreTxData.slice(0, 64), TBCNft.generatePrepreTxData);

  const pubKeyBuffer = TBCNft.fetchpubkeyhash(txid);
  const sig = tx.getSignature(index, privkey);
  const unlockingScript = new Script()
    .add(Buffer.from(PrepreTxData, 'hex'))
    .add(Buffer.from(PreTxData, 'hex'))
    .add(Buffer.from(OutputsVerifyData, 'hex'))
    .add(Buffer.from(InputsVerifyData, 'hex'))
    .add(Buffer.from(sig, 'hex'))
    .add(Buffer.from(pubKeyBuffer))
    .add(Buffer.from(pubKeyHash, 'hex'));

  return unlockingScript;
};

/**
 * Create an NFT transaction.
 * This function builds and signs a new NFT transaction with specified outputs and scripts.
 *
 * @param {Object} utxo - The UTXO object to be spent.
 * @param {PrivateKey} walletPrivateKey - The wallet's private key.
 * @param {Address} nftAddress - The NFT address.
 * @param {Object} nftData - The NFT metadata to be stored.
 * @return {Promise<string>} - A promise that resolves with the serialized transaction in hex format.
 */
TBCNft.CreateNFT = async function (utxo, walletPrivateKey, nftAddress, nftData) {
  const walletAddress = walletPrivateKey.toAddress(); // Extract wallet address.
  const nftHex = Buffer.from(JSON.stringify(nftData)).toString('hex'); // Convert NFT data to hex format.

  const NFT_OUTPUT_SIZE = 1000; // Define NFT output size.
  const P2PKH_OUTPUT_SIZE = 34; // P2PKH output size.
  const P2PKH_INPUT_SIZE = 148; // P2PKH input size.
  const FEE_PER_BYTE = 0.08; // Fee per byte.
  const DUST = 42; // Minimum dust amount.
  let feeSats = 80; // Default fee.
  const totalOutSats = 300; // Total output amount in satoshis.

  const estimatedOutputSize = 8 + 2 + nftHex.length / 2 + NFT_OUTPUT_SIZE + P2PKH_OUTPUT_SIZE + P2PKH_OUTPUT_SIZE; // Estimated output size.
  const estimatedInputSize = P2PKH_INPUT_SIZE; // Estimated input size.
  const estimatedTotalSize = estimatedOutputSize + estimatedInputSize; // Total size.

  feeSats = Math.max(feeSats, Math.ceil(estimatedTotalSize * FEE_PER_BYTE + 1)); // Calculate the actual fee.

  // Create the first output with a locking script.
  const firstOutputScript = TBCNft.getNFTlock(utxo.txId, utxo.outputIndex);

  // Create the transaction and add outputs.
  const tx = new Transaction()
    .from(utxo)
    .addOutput(new Output({
      script: firstOutputScript,
      satoshis: 100,
    }));

  // Add the second output for the NFT address.
  const nftScript = Script.buildPublicKeyHashOut(nftAddress);
  tx.addOutput(new Output({
    script: nftScript,
    satoshis: 100,
  }));

  // Add the third output with NFT metadata stored in OP_RETURN.
  const thirdOutputScript = Script.fromASM(`OP_RETURN ${nftHex}`);
  tx.addOutput(new Output({
    script: thirdOutputScript,
    satoshis: 100,
  }));

  // Create a change output if applicable.
  const changeAmount = utxo.satoshis - totalOutSats - feeSats;
  if (changeAmount > DUST) {
    const changeScript = Script.buildPublicKeyHashOut(walletAddress);
    tx.addOutput(new Output({
      script: changeScript,
      satoshis: changeAmount,
    }));
  }

  // Sign the transaction and seal it.
  tx.sign(walletPrivateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID).seal();
  return tx.uncheckedSerialize(); // Return the serialized transaction in hex format.
};

// Export the module.
module.exports = TBCNft;
