"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FT = void 0;
exports.getContractTxdata = getContractTxdata;
exports.getCurrentInputsdata = getCurrentInputsdata;
exports.getCurrentTxdata = getCurrentTxdata;
exports.getPreTxdata = getPreTxdata;
exports.getPrePreTxdata = getPrePreTxdata;
exports.getSize = getSize;

var Script = require("../script")
var Address = require("../address")
var Hash = require('../crypto/hash')
var BN = require("../crypto/bn")
var BufferWriter = require("../encoding/bufferwriter")
var Output = require("../transaction/output")
var Transaction = require("../transaction/transaction")
var partial_sha256 = require("../util/partial-sha256");
var bignumber_js_1 = require("bignumber.js");
var Networks = require("../networks");

var network = Networks.mainnet;
var version = 10;
var vliolength = '10'; // Version + nLockTime + inputCount + outputCount (16 bytes)
var amountlength = '08'; // Length of the amount field (8 bytes)
var hashlength = '20'; // Length of the hash field (32 bytes)
/**
 * Class representing a Fungible Token (FT) with methods for minting and transferring.
 */
var FT = /** @class */ (function () {
    /**
     * Constructs the FT instance either from a transaction ID or parameters.
     * @param txidOrParams - Either a contract transaction ID or token parameters.
     */
    function FT(txidOrParams) {
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
            var name_1 = txidOrParams.name, symbol = txidOrParams.symbol, amount = txidOrParams.amount, decimal = txidOrParams.decimal;
            // Validate the decimal value
            if (decimal > 18) {
                console.error('Error: The maximum value for decimal cannot exceed 18');
                throw new Error('The maximum value for decimal cannot exceed 18');
            }
            // Calculate the maximum allowable amount based on the decimal
            var maxAmount = Math.pow(10, 18 - decimal);
            if (amount > maxAmount) {
                console.error("Error: When decimal is ".concat(decimal, ", the maximum amount cannot exceed ").concat(maxAmount));
                throw new Error("When decimal is ".concat(decimal, ", the maximum amount cannot exceed ").concat(maxAmount));
            }
            this.name = name_1;
            this.symbol = symbol;
            this.decimal = decimal;
            this.totalSupply = amount;
        }
        else {
            throw new Error('Invalid constructor arguments');
        }
    }
    /**
     * Initializes the FT instance by fetching the FTINFO.
     */
    FT.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ftInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchFtInfo(this.contractTxid)];
                    case 1:
                        ftInfo = _a.sent();

                        this.name = ftInfo.name;
                        this.symbol = ftInfo.symbol;
                        this.decimal = ftInfo.decimal;
                        this.totalSupply = ftInfo.totalSupply;
                        this.codeScript = ftInfo.codeScript;
                        this.tapeScript = ftInfo.tapeScript;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Mints a new FT and returns the raw transaction hex.
     * @param privateKey_from - The private key of the sender.
     * @param address_to - The recipient's address.
     * @returns The raw transaction hex string.
     */
    FT.prototype.MintFT = function (privateKey_from, address_to) {
        return __awaiter(this, void 0, void 0, function () {
            var name, symbol, decimal, factor, totalSupply, privateKey, amountbn, amountwriter, i, tapeAmount, nameHex, symbolHex, decimalHex, tape, tapeSize, utxo, codeScript, tx, txraw;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = this.name;
                        symbol = this.symbol;
                        decimal = this.decimal;
                        factor = new bignumber_js_1.default(Math.pow(10, decimal));
                        totalSupply = BigInt(new bignumber_js_1.default(this.totalSupply).multipliedBy(new bignumber_js_1.default(factor)).decimalPlaces(0).toString());
                        privateKey = privateKey_from;
                        amountbn = new BN(totalSupply.toString());
                        amountwriter = new BufferWriter();
                        amountwriter.writeUInt64LEBN(amountbn);
                        for (i = 1; i < 6; i++) {
                            amountwriter.writeUInt64LEBN(new BN(0));
                        }
                        tapeAmount = amountwriter.toBuffer().toString('hex');
                        nameHex = Buffer.from(name, 'utf8').toString('hex');
                        symbolHex = Buffer.from(symbol, 'utf8').toString('hex');
                        decimalHex = decimal.toString(16).padStart(2, '0');
                        tape = Script.fromASM("OP_FALSE OP_RETURN ".concat(tapeAmount, " ").concat(decimalHex, " ").concat(nameHex, " ").concat(symbolHex, " 4654617065"));
                        tapeSize = tape.toBuffer().length;
                        return [4 /*yield*/, this.fetchUTXO(privateKey.toAddress().toString())];
                    case 1:
                        utxo = _a.sent();
                        codeScript = this.getFTmintCode(utxo.txId, utxo.outputIndex, address_to, tapeSize);
                        this.codeScript = codeScript.toBuffer().toString('hex');
                        this.tapeScript = tape.toBuffer().toString('hex');
                        tx = new Transaction()
                            .from(utxo)
                            .addOutput(new Output({
                                script: codeScript,
                                satoshis: 2000
                            }))
                            .addOutput(new Output({
                                script: tape,
                                satoshis: 0
                            }))
                            .feePerKb(100)
                            .change(privateKey.toAddress())
                            .sign(privateKey);
                        tx.seal();
                        txraw = tx.uncheckedSerialize();
                        this.contractTxid = tx.hash;
                        return [2 /*return*/, txraw];
                }
            });
        });
    };
    /**
     * Transfers FT tokens to another address and returns the raw transaction hex.
     * @param privateKey_from - The private key of the sender.
     * @param address_to - The recipient's address.
     * @param amount - The amount to transfer.
     * @returns The raw transaction hex string.
     */
    FT.prototype.transfer = function (privateKey_from, address_to, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var code, tape, decimal, privateKey, tapeAmountSetIn, factor, amountbn, ftutxos, tapeAmountSum, i, maxAmount, _a, amountHex, changeHex, utxo, tx, codeScript, tapeScript, changeCodeScript, changeTapeScript, _loop_1, i, txraw;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        code = this.codeScript;
                        tape = this.tapeScript;
                        decimal = this.decimal;
                        privateKey = privateKey_from;
                        tapeAmountSetIn = [];
                        if (amount < 0) {
                            throw new Error('Invalid amount');
                        }
                        factor = new bignumber_js_1.default(Math.pow(10, decimal));
                        amountbn = BigInt(new bignumber_js_1.default(amount).multipliedBy(new bignumber_js_1.default(factor)).decimalPlaces(0).toString());
                        return [4 /*yield*/, this.fetchFtUTXOs(this.contractTxid, privateKey.toAddress().toString(), amountbn)];
                    case 1:
                        ftutxos = _b.sent();
                        tapeAmountSum = BigInt(0);
                        for (i = 0; i < ftutxos.length; i++) {
                            tapeAmountSetIn.push(ftutxos[i].ftBalance);
                            tapeAmountSum += BigInt(tapeAmountSetIn[i]);
                        }
                        // Validate the decimal and amount
                        if (decimal > 18) {
                            console.error('Error: The maximum value for decimal cannot exceed 18');
                            throw new Error('The maximum value for decimal cannot exceed 18');
                        }
                        maxAmount = Math.pow(10, 18 - decimal);
                        if (amount > maxAmount) {
                            console.error("Error: When decimal is ".concat(decimal, ", the maximum amount cannot exceed ").concat(maxAmount));
                            throw new Error("When decimal is ".concat(decimal, ", the maximum amount cannot exceed ").concat(maxAmount));
                        }
                        // Check if the balance is sufficient
                        if (amountbn > tapeAmountSum) {
                            console.error('Error: Insufficient balance, please add more FT UTXOs');
                            throw new Error('Insufficient balance, please add more FT UTXOs');
                        }
                        _a = this.buildTapeAmount(amountbn, tapeAmountSetIn), amountHex = _a.amountHex, changeHex = _a.changeHex;
                        return [4 /*yield*/, this.fetchUTXO(privateKey.toAddress().toString())];
                    case 2:
                        utxo = _b.sent();
                        tx = new Transaction()
                            .from(ftutxos)
                            .from(utxo);
                        codeScript = this.buildFTtransferCode(code, address_to);
                        tx.addOutput(new Output({
                            script: codeScript,
                            satoshis: 2000
                        }));
                        tapeScript = this.buildFTtransferTape(tape, amountHex);
                        tx.addOutput(new Output({
                            script: tapeScript,
                            satoshis: 0
                        }));
                        // If there's change, add outputs for the change
                        if (amountbn < tapeAmountSum) {
                            changeCodeScript = this.buildFTtransferCode(code, privateKey.toAddress().toString());
                            tx.addOutput(new Output({
                                script: changeCodeScript,
                                satoshis: 2000
                            }));
                            changeTapeScript = this.buildFTtransferTape(tape, changeHex);
                            tx.addOutput(new Output({
                                script: changeTapeScript,
                                satoshis: 0
                            }));
                        }
                        tx.feePerKb(100);
                        tx.change(privateKey.toAddress());
                        _loop_1 = function (i) {
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, tx.setInputScriptAsync({
                                        inputIndex: i,
                                    }, function (tx) {
                                        return __awaiter(_this, void 0, void 0, function () {
                                            var unlockingScript;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, this.getFTunlock(privateKey, tx, i, ftutxos[i].txId, ftutxos[i].outputIndex)];
                                                    case 1:
                                                        unlockingScript = _a.sent();
                                                        return [2 /*return*/, unlockingScript];
                                                }
                                            });
                                        });
                                    })];
                                    case 1:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        i = 0;
                        _b.label = 3;
                    case 3:
                        if (!(i < ftutxos.length)) return [3 /*break*/, 6];
                        return [5 /*yield**/, _loop_1(i)];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        i++;
                        return [3 /*break*/, 3];
                    case 6:
                        tx.sign(privateKey);
                        return [4 /*yield*/, tx.sealAsync()];
                    case 7:
                        _b.sent();
                        txraw = tx.uncheckedSerialize();
                        return [2 /*return*/, txraw];
                }
            });
        });
    };
    /**
     * Fetches the raw transaction data for a given transaction ID.
     * @param txid - The transaction ID to fetch.
     * @returns The transaction object.
     */
    FT.prototype.fetchTXraw = function (txid) {
        return __awaiter(this, void 0, void 0, function () {
            var url_testnet, url_mainnet, url, response, rawtx, tx, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url_testnet = "https://tbcdev.org/v1/tbc/main/tx/hex/".concat(txid);
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/tx/hex/".concat(txid);
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url)];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch TXraw: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        rawtx = _a.sent();
                        tx = new Transaction();
                        tx.fromString(rawtx);
                        return [2 /*return*/, tx];
                    case 4:
                        error_1 = _a.sent();
                        console.error("Error fetching TXraw:", error_1);
                        throw new Error("Failed to fetch TXraw.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Broadcasts the raw transaction to the network.
     * @param txraw - The raw transaction hex.
     * @returns The response from the broadcast API.
     */
    FT.prototype.broadcastTXraw = function (txraw) {
        return __awaiter(this, void 0, void 0, function () {
            var url_testnet, url_mainnet, url, response, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url_testnet = 'https://tbcdev.org/v1/tbc/main/broadcast/tx/raw';
                        url_mainnet = 'https://turingwallet.xyz/v1/tbc/main/broadcast/tx/raw';
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                txHex: txraw
                            })
                        })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to broadcast TXraw: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        console.log('txid:', data.result);
                        if (data.error) {
                            console.log('error:', data.error);
                        }
                        return [2 /*return*/, data.result];
                    case 4:
                        error_2 = _a.sent();
                        console.error("Error broadcasting TXraw:", error_2);
                        throw new Error("Failed to broadcast TXraw.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetches an FT UTXO that satisfies the required amount.
     * @param contractTxid - The contract transaction ID.
     * @param addressOrHash - The recipient's address or hash.
     * @param amount - The required amount.
     * @returns The FT UTXO that meets the amount requirement.
     */
    FT.prototype.fetchFtTXO = function (contractTxid, addressOrHash, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var hash, publicKeyHash, url_testnet, url_mainnet, url, response, responseData, data, i, fttxo_codeScript, fttxo, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hash = '';
                        if (Address.isValid(addressOrHash)) {
                            publicKeyHash = Address.fromString(addressOrHash).hashBuffer.toString('hex');
                            hash = publicKeyHash + '00';
                        }
                        else {
                            // If the recipient is a hash
                            if (addressOrHash.length !== 40) {
                                throw new Error('Invalid address or hash');
                            }
                            hash = addressOrHash + '01';
                        }
                        url_testnet = "https://tbcdev.org/v1/tbc/main/ft/utxo/combine/script/".concat(hash, "/contract/").concat(contractTxid);
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/ft/utxo/combine/script/".concat(hash, "/contract/").concat(contractTxid);
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch from URL: ".concat(url, ", status: ").concat(response.status));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        responseData = _a.sent();
                        data = responseData.ftUtxoList[0];
                        for (i = 0; i < responseData.ftUtxoList.length; i++) {
                            if (responseData.ftUtxoList[i].ftBalance >= amount) {
                                data = responseData.ftUtxoList[i];
                                break;
                            }
                        }
                        fttxo_codeScript = this.buildFTtransferCode(this.codeScript, addressOrHash).toBuffer().toString('hex');
                        fttxo = {
                            txId: data.utxoId,
                            outputIndex: data.utxoVout,
                            script: fttxo_codeScript,
                            satoshis: data.utxoBalance,
                            ftBalance: data.ftBalance
                        };
                        return [2 /*return*/, fttxo];
                    case 4:
                        error_3 = _a.sent();
                        throw new Error("Failed to fetch FTTXO.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    FT.prototype.fetchFtUTXOs = function (contractTxid, addressOrHash, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var hash, publicKeyHash, url_testnet, url_mainnet, url, response, codeScript, responseData, sortedData, sumBalance, ftutxos, i, totalBalance, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hash = '';
                        if (Address.isValid(addressOrHash)) {
                            publicKeyHash = Address.fromString(addressOrHash).hashBuffer.toString('hex');
                            hash = publicKeyHash + '00';
                        }
                        else {
                            // If the recipient is a hash
                            if (addressOrHash.length !== 40) {
                                throw new Error('Invalid address or hash');
                            }
                            hash = addressOrHash + '01';
                        }
                        url_testnet = "https://tbcdev.org/v1/tbc/main/ft/utxo/combine/script/".concat(hash, "/contract/").concat(contractTxid);
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/ft/utxo/combine/script/".concat(hash, "/contract/").concat(contractTxid);
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch(url, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch from URL: ".concat(url, ", status: ").concat(response.status));
                        }
                        codeScript = this.buildFTtransferCode(this.codeScript, addressOrHash).toBuffer().toString('hex');
                        return [4 /*yield*/, response.json()];
                    case 3:
                        responseData = _a.sent();
                        sortedData = responseData.ftUtxoList.sort(function (a, b) { return b.ftBalance - a.ftBalance; });
                        sumBalance = BigInt(0);
                        ftutxos = [];
                        for (i = 0; i < sortedData.length && i < 5; i++) {
                            sumBalance += BigInt(sortedData[i].ftBalance);
                            ftutxos.push({
                                txId: sortedData[i].utxoId,
                                outputIndex: sortedData[i].utxoVout,
                                script: codeScript,
                                satoshis: sortedData[i].utxoBalance,
                                ftBalance: sortedData[i].ftBalance
                            });
                            if (sumBalance >= amount) {
                                break;
                            }
                        }
                        if (!(sumBalance < amount)) return [3 /*break*/, 5];
                        return [4 /*yield*/, FT.getFTbalance(contractTxid, addressOrHash)];
                    case 4:
                        totalBalance = _a.sent();
                        if (totalBalance >= amount) {
                            throw new Error('Insufficient FTbalance, please merge FT UTXOs');
                        }
                        _a.label = 5;
                    case 5: return [2 /*return*/, ftutxos];
                    case 6:
                        error_4 = _a.sent();
                        console.log(error_4);
                        throw new Error("Failed to fetch FTUTXO.");
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetches the FT information for a given contract transaction ID.
     *
     * @param {string} contractTxid - The contract transaction ID.
     * @returns {Promise<FtInfo>} Returns a Promise that resolves to an FtInfo object containing the FT information.
     * @throws {Error} Throws an error if the request to fetch FT information fails.
     */
    FT.prototype.fetchFtInfo = function (contractTxid) {
        return __awaiter(this, void 0, void 0, function () {
            var url_testnet, url_mainnet, url, response, data, ftInfo, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url_testnet = "https://tbcdev.org/v1/tbc/main/ft/info/contract/id/".concat(contractTxid);
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/ft/info/contract/id/".concat(contractTxid);

                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch from URL: ".concat(url, ", status: ").concat(response.status));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        ftInfo = {
                            codeScript: data.ftCodeScript,
                            tapeScript: data.ftTapeScript,
                            totalSupply: data.ftSupply,
                            decimal: data.ftDecimal,
                            name: data.ftName,
                            symbol: data.ftSymbol
                        };
                        return [2 /*return*/, ftInfo];
                    case 4:
                        error_4 = _a.sent();
                        throw new Error("Failed to fetch FtInfo.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Merges FT UTXOs.
     *
     * @param {PrivateKey} privateKey_from - The private key object.
     * @returns {Promise<boolean>} Returns a Promise that resolves to a boolean indicating whether the merge was successful.
     * @throws {Error} Throws an error if the merge fails.
     */
    FT.prototype.mergeFT = function (privateKey_from) {
        return __awaiter(this, void 0, void 0, function () {
            var privateKey, address, contractTxid, url_testnet, url_mainnet, url, fttxo_codeScript, utxo, response, fttxo_1, i, tapeAmountSetIn, tapeAmountSum, i, _a, amountHex, changeHex, tx, codeScript, tapeScript, _loop_2, i, txraw, error_6;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        privateKey = privateKey_from;
                        address = privateKey.toAddress().toString();
                        contractTxid = this.contractTxid;
                        url_testnet = "https://tbcdev.org/v1/tbc/main/ft/utxo/address/".concat(address, "/contract/").concat(contractTxid);
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/ft/utxo/address/".concat(address, "/contract/").concat(contractTxid);
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }


                        fttxo_codeScript = this.buildFTtransferCode(this.codeScript, address).toBuffer().toString('hex');
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 13, , 14]);
                        return [4 /*yield*/, this.fetchUTXO(address)];
                    case 2:
                        utxo = _b.sent();
                        return [4 /*yield*/, fetch(url)];
                    case 3: return [4 /*yield*/, (_b.sent()).json()];
                    case 4:
                        response = _b.sent();
                        fttxo_1 = [];
                        if (response.ftUtxoList.length === 0) {
                            throw new Error('No FT UTXO available');
                        }
                        if (response.ftUtxoList.length === 1) {
                            console.log('Merge Success!');
                            return [2 /*return*/, true];
                        }
                        else {
                            for (i = 0; i < response.ftUtxoList.length && i < 5; i++) {
                                fttxo_1.push({
                                    txId: response.ftUtxoList[i].utxoId,
                                    outputIndex: response.ftUtxoList[i].utxoVout,
                                    script: fttxo_codeScript,
                                    satoshis: response.ftUtxoList[i].utxoBalance,
                                    ftBalance: response.ftUtxoList[i].ftBalance
                                });
                            }
                        }
                        tapeAmountSetIn = [];
                        tapeAmountSum = BigInt(0);
                        for (i = 0; i < fttxo_1.length; i++) {
                            tapeAmountSetIn.push(fttxo_1[i].ftBalance);
                            tapeAmountSum += BigInt(fttxo_1[i].ftBalance);
                        }
                        _a = this.buildTapeAmount(tapeAmountSum, tapeAmountSetIn), amountHex = _a.amountHex, changeHex = _a.changeHex;
                        if (changeHex != '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000') {
                            throw new Error('Change amount is not zero');
                        }
                        tx = new Transaction()
                            .from(fttxo_1)
                            .from(utxo);
                        codeScript = this.buildFTtransferCode(this.codeScript, address);
                        tx.addOutput(new Output({
                            script: codeScript,
                            satoshis: 2000
                        }));
                        tapeScript = this.buildFTtransferTape(this.tapeScript, amountHex);
                        tx.addOutput(new Output({
                            script: tapeScript,
                            satoshis: 0
                        }));
                        tx.feePerKb(100)
                            .change(privateKey.toAddress());
                        _loop_2 = function (i) {
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, tx.setInputScriptAsync({
                                        inputIndex: i,
                                    }, function (tx) {
                                        return __awaiter(_this, void 0, void 0, function () {
                                            var unlockingScript;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, this.getFTunlock(privateKey, tx, i, fttxo_1[i].txId, fttxo_1[i].outputIndex)];
                                                    case 1:
                                                        unlockingScript = _a.sent();
                                                        return [2 /*return*/, unlockingScript];
                                                }
                                            });
                                        });
                                    })];
                                    case 1:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        i = 0;
                        _b.label = 5;
                    case 5:
                        if (!(i < fttxo_1.length)) return [3 /*break*/, 8];
                        return [5 /*yield**/, _loop_2(i)];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        i++;
                        return [3 /*break*/, 5];
                    case 8:
                        tx.sign(privateKey);
                        return [4 /*yield*/, tx.sealAsync()];
                    case 9:
                        _b.sent();
                        txraw = tx.uncheckedSerialize();
                        console.log('Merge FTUTXO:');
                        return [4 /*yield*/, this.broadcastTXraw(txraw)];
                    case 10:
                        _b.sent();
                        // wait 5 seconds
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
                    case 11:
                        // wait 5 seconds
                        _b.sent();
                        return [4 /*yield*/, this.mergeFT(privateKey)];
                    case 12:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 13:
                        error_6 = _b.sent();
                        throw new Error("Merge Faild!.");
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get the FT balance for a specified contract transaction ID and address or hash.
     *
     * @param {string} contractTxid - The contract transaction ID.
     * @param {string} addressOrHash - The address or hash.
     * @returns {Promise<number>} Returns a Promise that resolves to the FT balance.
     * @throws {Error} Throws an error if the address or hash is invalid, or if the request fails.
     */
    FT.getFTbalance = function (contractTxid, addressOrHash) {
        return __awaiter(this, void 0, void 0, function () {
            var hash, publicKeyHash, url_testnet, url_mainnet, url, response, ftBalance, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hash = '';
                        if (Address.isValid(addressOrHash)) {
                            publicKeyHash = Address.fromString(addressOrHash).hashBuffer.toString('hex');
                            hash = publicKeyHash + '00';
                        }
                        else {
                            // If the recipient is a hash
                            if (addressOrHash.length !== 40) {
                                throw new Error('Invalid address or hash');
                            }
                            hash = addressOrHash + '01';
                        }
                        url_testnet = "https://tbcdev.org/v1/tbc/main/ft/balance/combine/script/".concat(hash, "/contract/").concat(contractTxid);
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/ft/balance/combine/script/".concat(hash, "/contract/").concat(contractTxid);
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url)];
                    case 2: return [4 /*yield*/, (_a.sent()).json()];
                    case 3:
                        response = _a.sent();
                        ftBalance = response.ftBalance;
                        return [2 /*return*/, ftBalance];
                    case 4:
                        error_6 = _a.sent();
                        throw new Error("Failed to get ftBalance.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetches a UTXO for the given address with sufficient balance.
     * @param address - The address to search for UTXOs.
     * @returns The UTXO with sufficient balance.
     */
    FT.prototype.fetchUTXO = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var url_testnet, url_mainnet, url, scriptPubKey, response, data, i, utxo, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url_testnet = "https://tbcdev.org/v1/tbc/main/address/".concat(address, "/unspent/");
                        url_mainnet = "https://turingwallet.xyz/v1/tbc/main/address/".concat(address, "/unspent/");
                        url = url_testnet;
                        if (network === Networks.testnet) {
                            url = url_testnet;
                        }
                        else if (network === Networks.mainnet) {
                            url = url_mainnet;
                        }
                        scriptPubKey = Script.buildPublicKeyHashOut(address).toBuffer().toString('hex');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url)];
                    case 2: return [4 /*yield*/, (_a.sent()).json()];
                    case 3:
                        response = _a.sent();
                        data = response[0];
                        // Select a UTXO with value greater than 5000
                        for (i = 0; i < response.length; i++) {
                            if (response[i].value > 5000) {
                                data = response[i];
                                break;
                            }
                        }
                        if (data.value < 5000) {
                            console.error('Error: UTXO value is less than 5000');
                            throw new Error('UTXO value is less than 5000');
                        }
                        utxo = {
                            txId: data.tx_hash,
                            outputIndex: data.tx_pos,
                            script: scriptPubKey,
                            satoshis: data.value
                        };
                        return [2 /*return*/, utxo];
                    case 4:
                        error_7 = _a.sent();
                        throw new Error("Failed to fetch UTXO.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Builds the code script for transferring FT to a new address or hash.
     * @param code - The original code script in hex.
     * @param addressOrHash - The recipient's address or hash.
     * @returns The new code script as a Script object.
     */
    FT.prototype.buildFTtransferCode = function (code, addressOrHash) {
        if (Address.isValid(addressOrHash)) {
            // If the recipient is an address
            var publicKeyHashBuffer = Address.fromString(addressOrHash).hashBuffer;
            var hashBuffer = Buffer.concat([publicKeyHashBuffer, Buffer.from([0x00])]);
            var codeBuffer = Buffer.from(code, 'hex');
            hashBuffer.copy(codeBuffer, 1537, 0, 21); // Replace the hash in the code script
            var codeScript = new Script(codeBuffer.toString('hex'));
            return codeScript;
        }
        else {
            // If the recipient is a hash
            if (addressOrHash.length !== 40) {
                throw new Error('Invalid address or hash');
            }
            var hash = addressOrHash + '01';
            var hashBuffer = Buffer.from(hash, 'hex');
            var codeBuffer = Buffer.from(code, 'hex');
            hashBuffer.copy(codeBuffer, 1537, 0, 21); // Replace the hash in the code script
            var codeScript = new Script(codeBuffer.toString('hex'));
            return codeScript;
        }
    };
    /**
     * Builds the tape script with the specified amount for transfer.
     * @param tape - The original tape script in hex.
     * @param amountHex - The amount in hex format.
     * @returns The new tape script as a Script object.
     */
    FT.prototype.buildFTtransferTape = function (tape, amountHex) {
        var amountHexBuffer = Buffer.from(amountHex, 'hex');
        var tapeBuffer = Buffer.from(tape, 'hex');
        amountHexBuffer.copy(tapeBuffer, 3, 0, 48); // Replace the amount in the tape script
        var tapeScript = new Script(tapeBuffer.toString('hex'));
        return tapeScript;
    };
    /**
     * Builds the amount and change hex strings for the tape script.
     * @param amountBN - The amount to transfer in BN format.
     * @param tapeAmountSet - The set of amounts from the input tapes.
     * @param ftInputIndex - (Optional) The index of the FT input.
     * @returns An object containing amountHex and changeHex.
     */
    FT.prototype.buildTapeAmount = function (amountBN, tapeAmountSet, ftInputIndex) {
        var i = 0;
        var j = 0;
        var amountwriter = new BufferWriter();
        var changewriter = new BufferWriter();
        // Initialize with zeros if ftInputIndex is provided
        if (ftInputIndex) {
            for (j = 0; j < ftInputIndex; j++) {
                amountwriter.writeUInt64LEBN(new BN(0));
                changewriter.writeUInt64LEBN(new BN(0));
            }
        }
        // Build the amount and change for each tape slot
        for (i = 0; i < 6; i++) {
            if (amountBN <= BigInt(0)) {
                break;
            }
            if (tapeAmountSet[i] < amountBN) {
                amountwriter.writeUInt64LEBN(new BN(tapeAmountSet[i].toString()));
                changewriter.writeUInt64LEBN(new BN(0));
                amountBN -= BigInt(tapeAmountSet[i]);
            }
            else {
                amountwriter.writeUInt64LEBN(new BN(amountBN.toString()));
                changewriter.writeUInt64LEBN(new BN((BigInt(tapeAmountSet[i]) - amountBN).toString()));
                amountBN = BigInt(0);
            }
        }
        // Fill the remaining slots with zeros or remaining amounts
        for (j += i; i < 6 && j < 6; i++, j++) {
            if (tapeAmountSet[i]) {
                amountwriter.writeUInt64LEBN(new BN(0));
                changewriter.writeUInt64LEBN(new BN(tapeAmountSet[i].toString()));
            }
            else {
                amountwriter.writeUInt64LEBN(new BN(0));
                changewriter.writeUInt64LEBN(new BN(0));
            }
        }
        var amountHex = amountwriter.toBuffer().toString('hex');
        var changeHex = changewriter.toBuffer().toString('hex');
        return { amountHex: amountHex, changeHex: changeHex };
    };
    /**
     * Generates the unlocking script for an FT transfer.
     * @param privateKey_from - The private key of the sender.
     * @param currentTX - The current transaction object.
     * @param currentUnlockIndex - The index of the input being unlocked.
     * @param preTxId - The transaction ID of the previous 
     * @param preVout - The output index in the previous 
     * @returns The unlocking script as a Script object.
     */
    FT.prototype.getFTunlock = function (privateKey_from, currentTX, currentUnlockIndex, preTxId, preVout) {
        return __awaiter(this, void 0, void 0, function () {
            var privateKey, preTX, pretxdata, preTXtape, prepretxdata, i, chunk, inputIndex, prepreTX, currenttxdata, sig, publicKey, unlockingScript;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        privateKey = privateKey_from;
                        return [4 /*yield*/, this.fetchTXraw(preTxId)];
                    case 1:
                        preTX = _a.sent();
                        pretxdata = getPreTxdata(preTX, preVout);
                        preTXtape = preTX.outputs[preVout + 1].script.toBuffer().subarray(3, 51).toString('hex');
                        prepretxdata = '';
                        i = preTXtape.length - 16;
                        _a.label = 2;
                    case 2:
                        if (!(i >= 0)) return [3 /*break*/, 5];
                        chunk = preTXtape.substring(i, i + 16);
                        if (!(chunk != '0000000000000000')) return [3 /*break*/, 4];
                        inputIndex = i / 16;
                        return [4 /*yield*/, this.fetchTXraw(preTX.inputs[inputIndex].prevTxId.toString('hex'))];
                    case 3:
                        prepreTX = _a.sent();
                        prepretxdata = prepretxdata + getPrePreTxdata(prepreTX, preTX.inputs[inputIndex].outputIndex);
                        _a.label = 4;
                    case 4:
                        i -= 16;
                        return [3 /*break*/, 2];
                    case 5:
                        prepretxdata = '57' + prepretxdata;
                        currenttxdata = getCurrentTxdata(currentTX, currentUnlockIndex);
                        sig = (currentTX.getSignature(currentUnlockIndex, privateKey).length / 2).toString(16).padStart(2, '0') + currentTX.getSignature(currentUnlockIndex, privateKey);
                        publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') + privateKey.toPublicKey().toString();
                        unlockingScript = new Script("".concat(currenttxdata).concat(prepretxdata).concat(sig).concat(publicKey).concat(pretxdata));
                        return [2 /*return*/, unlockingScript];
                }
            });
        });
    };
    /**
     * Generates the unlocking script for an FT swap.
     * @param privateKey_from - The private key of the sender.
     * @param currentTX - The current transaction object.
     * @param currentUnlockIndex - The index of the input being unlocked.
     * @param preTxId - The transaction ID of the previous 
     * @param preVout - The output index in the previous 
     * @returns The unlocking script as a Script object.
     */
    FT.prototype.getFTunlockSwap = function (privateKey_from, currentTX, currentUnlockIndex, preTxId, preVout) {
        return __awaiter(this, void 0, void 0, function () {
            var privateKey, contractTX, contracttxdata, preTX, pretxdata, preTXtape, prepretxdata, i, chunk, inputIndex, prepreTX, currentinputsdata, currenttxdata, sig, publicKey, unlockingScript;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        privateKey = privateKey_from;
                        return [4 /*yield*/, this.fetchTXraw(currentTX.inputs[0].prevTxId.toString('hex'))];
                    case 1:
                        contractTX = _a.sent();
                        contracttxdata = getContractTxdata(contractTX, currentTX.inputs[0].outputIndex);
                        return [4 /*yield*/, this.fetchTXraw(preTxId)];
                    case 2:
                        preTX = _a.sent();
                        pretxdata = getPreTxdata(preTX, preVout);
                        preTXtape = preTX.outputs[preVout + 1].script.toBuffer().subarray(3, 51).toString('hex');
                        prepretxdata = '';
                        i = preTXtape.length - 16;
                        _a.label = 3;
                    case 3:
                        if (!(i >= 0)) return [3 /*break*/, 6];
                        chunk = preTXtape.substring(i, i + 16);
                        if (!(chunk != '0000000000000000')) return [3 /*break*/, 5];
                        inputIndex = i / 16;
                        return [4 /*yield*/, this.fetchTXraw(preTX.inputs[inputIndex].prevTxId.toString('hex'))];
                    case 4:
                        prepreTX = _a.sent();
                        prepretxdata = prepretxdata + getPrePreTxdata(prepreTX, preTX.inputs[inputIndex].outputIndex);
                        _a.label = 5;
                    case 5:
                        i -= 16;
                        return [3 /*break*/, 3];
                    case 6:
                        prepretxdata = '57' + prepretxdata;
                        currentinputsdata = getCurrentInputsdata(currentTX);
                        currenttxdata = getCurrentTxdata(currentTX, currentUnlockIndex);
                        sig = (currentTX.getSignature(currentUnlockIndex, privateKey).length / 2).toString(16).padStart(2, '0') + currentTX.getSignature(currentUnlockIndex, privateKey);
                        publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') + privateKey.toPublicKey().toString();
                        unlockingScript = new Script("".concat(currenttxdata).concat(prepretxdata).concat(sig).concat(publicKey).concat(currentinputsdata).concat(contracttxdata).concat(pretxdata));
                        return [2 /*return*/, unlockingScript];
                }
            });
        });
    };
    /**
     * Builds the code script for minting FT tokens.
     * @param txid - The transaction ID of the UTXO used for minting.
     * @param vout - The output index of the UTXO.
     * @param address - The recipient's address.
     * @param tapeSize - The size of the tape script.
     * @returns The code script as a Script object.
     */
    FT.prototype.getFTmintCode = function (txid, vout, address, tapeSize) {
        var writer = new BufferWriter();
        writer.writeReverse(Buffer.from(txid, 'hex'));
        writer.writeUInt32LE(vout);
        var utxoHex = writer.toBuffer().toString('hex');
        var publicKeyHash = Address.fromString(address).hashBuffer.toString('hex');
        var hash = publicKeyHash + '00';
        var tapeSizeHex = getSize(tapeSize).toString('hex');
        // The codeScript is constructed with specific opcodes and parameters for FT minting
        var codeScript = new Script("OP_9 OP_PICK OP_TOALTSTACK OP_1 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_5 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_4 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_3 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_2 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_1 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_0 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_FROMALTSTACK OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_3 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_TOALTSTACK OP_SHA256 OP_FROMALTSTACK OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_6 OP_PUSH_META 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_FROMALTSTACK OP_1 OP_SPLIT OP_NIP 0x01 0x14 OP_SPLIT OP_1 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_IF OP_DROP OP_1 OP_PICK OP_HASH160 OP_EQUALVERIFY OP_CHECKSIGVERIFY OP_ELSE OP_1 OP_EQUALVERIFY OP_2 OP_PICK OP_HASH160 OP_EQUALVERIFY OP_TOALTSTACK OP_CAT OP_FROMALTSTACK OP_CAT OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_OVER 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_SHA256 OP_5 OP_PUSH_META OP_EQUALVERIFY OP_CHECKSIGVERIFY OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x24 OP_SPLIT OP_DROP OP_DUP OP_TOALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUAL OP_IF OP_FROMALTSTACK OP_DROP OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_FROMALTSTACK 0x24 0x".concat(utxoHex, " OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_0 OP_EQUALVERIFY OP_7 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_SWAP OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x").concat(tapeSizeHex, " OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_0 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_0 OP_EQUALVERIFY OP_DROP OP_1 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_SHA256 OP_7 OP_PUSH_META OP_EQUAL OP_NIP 0x21 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff OP_DROP OP_RETURN 0x15 0x").concat(hash, " 0x05 0x32436f6465"));
        return codeScript;
    };
    return FT;
}());
exports.FT = FT;
/**
 * Retrieves the transaction data needed for contract operations.
 * @param tx - The transaction object.
 * @returns The transaction data as a hex string.
 */
function getContractTxdata(tx, vout) {
    var writer = new BufferWriter();
    writer.write(Buffer.from(vliolength, 'hex'));
    writer.writeUInt32LE(version);
    writer.writeUInt32LE(tx.nLockTime);
    writer.writeInt32LE(tx.inputs.length);
    writer.writeInt32LE(tx.outputs.length);
    var inputWriter = new BufferWriter();
    var inputWriter2 = new BufferWriter();
    for (var _i = 0, _a = tx.inputs; _i < _a.length; _i++) {
        var input = _a[_i];
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
        inputWriter2.write(Hash.sha256(input.script.toBuffer()));
    }
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(Hash.sha256(inputWriter.toBuffer()));
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(Hash.sha256(inputWriter2.toBuffer()));
    var _b = getPrePreOutputsData(tx, vout), outputs1 = _b.outputs1, outputs1length = _b.outputs1length, outputs2 = _b.outputs2, outputs2length = _b.outputs2length;
    writer.write(Buffer.from(outputs1length, 'hex'));
    writer.write(Buffer.from(outputs1, 'hex'));
    writer.write(Buffer.from(amountlength, 'hex'));
    writer.writeUInt64LEBN(tx.outputs[vout].satoshisBN);
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(Hash.sha256(tx.outputs[vout].script.toBuffer()));
    writer.write(Buffer.from(outputs2length, 'hex'));
    writer.write(Buffer.from(outputs2, 'hex'));
    var contracttxdata = writer.toBuffer().toString('hex');
    return "".concat(contracttxdata);
}
/**
 * Retrieves the inputs data from the current 
 * @param tx - The transaction object.
 * @returns The inputs data as a hex string.
 */
function getCurrentInputsdata(tx) {
    var writer = new BufferWriter();
    var inputWriter = new BufferWriter();
    for (var _i = 0, _a = tx.inputs; _i < _a.length; _i++) {
        var input = _a[_i];
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
    }
    writer.write(getLengthHex(inputWriter.toBuffer().length));
    writer.write(inputWriter.toBuffer());
    var currentinputsdata = writer.toBuffer().toString('hex');
    return "".concat(currentinputsdata);
}
/**
 * Retrieves the current transaction data needed for unlocking scripts.
 * @param tx - The transaction object.
 * @param inputIndex - The index of the input being unlocked.
 * @returns The transaction data as a hex string.
 */
function getCurrentTxdata(tx, inputIndex) {
    var endTag = '51';
    var writer = new BufferWriter();
    for (var i = 0; i < tx.outputs.length; i++) {
        var lockingscript = tx.outputs[i].script.toBuffer();
        if (lockingscript.length == 1564) {
            // For scripts longer than 1500 bytes, calculate partial hash
            var size = getSize(lockingscript.length); // Size in little-endian
            var partialhash = partial_sha256.calculate_partial_hash(lockingscript.subarray(0, 1536));
            var suffixdata = lockingscript.subarray(1536);
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
            var size = getSize(lockingscript.length);
            var partialhash = '00';
            var suffixdata = lockingscript;
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
    var currenttxdata = writer.toBuffer().toString('hex');
    var inputIndexMap = {
        0: '00',
        1: '51',
        2: '52',
        3: '53',
        4: '54',
        5: '55'
    };
    return "".concat(endTag).concat(currenttxdata).concat(inputIndexMap[inputIndex]);
}
/**
 * Retrieves the previous transaction data needed for unlocking scripts.
 * @param tx - The previous transaction object.
 * @param vout - The output index in the previous 
 * @returns The transaction data as a hex string.
 */
function getPreTxdata(tx, vout) {
    var writer = new BufferWriter();
    writer.write(Buffer.from(vliolength, 'hex'));
    writer.writeUInt32LE(version);
    writer.writeUInt32LE(tx.nLockTime);
    writer.writeInt32LE(tx.inputs.length);
    writer.writeInt32LE(tx.outputs.length);
    var inputWriter = new BufferWriter();
    var inputWriter2 = new BufferWriter();
    for (var _i = 0, _a = tx.inputs; _i < _a.length; _i++) {
        var input = _a[_i];
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
        inputWriter2.write(Hash.sha256(input.script.toBuffer()));
    }
    writer.write(getLengthHex(inputWriter.toBuffer().length));
    writer.write(inputWriter.toBuffer());
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(Hash.sha256(inputWriter2.toBuffer()));
    var _b = getPreOutputsData(tx, vout), outputs1 = _b.outputs1, outputs1length = _b.outputs1length, outputs2 = _b.outputs2, outputs2length = _b.outputs2length;
    writer.write(Buffer.from(outputs1length, 'hex'));
    writer.write(Buffer.from(outputs1, 'hex'));
    var lockingscript = tx.outputs[vout].script.toBuffer();
    var size = getSize(lockingscript.length); // Size in little-endian
    var partialhash = partial_sha256.calculate_partial_hash(lockingscript.subarray(0, 1536));
    var suffixdata = lockingscript.subarray(1536);
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
    var pretxdata = writer.toBuffer().toString('hex');
    return "".concat(pretxdata);
}
/**
 * Retrieves the previous transaction data from the grandparent 
 * @param tx - The grandparent transaction object.
 * @param vout - The output index in the grandparent 
 * @returns The transaction data as a hex string with a suffix '52'.
 */
function getPrePreTxdata(tx, vout) {
    var writer = new BufferWriter();
    writer.write(Buffer.from(vliolength, 'hex'));
    writer.writeUInt32LE(version);
    writer.writeUInt32LE(tx.nLockTime);
    writer.writeInt32LE(tx.inputs.length);
    writer.writeInt32LE(tx.outputs.length);
    var inputWriter = new BufferWriter();
    var inputWriter2 = new BufferWriter();
    for (var _i = 0, _a = tx.inputs; _i < _a.length; _i++) {
        var input = _a[_i];
        inputWriter.writeReverse(input.prevTxId);
        inputWriter.writeUInt32LE(input.outputIndex);
        inputWriter.writeUInt32LE(input.sequenceNumber);
        inputWriter2.write(Hash.sha256(input.script.toBuffer()));
    }
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(Hash.sha256(inputWriter.toBuffer()));
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(Hash.sha256(inputWriter2.toBuffer()));
    var _b = getPrePreOutputsData(tx, vout), outputs1 = _b.outputs1, outputs1length = _b.outputs1length, outputs2 = _b.outputs2, outputs2length = _b.outputs2length;
    writer.write(Buffer.from(outputs1length, 'hex'));
    writer.write(Buffer.from(outputs1, 'hex'));
    var lockingscript = tx.outputs[vout].script.toBuffer();
    if (lockingscript.length == 1564) {
        var size = getSize(lockingscript.length); // Size in little-endian
        var partialhash = partial_sha256.calculate_partial_hash(lockingscript.subarray(0, 1536));
        var suffixdata = lockingscript.subarray(1536);
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
        var size = getSize(lockingscript.length); // Size in little-endian
        var partialhash = '00';
        var suffixdata = lockingscript;
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
    var prepretxdata = writer.toBuffer().toString('hex');
    return "".concat(prepretxdata, "52");
}
/**
 * Helper function to get outputs data before the specified output index for the grandparent 
 * @param tx - The transaction object.
 * @param vout - The output index.
 * @returns An object containing outputs1, outputs1length, outputs2, and outputs2length.
 */
function getPrePreOutputsData(tx, vout) {
    var outputs1 = ''; // Outputs before the specified index
    var outputs1length = '';
    var outputs2 = ''; // Outputs after the specified index
    var outputs2length = '';
    if (vout === 0) {
        outputs1 = '00';
        outputs1length = '';
    }
    else {
        var outputWriter1 = new BufferWriter();
        for (var i = 0; i < vout; i++) {
            outputWriter1.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter1.write(Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs1 = outputWriter1.toBuffer().toString('hex');
        outputs1length = getLengthHex(outputs1.length / 2).toString('hex');
    }
    var outputWriter2 = new BufferWriter();
    for (var i = vout + 1; i < tx.outputs.length; i++) {
        outputWriter2.writeUInt64LEBN(tx.outputs[i].satoshisBN);
        outputWriter2.write(Hash.sha256(tx.outputs[i].script.toBuffer()));
    }
    outputs2 = outputWriter2.toBuffer().toString('hex');
    if (outputs2 === '') {
        outputs2 = '00';
        outputs2length = '';
    }
    else {
        outputs2length = getLengthHex(outputs2.length / 2).toString('hex');
    }
    return { outputs1: outputs1, outputs1length: outputs1length, outputs2: outputs2, outputs2length: outputs2length };
}
/**
 * Helper function to get outputs data before the specified output index for the parent 
 * @param tx - The transaction object.
 * @param vout - The output index.
 * @returns An object containing outputs1, outputs1length, outputs2, and outputs2length.
 */
function getPreOutputsData(tx, vout) {
    var outputs1 = ''; // Outputs before the specified index
    var outputs1length = '';
    var outputs2 = ''; // Outputs after the specified index
    var outputs2length = '';
    if (vout === 0) {
        outputs1 = '00';
        outputs1length = '';
    }
    else {
        var outputWriter1 = new BufferWriter();
        for (var i = 0; i < vout; i++) {
            outputWriter1.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter1.write(Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs1 = outputWriter1.toBuffer().toString('hex');
        outputs1length = getLengthHex(outputs1.length / 2).toString('hex');
    }
    var outputWriter2 = new BufferWriter();
    for (var i = vout + 2; i < tx.outputs.length; i++) { // For parent transaction, outputs2 starts from vout + 2
        outputWriter2.writeUInt64LEBN(tx.outputs[i].satoshisBN);
        outputWriter2.write(Hash.sha256(tx.outputs[i].script.toBuffer()));
    }
    outputs2 = outputWriter2.toBuffer().toString('hex');
    if (outputs2 === '') {
        outputs2 = '00';
        outputs2length = '';
    }
    else {
        outputs2length = getLengthHex(outputs2.length / 2).toString('hex');
    }
    return { outputs1: outputs1, outputs1length: outputs1length, outputs2: outputs2, outputs2length: outputs2length };
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

module.exports = FT