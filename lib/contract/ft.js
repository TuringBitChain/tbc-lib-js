"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FT = void 0;
exports.getNftTxdata = getNftTxdata;
exports.getCurrentInputsdata = getCurrentInputsdata;
exports.getCurrentTxdata = getCurrentTxdata;
exports.getPreTxdata = getPreTxdata;
exports.getPrePreTxdata = getPrePreTxdata;
exports.getSize = getSize;
const tbc = __importStar(require("tbc-lib-js"));
const axios_1 = __importDefault(require("axios"));
const partial_sha256 = __importStar(require("tbc-lib-js/lib/util/partial-sha256"));
const version = 10;
const vliolength = '10'; // Version + nLockTime + inputCount + outputCount (16 bytes)
const amountlength = '08'; // Length of the amount field (8 bytes)
const hashlength = '20'; // Length of the hash field (32 bytes)
/**
 * Class representing transaction output data for FT (Fungible Token) operations.
 */
class TransactionOutputsData {
    /**
     * Constructs the TransactionOutputsData instance.
     * @param tx - The transaction object.
     * @param vout - The output index in the transaction.
     */
    constructor(tx, vout) {
        // Retrieve code and tape scripts
        this.codeScript = tx.outputs[vout].script.toBuffer().toString('hex');
        this.tapeScript = tx.outputs[vout + 1].script.toBuffer().toString('hex');
        // Retrieve decimal value from tape script (53rd byte)
        const tapeBuffer = Buffer.from(this.tapeScript, 'hex');
        this.decimal = tapeBuffer[52]; // 53rd byte (index starts from 0)
        // Retrieve name and symbol from tape script
        const nameLength = tapeBuffer[53]; // 54th byte (name length)
        const nameStartIndex = 54;
        const nameEndIndex = nameStartIndex + nameLength;
        this.name = tapeBuffer.subarray(nameStartIndex, nameEndIndex).toString('utf8');
        const symbolLength = tapeBuffer[nameEndIndex]; // Symbol length after name
        const symbolStartIndex = nameEndIndex + 1;
        const symbolEndIndex = symbolStartIndex + symbolLength;
        this.symbol = tapeBuffer.subarray(symbolStartIndex, symbolEndIndex).toString('utf8');
        // Calculate the total tape amount by summing the values in the tape script
        this.tapeAmount = 0;
        for (let i = 3; i < 51; i += 8) {
            const valueBuffer = tapeBuffer.subarray(i, i + 8);
            const valueLE = valueBuffer.readBigUInt64LE(); // Read as little-endian 64-bit unsigned integer
            this.tapeAmount += Number(valueLE); // Convert to decimal and accumulate
        }
    }
}
/**
 * Class representing a Fungible Token (FT) with methods for minting and transferring.
 */
class FT {
    /**
     * Constructs the FT instance either from a transaction ID or parameters.
     * @param txidOrParams - Either a contract transaction ID or token parameters.
     */
    constructor(txidOrParams) {
        this.name = '';
        this.symbol = '';
        this.decimal = 0;
        this.totalSupply = 0;
        this.codeScript = '';
        this.tapeScript = '';
        this.contractTxid = '';
        if (typeof txidOrParams === 'string') {
            // Initialize from an existing contract transaction ID
            this.contractTxid = txidOrParams;
        }
        else if (txidOrParams) {
            // Initialize with new token parameters
            const { name, symbol, amount, decimal } = txidOrParams;
            // Validate the decimal value
            if (decimal > 18) {
                throw new Error('The maximum value for decimal cannot exceed 18');
            }
            // Calculate the maximum allowable amount based on the decimal
            const maxAmount = Math.pow(10, 18 - decimal);
            if (amount > maxAmount) {
                throw new Error(`When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
            }
            this.name = name;
            this.symbol = symbol;
            this.decimal = decimal;
            this.totalSupply = amount * Math.pow(10, decimal);
        }
        else {
            throw new Error('Invalid constructor arguments');
        }
    }
    /**
     * Initializes the FT instance by fetching the transaction data.
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield this.fetchTXraw(this.contractTxid);
            const txData = new TransactionOutputsData(tx, 0);
            this.name = txData.name;
            this.symbol = txData.symbol;
            this.decimal = txData.decimal;
            this.totalSupply = txData.tapeAmount;
            this.codeScript = txData.codeScript;
            this.tapeScript = txData.tapeScript;
        });
    }
    /**
     * Mints a new FT and returns the raw transaction hex.
     * @param privateKey_from - The private key of the sender.
     * @param address_to - The recipient's address.
     * @returns The raw transaction hex string.
     */
    MintFT(privateKey_from, address_to) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = this.name;
            const symbol = this.symbol;
            const decimal = this.decimal;
            const totalSupply = this.totalSupply;
            const privateKey = privateKey_from;
            // Prepare the amount in BN format and write it into a buffer
            const amountbn = new tbc.crypto.BN(totalSupply.toString());
            const amountwriter = new tbc.encoding.BufferWriter();
            amountwriter.writeUInt64LEBN(amountbn);
            for (let i = 1; i < 6; i++) {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(0));
            }
            const tapeAmount = amountwriter.toBuffer().toString('hex');
            // Convert name, symbol, and decimal to hex
            const nameHex = Buffer.from(name, 'utf8').toString('hex');
            const symbolHex = Buffer.from(symbol, 'utf8').toString('hex');
            const decimalHex = decimal.toString(16).padStart(2, '0');
            // Build the tape script
            const tape = tbc.Script.fromASM(`OP_FALSE OP_RETURN ${tapeAmount} ${decimalHex} ${nameHex} ${symbolHex} 4654617065`);
            const tapeSize = tape.toBuffer().length;
            // Fetch UTXO for the private key's address
            const utxo = yield this.fetchUTXO(privateKey.toAddress().toString());
            // Build the code script for minting
            const codeScript = this.getFTmintCode(utxo.txId, utxo.outputIndex, address_to, tapeSize);
            this.codeScript = codeScript.toBuffer().toString('hex');
            this.tapeScript = tape.toBuffer().toString('hex');
            // Construct the transaction
            const tx = new tbc.Transaction()
                .from(utxo)
                .addOutput(new tbc.Transaction.Output({
                script: codeScript,
                satoshis: 2000
            }))
                .addOutput(new tbc.Transaction.Output({
                script: tape,
                satoshis: 0
            }))
                .feePerKb(100)
                .change(privateKey.toAddress())
                .sign(privateKey);
            tx.seal();
            const txraw = tx.serialize();
            this.contractTxid = tx.hash;
            return txraw;
        });
    }
    /**
     * Transfers FT tokens to another address and returns the raw transaction hex.
     * @param privateKey_from - The private key of the sender.
     * @param address_to - The recipient's address.
     * @param amount - The amount to transfer.
     * @returns The raw transaction hex string.
     */
    transfer(privateKey_from, address_to, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const code = this.codeScript;
            const tape = this.tapeScript;
            const decimal = this.decimal;
            const privateKey = privateKey_from;
            const tapeAmountSetIn = [];
            const amountbn = amount * Math.pow(10, decimal);
            // Fetch FT UTXO for the transfer
            const fttxo_1 = yield this.fetchFtTXO(this.contractTxid, privateKey.toAddress().toString(), amountbn);
            if (fttxo_1.ftBalance === undefined) {
                throw new Error('ftBalance is undefined');
            }
            tapeAmountSetIn.push(fttxo_1.ftBalance);
            // Calculate the total available balance
            let tapeAmountSum = 0;
            for (let i = 0; i < tapeAmountSetIn.length; i++) {
                tapeAmountSum += tapeAmountSetIn[i];
            }
            // Validate the decimal and amount
            if (decimal > 18) {
                throw new Error('The maximum value for decimal cannot exceed 18');
            }
            const maxAmount = Math.pow(10, 18 - decimal);
            if (amount > maxAmount) {
                throw new Error(`When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
            }
            // Check if the balance is sufficient
            if (amountbn > tapeAmountSum) {
                throw new Error('Insufficient balance, please add more FT UTXOs');
            }
            // Build the amount and change hex strings for the tape
            const { amountHex, changeHex } = this.buildTapeAmount(amountbn, tapeAmountSetIn);
            // Fetch UTXO for the sender's address
            const utxo = yield this.fetchUTXO(privateKey.toAddress().toString());
            // Construct the transaction
            const tx = new tbc.Transaction()
                .from(fttxo_1)
                .from(utxo);
            // Build the code script for the recipient
            const codeScript = this.buildFTtransferCode(code, address_to);
            tx.addOutput(new tbc.Transaction.Output({
                script: codeScript,
                satoshis: 2000
            }));
            // Build the tape script for the amount
            const tapeScript = this.buildFTtransferTape(tape, amountHex);
            tx.addOutput(new tbc.Transaction.Output({
                script: tapeScript,
                satoshis: 0
            }));
            // If there's change, add outputs for the change
            if (amountbn < tapeAmountSum) {
                const changeCodeScript = this.buildFTtransferCode(code, privateKey.toAddress().toString());
                tx.addOutput(new tbc.Transaction.Output({
                    script: changeCodeScript,
                    satoshis: 2000
                }));
                const changeTapeScript = this.buildFTtransferTape(tape, changeHex);
                tx.addOutput(new tbc.Transaction.Output({
                    script: changeTapeScript,
                    satoshis: 0
                }));
            }
            tx.feePerKb(100)
                .change(privateKey.toAddress());
            // Set the input script asynchronously for the FT UTXO
            yield tx.setInputScriptAsync({
                inputIndex: 0,
            }, (tx) => __awaiter(this, void 0, void 0, function* () {
                const unlockingScript = yield this.getFTunlock(privateKey, tx, 0, fttxo_1.txId, fttxo_1.outputIndex);
                return unlockingScript;
            }));
            tx.sign(privateKey);
            yield tx.sealAsync();
            const txraw = tx.uncheckedSerialize();
            return txraw;
        });
    }
    /**
     * Fetches the raw transaction data for a given transaction ID.
     * @param txid - The transaction ID to fetch.
     * @returns The transaction object.
     */
    fetchTXraw(txid) {
        return __awaiter(this, void 0, void 0, function* () {
            const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/tx/hex/${txid}`;
            try {
                const response = yield axios_1.default.get(url_mainnet);
                const rawtx = response.data;
                const tx = new tbc.Transaction();
                tx.fromString(rawtx);
                return tx;
            }
            catch (error) {
                throw new Error("Failed to fetch TXraw.");
            }
        });
    }
    /**
     * Broadcasts the raw transaction to the network.
     * @param txraw - The raw transaction hex.
     * @returns The response from the broadcast API.
     */
    broadcastTXraw(txraw) {
        return __awaiter(this, void 0, void 0, function* () {
            const url_mainnet = 'https://turingwallet.xyz/v1/tbc/main/broadcast/tx/raw';
            try {
                const response = yield axios_1.default.post(url_mainnet, {
                    txHex: txraw
                });
                console.log('txid:', response.data.result);
                if (response.data.error) {
                    console.log('error:', response.data.error);
                }
                return response.data;
            }
            catch (error) {
                throw new Error("Failed to broadcast TXraw.");
            }
        });
    }
    /**
     * Fetches an FT UTXO that satisfies the required amount.
     * @param contractTxid - The contract transaction ID.
     * @param addressOrHash - The recipient's address or hash.
     * @param amount - The required amount.
     * @returns The FT UTXO that meets the amount requirement.
     */
    fetchFtTXO(contractTxid, addressOrHash, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            let hash = '';
            if (tbc.Address.isValid(addressOrHash)) {
                // If the recipient is an address
                const publicKeyHash = tbc.Address.fromString(addressOrHash).hashBuffer.toString('hex');
                hash = publicKeyHash + '00';
            }
            else {
                // If the recipient is a hash
                if (addressOrHash.length !== 40) {
                    throw new Error('Invalid address or hash');
                }
                hash = addressOrHash + '01';
            }
            const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/unspent/script/${hash}/contract/${contractTxid}`;
            try {
                const response_unspent = yield axios_1.default.get(url_mainnet);
                let data = response_unspent.data[0];
                for (let i = 0; i < response_unspent.data.length; i++) {
                    if (response_unspent.data[i].ContractBalance > amount) {
                        data = response_unspent.data[i];
                        break;
                    }
                }
                const fttxo_codeScript = this.buildFTtransferCode(this.codeScript, addressOrHash).toBuffer().toString('hex');
                const fttxo = {
                    txId: data.tx_hash,
                    outputIndex: data.tx_pos,
                    script: fttxo_codeScript,
                    satoshis: data.value,
                    ftBalance: data.ContractBalance
                };
                if (fttxo.ftBalance === undefined) {
                    throw new Error('ftBalance is undefined');
                }
                return fttxo;
            }
            catch (error) {
                throw new Error("Failed to fetch FTTXO.");
            }
        });
    }
    /**
     * Get the FT balance for a specified contract transaction ID and address or hash.
     *
     * @param {string} contractTxid - The contract transaction ID.
     * @param {string} addressOrHash - The address or hash.
     * @returns {Promise<number>} Returns a Promise that resolves to the FT balance.
     * @throws {Error} Throws an error if the address or hash is invalid, or if the request fails.
     */
    static getFTbalance(contractTxid, addressOrHash) {
        return __awaiter(this, void 0, void 0, function* () {
            let hash = '';
            if (tbc.Address.isValid(addressOrHash)) {
                // If the recipient is an address
                const publicKeyHash = tbc.Address.fromString(addressOrHash).hashBuffer.toString('hex');
                hash = publicKeyHash + '00';
            }
            else {
                // If the recipient is a hash
                if (addressOrHash.length !== 40) {
                    throw new Error('Invalid address or hash');
                }
                hash = addressOrHash + '01';
            }
            const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/unspent/script/${hash}/contract/${contractTxid}`;
            try {
                const response_unspent = yield axios_1.default.get(url_mainnet);
                let ftBalance = 0;
                for (let i = 0; i < response_unspent.data.length; i++) {
                    ftBalance += response_unspent.data[i].ContractBalance;
                }
                return ftBalance;
            }
            catch (error) {
                throw new Error("Failed to get ftBalance.");
            }
        });
    }
    /**
     * Fetches a UTXO for the given address with sufficient balance.
     * @param address - The address to search for UTXOs.
     * @returns The UTXO with sufficient balance.
     */
    fetchUTXO(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/address/${address}/unspent/`;
            const scriptPubKey = tbc.Script.buildPublicKeyHashOut(address).toBuffer().toString('hex');
            try {
                const response = yield axios_1.default.get(url_mainnet);
                let data = response.data[0];
                // Select a UTXO with value greater than 5000
                for (let i = 0; i < response.data.length; i++) {
                    if (response.data[i].value > 5000) {
                        data = response.data[i];
                        break;
                    }
                }
                if (data.value < 5000) {
                    throw new Error('UTXO value is less than 5000');
                }
                const utxo = {
                    txId: data.tx_hash,
                    outputIndex: data.tx_pos,
                    script: scriptPubKey,
                    satoshis: data.value
                };
                return utxo;
            }
            catch (error) {
                throw new Error("Failed to fetch UTXO.");
            }
        });
    }
    /**
     * Builds the code script for transferring FT to a new address or hash.
     * @param code - The original code script in hex.
     * @param addressOrHash - The recipient's address or hash.
     * @returns The new code script as a tbc.Script object.
     */
    buildFTtransferCode(code, addressOrHash) {
        if (tbc.Address.isValid(addressOrHash)) {
            // If the recipient is an address
            const publicKeyHashBuffer = tbc.Address.fromString(addressOrHash).hashBuffer;
            const hashBuffer = Buffer.concat([publicKeyHashBuffer, Buffer.from([0x00])]);
            const codeBuffer = Buffer.from(code, 'hex');
            hashBuffer.copy(codeBuffer, 1537, 0, 21); // Replace the hash in the code script
            const codeScript = new tbc.Script(codeBuffer.toString('hex'));
            return codeScript;
        }
        else {
            // If the recipient is a hash
            if (addressOrHash.length !== 40) {
                throw new Error('Invalid address or hash');
            }
            const hash = addressOrHash + '01';
            const hashBuffer = Buffer.from(hash, 'hex');
            const codeBuffer = Buffer.from(code, 'hex');
            hashBuffer.copy(codeBuffer, 1537, 0, 21); // Replace the hash in the code script
            const codeScript = new tbc.Script(codeBuffer.toString('hex'));
            return codeScript;
        }
    }
    /**
     * Builds the tape script with the specified amount for transfer.
     * @param tape - The original tape script in hex.
     * @param amountHex - The amount in hex format.
     * @returns The new tape script as a tbc.Script object.
     */
    buildFTtransferTape(tape, amountHex) {
        const amountHexBuffer = Buffer.from(amountHex, 'hex');
        const tapeBuffer = Buffer.from(tape, 'hex');
        amountHexBuffer.copy(tapeBuffer, 3, 0, 48); // Replace the amount in the tape script
        const tapeScript = new tbc.Script(tapeBuffer.toString('hex'));
        return tapeScript;
    }
    /**
     * Builds the amount and change hex strings for the tape script.
     * @param amountBN - The amount to transfer in BN format.
     * @param tapeAmountSet - The set of amounts from the input tapes.
     * @param ftInputIndex - (Optional) The index of the FT input.
     * @returns An object containing amountHex and changeHex.
     */
    buildTapeAmount(amountBN, tapeAmountSet, ftInputIndex) {
        let i = 0;
        let j = 0;
        const amountwriter = new tbc.encoding.BufferWriter();
        const changewriter = new tbc.encoding.BufferWriter();
        // Initialize with zeros if ftInputIndex is provided
        if (ftInputIndex) {
            for (j = 0; j < ftInputIndex; j++) {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(0));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN(0));
            }
        }
        // Build the amount and change for each tape slot
        for (i = 0; i < 6; i++) {
            if (amountBN <= 0) {
                break;
            }
            if (tapeAmountSet[i] < amountBN) {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(tapeAmountSet[i].toString()));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN(0));
                amountBN -= tapeAmountSet[i];
            }
            else {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(amountBN.toString()));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN((tapeAmountSet[i] - amountBN).toString()));
                amountBN = 0;
            }
        }
        // Fill the remaining slots with zeros or remaining amounts
        for (; i < 6 && j < 6; i++, j++) {
            if (tapeAmountSet[i]) {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(0));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN(tapeAmountSet[i].toString()));
            }
            else {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(0));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN(0));
            }
        }
        const amountHex = amountwriter.toBuffer().toString('hex');
        const changeHex = changewriter.toBuffer().toString('hex');
        return { amountHex, changeHex };
    }
    /**
     * Generates the unlocking script for an FT transfer.
     * @param privateKey_from - The private key of the sender.
     * @param currentTX - The current transaction object.
     * @param currentUnlockIndex - The index of the input being unlocked.
     * @param preTxId - The transaction ID of the previous transaction.
     * @param preVout - The output index in the previous transaction.
     * @returns The unlocking script as a tbc.Script object.
     */
    getFTunlock(privateKey_from, currentTX, currentUnlockIndex, preTxId, preVout) {
        return __awaiter(this, void 0, void 0, function* () {
            const privateKey = privateKey_from;
            const preTX = yield this.fetchTXraw(preTxId);
            const pretxdata = getPreTxdata(preTX, preVout);
            // Retrieve and process the tape data from the previous transaction
            const preTXtape = preTX.outputs[preVout + 1].script.toBuffer().subarray(3, 51).toString('hex');
            let prepretxdata = '';
            for (let i = preTXtape.length - 16; i >= 0; i -= 16) {
                const chunk = preTXtape.substring(i, i + 16);
                if (chunk != '0000000000000000') {
                    const inputIndex = i / 16;
                    const prepreTX = yield this.fetchTXraw(preTX.inputs[inputIndex].prevTxId.toString('hex'));
                    prepretxdata = prepretxdata + getPrePreTxdata(prepreTX, preTX.inputs[inputIndex].outputIndex);
                }
            }
            prepretxdata = '57' + prepretxdata;
            const currenttxdata = getCurrentTxdata(currentTX, currentUnlockIndex);
            const sig = (currentTX.getSignature(currentUnlockIndex, privateKey).length / 2).toString(16).padStart(2, '0') + currentTX.getSignature(currentUnlockIndex, privateKey);
            const publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') + privateKey.toPublicKey().toString();
            const unlockingScript = new tbc.Script(`${currenttxdata}${prepretxdata}${sig}${publicKey}${pretxdata}`);
            return unlockingScript;
        });
    }
    /**
     * Generates the unlocking script for an FT swap.
     * @param privateKey_from - The private key of the sender.
     * @param currentTX - The current transaction object.
     * @param currentUnlockIndex - The index of the input being unlocked.
     * @param preTxId - The transaction ID of the previous transaction.
     * @param preVout - The output index in the previous transaction.
     * @returns The unlocking script as a tbc.Script object.
     */
    getFTunlockSwap(privateKey_from, currentTX, currentUnlockIndex, preTxId, preVout) {
        return __awaiter(this, void 0, void 0, function* () {
            const privateKey = privateKey_from;
            const nftTX = yield this.fetchTXraw(currentTX.inputs[0].prevTxId.toString('hex'));
            const nfttxdata = getNftTxdata(nftTX);
            const preTX = yield this.fetchTXraw(preTxId);
            const pretxdata = getPreTxdata(preTX, preVout);
            const preTXtape = preTX.outputs[preVout + 1].script.toBuffer().subarray(3, 51).toString('hex');
            var prepretxdata = '';
            for (let i = preTXtape.length - 16; i >= 0; i -= 16) {
                const chunk = preTXtape.substring(i, i + 16);
                if (chunk != '0000000000000000') {
                    const inputIndex = i / 16;
                    const prepreTX = yield this.fetchTXraw(preTX.inputs[inputIndex].prevTxId.toString('hex'));
                    prepretxdata = prepretxdata + getPrePreTxdata(prepreTX, preTX.inputs[inputIndex].outputIndex);
                }
            }
            prepretxdata = '57' + prepretxdata;
            const currentinputsdata = getCurrentInputsdata(currentTX);
            const currenttxdata = getCurrentTxdata(currentTX, currentUnlockIndex);
            const sig = (currentTX.getSignature(currentUnlockIndex, privateKey).length / 2).toString(16).padStart(2, '0') + currentTX.getSignature(currentUnlockIndex, privateKey);
            const publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') + privateKey.toPublicKey().toString();
            const unlockingScript = new tbc.Script(`${currenttxdata}${prepretxdata}${sig}${publicKey}${currentinputsdata}${nfttxdata}${pretxdata}`);
            return unlockingScript;
        });
    }
    /**
     * Builds the code script for minting FT tokens.
     * @param txid - The transaction ID of the UTXO used for minting.
     * @param vout - The output index of the UTXO.
     * @param address - The recipient's address.
     * @param tapeSize - The size of the tape script.
     * @returns The code script as a tbc.Script object.
     */
    getFTmintCode(txid, vout, address, tapeSize) {
        const writer = new tbc.encoding.BufferWriter();
        writer.writeReverse(Buffer.from(txid, 'hex'));
        writer.writeUInt32LE(vout);
        const utxoHex = writer.toBuffer().toString('hex');
        const publicKeyHash = tbc.Address.fromString(address).hashBuffer.toString('hex');
        const hash = publicKeyHash + '00';
        const tapeSizeHex = getSize(tapeSize).toString('hex');
        // The codeScript is constructed with specific opcodes and parameters for FT minting
        const codeScript = new tbc.Script(`OP_9 OP_PICK OP_TOALTSTACK OP_1 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_5 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_4 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_3 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_2 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_1 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_0 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_FROMALTSTACK OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_3 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_TOALTSTACK OP_SHA256 OP_FROMALTSTACK OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_6 OP_PUSH_META 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_FROMALTSTACK OP_1 OP_SPLIT OP_NIP 0x01 0x14 OP_SPLIT OP_1 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_IF OP_DROP OP_1 OP_PICK OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG OP_1 OP_EQUALVERIFY OP_ELSE OP_1 OP_EQUALVERIFY OP_1 OP_PICK OP_HASH160 OP_EQUALVERIFY OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_OVER 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_SHA256 OP_5 OP_PUSH_META OP_EQUALVERIFY OP_CHECKSIG OP_1 OP_EQUALVERIFY OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x24 OP_SPLIT OP_DROP OP_DUP OP_TOALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUAL OP_IF OP_FROMALTSTACK OP_DROP OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_FROMALTSTACK 0x24 0x${utxoHex} OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_0 OP_EQUALVERIFY OP_7 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_SWAP OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_0 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_0 OP_EQUALVERIFY OP_DROP OP_1 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_SHA256 OP_7 OP_PUSH_META OP_EQUAL OP_NIP 0x23 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff OP_DROP OP_RETURN 0x15 0x${hash} 0x05 0x02436f6465`);
        return codeScript;
    }
}
exports.FT = FT;
/**
 * Retrieves the transaction data needed for NFT operations.
 * @param tx - The transaction object.
 * @returns The transaction data as a hex string.
 */
function getNftTxdata(tx) {
    const writer = new tbc.encoding.BufferWriter();
    writer.write(Buffer.from(vliolength, 'hex'));
    writer.writeUInt32LE(version);
    writer.writeUInt32LE(tx.nLockTime);
    writer.writeInt32LE(tx.inputs.length);
    writer.writeInt32LE(tx.outputs.length);
    const inputWriter = new tbc.encoding.BufferWriter();
    const inputWriter2 = new tbc.encoding.BufferWriter();
    for (const input of tx.inputs) {
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
        inputWriter2.write(tbc.crypto.Hash.sha256(input.script.toBuffer()));
    }
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(inputWriter.toBuffer()));
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(inputWriter2.toBuffer()));
    const outputWriter = new tbc.encoding.BufferWriter();
    for (const output of tx.outputs) {
        outputWriter.writeUInt64LEBN(output.satoshisBN);
        outputWriter.write(tbc.crypto.Hash.sha256(output.script.toBuffer()));
    }
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(outputWriter.toBuffer()));
    const nfttxdata = writer.toBuffer().toString('hex');
    return `${nfttxdata}`;
}
/**
 * Retrieves the inputs data from the current transaction.
 * @param tx - The transaction object.
 * @returns The inputs data as a hex string.
 */
function getCurrentInputsdata(tx) {
    const writer = new tbc.encoding.BufferWriter();
    const inputWriter = new tbc.encoding.BufferWriter();
    for (const input of tx.inputs) {
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
    }
    writer.write(getLengthHex(inputWriter.toBuffer().length));
    writer.write(inputWriter.toBuffer());
    const currentinputsdata = writer.toBuffer().toString('hex');
    return `${currentinputsdata}`;
}
/**
 * Retrieves the current transaction data needed for unlocking scripts.
 * @param tx - The transaction object.
 * @param inputIndex - The index of the input being unlocked.
 * @returns The transaction data as a hex string.
 */
function getCurrentTxdata(tx, inputIndex) {
    const endTag = '51';
    const writer = new tbc.encoding.BufferWriter();
    for (let i = 0; i < tx.outputs.length; i++) {
        const lockingscript = tx.outputs[i].script.toBuffer();
        if (lockingscript.length > 1500) {
            // For scripts longer than 1500 bytes, calculate partial hash
            const size = getSize(lockingscript.length); // Size in little-endian
            const partialhash = partial_sha256.calculate_partial_hash(lockingscript.subarray(0, 1536));
            const suffixdata = lockingscript.subarray(1536);
            writer.write(Buffer.from(amountlength, 'hex'));
            writer.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            writer.write(getLengthHex(suffixdata.length)); // Suffix data
            writer.write(suffixdata);
            writer.write(Buffer.from(hashlength, 'hex')); // Partial hash
            writer.write(Buffer.from(partialhash, 'hex'));
            writer.write(getLengthHex(size.length));
            writer.write(size);
            writer.write(Buffer.from(amountlength, 'hex'));
            writer.writeUInt64LEBN(tx.outputs[i + 1].satoshisBN);
            writer.write(getLengthHex(tx.outputs[i + 1].script.toBuffer().length));
            writer.write(tx.outputs[i + 1].script.toBuffer());
            i++;
        }
        else {
            // For shorter scripts, include the entire locking script
            const size = getSize(lockingscript.length);
            const partialhash = '00';
            const suffixdata = lockingscript;
            writer.write(Buffer.from(amountlength, 'hex'));
            writer.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            writer.write(getLengthHex(suffixdata.length)); // Entire locking script
            writer.write(suffixdata);
            writer.write(Buffer.from(partialhash, 'hex')); // No partial hash
            writer.write(getLengthHex(size.length));
            writer.write(size);
        }
        writer.write(Buffer.from('52', 'hex'));
    }
    const currenttxdata = writer.toBuffer().toString('hex');
    const inputIndexMap = {
        0: '00',
        1: '51',
        2: '52',
        3: '53',
        4: '54',
        5: '55'
    };
    return `${endTag}${currenttxdata}${inputIndexMap[inputIndex]}`;
}
/**
 * Retrieves the previous transaction data needed for unlocking scripts.
 * @param tx - The previous transaction object.
 * @param vout - The output index in the previous transaction.
 * @returns The transaction data as a hex string.
 */
function getPreTxdata(tx, vout) {
    const writer = new tbc.encoding.BufferWriter();
    writer.write(Buffer.from(vliolength, 'hex'));
    writer.writeUInt32LE(version);
    writer.writeUInt32LE(tx.nLockTime);
    writer.writeInt32LE(tx.inputs.length);
    writer.writeInt32LE(tx.outputs.length);
    const inputWriter = new tbc.encoding.BufferWriter();
    const inputWriter2 = new tbc.encoding.BufferWriter();
    for (const input of tx.inputs) {
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
        inputWriter2.write(tbc.crypto.Hash.sha256(input.script.toBuffer()));
    }
    writer.write(getLengthHex(inputWriter.toBuffer().length));
    writer.write(inputWriter.toBuffer());
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(inputWriter2.toBuffer()));
    const { outputs1, outputs1length, outputs2, outputs2length } = getPreOutputsData(tx, vout);
    writer.write(Buffer.from(outputs1length, 'hex'));
    writer.write(Buffer.from(outputs1, 'hex'));
    const lockingscript = tx.outputs[vout].script.toBuffer();
    const size = getSize(lockingscript.length); // Size in little-endian
    const partialhash = partial_sha256.calculate_partial_hash(lockingscript.subarray(0, 1536));
    const suffixdata = lockingscript.subarray(1536);
    writer.write(Buffer.from(amountlength, 'hex'));
    writer.writeUInt64LEBN(tx.outputs[vout].satoshisBN);
    writer.write(getLengthHex(suffixdata.length)); // Suffix data
    writer.write(suffixdata);
    writer.write(Buffer.from(hashlength, 'hex')); // Partial hash
    writer.write(Buffer.from(partialhash, 'hex'));
    writer.write(getLengthHex(size.length));
    writer.write(size);
    writer.write(Buffer.from(amountlength, 'hex'));
    writer.writeUInt64LEBN(tx.outputs[vout + 1].satoshisBN);
    writer.write(getLengthHex(tx.outputs[vout + 1].script.toBuffer().length));
    writer.write(tx.outputs[vout + 1].script.toBuffer());
    writer.write(Buffer.from(outputs2length, 'hex'));
    writer.write(Buffer.from(outputs2, 'hex'));
    const pretxdata = writer.toBuffer().toString('hex');
    return `${pretxdata}`;
}
/**
 * Retrieves the previous transaction data from the grandparent transaction.
 * @param tx - The grandparent transaction object.
 * @param vout - The output index in the grandparent transaction.
 * @returns The transaction data as a hex string with a suffix '52'.
 */
function getPrePreTxdata(tx, vout) {
    const writer = new tbc.encoding.BufferWriter();
    writer.write(Buffer.from(vliolength, 'hex'));
    writer.writeUInt32LE(version);
    writer.writeUInt32LE(tx.nLockTime);
    writer.writeInt32LE(tx.inputs.length);
    writer.writeInt32LE(tx.outputs.length);
    const inputWriter = new tbc.encoding.BufferWriter();
    const inputWriter2 = new tbc.encoding.BufferWriter();
    for (const input of tx.inputs) {
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
        inputWriter2.write(tbc.crypto.Hash.sha256(input.script.toBuffer()));
    }
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(inputWriter.toBuffer()));
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(inputWriter2.toBuffer()));
    const { outputs1, outputs1length, outputs2, outputs2length } = getPrePreOutputsData(tx, vout);
    writer.write(Buffer.from(outputs1length, 'hex'));
    writer.write(Buffer.from(outputs1, 'hex'));
    const lockingscript = tx.outputs[vout].script.toBuffer();
    if (lockingscript.length > 1500) {
        const size = getSize(lockingscript.length); // Size in little-endian
        const partialhash = partial_sha256.calculate_partial_hash(lockingscript.subarray(0, 1536));
        const suffixdata = lockingscript.subarray(1536);
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[vout].satoshisBN);
        writer.write(getLengthHex(suffixdata.length)); // Suffix data
        writer.write(suffixdata);
        writer.write(Buffer.from(hashlength, 'hex')); // Partial hash
        writer.write(Buffer.from(partialhash, 'hex'));
        writer.write(getLengthHex(size.length));
        writer.write(size);
    }
    else {
        const size = getSize(lockingscript.length); // Size in little-endian
        const partialhash = '00';
        const suffixdata = lockingscript;
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[vout].satoshisBN);
        writer.write(getLengthHex(suffixdata.length)); // Entire locking script
        writer.write(suffixdata);
        writer.write(Buffer.from(partialhash, 'hex')); // No partial hash
        writer.write(getLengthHex(size.length));
        writer.write(size);
    }
    writer.write(Buffer.from(outputs2length, 'hex'));
    writer.write(Buffer.from(outputs2, 'hex'));
    const prepretxdata = writer.toBuffer().toString('hex');
    return `${prepretxdata}52`;
}
/**
 * Helper function to get outputs data before the specified output index for the grandparent transaction.
 * @param tx - The transaction object.
 * @param vout - The output index.
 * @returns An object containing outputs1, outputs1length, outputs2, and outputs2length.
 */
function getPrePreOutputsData(tx, vout) {
    let outputs1 = ''; // Outputs before the specified index
    let outputs1length = '';
    let outputs2 = ''; // Outputs after the specified index
    let outputs2length = '';
    if (vout === 0) {
        outputs1 = '00';
        outputs1length = '';
    }
    else {
        const outputWriter1 = new tbc.encoding.BufferWriter();
        for (let i = 0; i < vout; i++) {
            outputWriter1.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter1.write(tbc.crypto.Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs1 = outputWriter1.toBuffer().toString('hex');
        outputs1length = getLengthHex(outputs1.length / 2).toString('hex');
    }
    const outputWriter2 = new tbc.encoding.BufferWriter();
    for (let i = vout + 1; i < tx.outputs.length; i++) {
        outputWriter2.writeUInt64LEBN(tx.outputs[i].satoshisBN);
        outputWriter2.write(tbc.crypto.Hash.sha256(tx.outputs[i].script.toBuffer()));
    }
    outputs2 = outputWriter2.toBuffer().toString('hex');
    if (outputs2 === '') {
        outputs2 = '00';
        outputs2length = '';
    }
    else {
        outputs2length = getLengthHex(outputs2.length / 2).toString('hex');
    }
    return { outputs1, outputs1length, outputs2, outputs2length };
}
/**
 * Helper function to get outputs data before the specified output index for the parent transaction.
 * @param tx - The transaction object.
 * @param vout - The output index.
 * @returns An object containing outputs1, outputs1length, outputs2, and outputs2length.
 */
function getPreOutputsData(tx, vout) {
    let outputs1 = ''; // Outputs before the specified index
    let outputs1length = '';
    let outputs2 = ''; // Outputs after the specified index
    let outputs2length = '';
    if (vout === 0) {
        outputs1 = '00';
        outputs1length = '';
    }
    else {
        const outputWriter1 = new tbc.encoding.BufferWriter();
        for (let i = 0; i < vout; i++) {
            outputWriter1.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter1.write(tbc.crypto.Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs1 = outputWriter1.toBuffer().toString('hex');
        outputs1length = getLengthHex(outputs1.length / 2).toString('hex');
    }
    const outputWriter2 = new tbc.encoding.BufferWriter();
    for (let i = vout + 2; i < tx.outputs.length; i++) { // For parent transaction, outputs2 starts from vout + 2
        outputWriter2.writeUInt64LEBN(tx.outputs[i].satoshisBN);
        outputWriter2.write(tbc.crypto.Hash.sha256(tx.outputs[i].script.toBuffer()));
    }
    outputs2 = outputWriter2.toBuffer().toString('hex');
    if (outputs2 === '') {
        outputs2 = '00';
        outputs2length = '';
    }
    else {
        outputs2length = getLengthHex(outputs2.length / 2).toString('hex');
    }
    return { outputs1, outputs1length, outputs2, outputs2length };
}
/**
 * Calculates the length of data and adds OP_PUSHDATA1 or OP_PUSHDATA2 if necessary.
 * @param length - The length of the data.
 * @returns A buffer representing the length with appropriate push opcode.
 */
function getLengthHex(length) {
    if (length < 76) {
        return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
    }
    else if (length > 75 && length < 256) {
        return Buffer.concat([Buffer.from('4c', 'hex'), Buffer.from(length.toString(16), 'hex')]);
    }
    else {
        return Buffer.concat([Buffer.from('4d', 'hex'), Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse()]);
    }
}
/**
 * Converts the size of data to a little-endian buffer.
 * @param length - The length of the data.
 * @returns A buffer representing the size in little-endian format.
 */
function getSize(length) {
    if (length < 256) {
        return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
    }
    else {
        return Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse();
    }
}
