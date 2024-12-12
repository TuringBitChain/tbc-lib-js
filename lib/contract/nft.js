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
var Script = require("../script")
var Address = require("../address")
var Hash = require('../crypto/hash')
var BufferWriter = require("../encoding/bufferwriter")
var Output = require("../transaction/output")
var Transaction = require("../transaction/transaction")
// var fs = require('fs').promises;
// var path = require('path');

var NFT = /** @class */ (function () {
    function NFT(contract_id) {
        this.collection_id = "";
        this.collection_index = 0;
        this.collection_name = "";
        this.code_balance = 0;
        this.hold_balance = 0;
        this.transfer_count = 0;
        this.contract_id = "";
        this.nftData = {
            nftName: "",
            symbol: "",
            file: "",
            discription: "",
            attributes: "",
        };
        this.contract_id = contract_id;
    }
    NFT.prototype.initialize = function (network) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, collectionId, collectionIndex, collectionName, nftCodeBalance, nftP2pkhBalance, nftName, nftSymbol, nftAttributes, nftDescription, nftTransferTimeCount, nftIcon, file, writer;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, NFT.fetchNFTInfo(this.contract_id, network)];
                    case 1:
                        _a = _b.sent(), collectionId = _a.collectionId, collectionIndex = _a.collectionIndex, collectionName = _a.collectionName, nftCodeBalance = _a.nftCodeBalance, nftP2pkhBalance = _a.nftP2pkhBalance, nftName = _a.nftName, nftSymbol = _a.nftSymbol, nftAttributes = _a.nftAttributes, nftDescription = _a.nftDescription, nftTransferTimeCount = _a.nftTransferTimeCount, nftIcon = _a.nftIcon;
                        file = "";
                        writer = new BufferWriter();
                        if (nftIcon === collectionId + writer.writeUInt32LE(collectionIndex).toBuffer().toString("hex")) {
                            file = nftIcon;
                        }
                        else {
                            file = this.contract_id + "00000000";
                        }
                        this.nftData = {
                            nftName: nftName,
                            symbol: nftSymbol,
                            discription: nftDescription,
                            attributes: nftAttributes,
                            file: file
                        };
                        this.collection_id = collectionId;
                        this.collection_index = collectionIndex;
                        this.collection_name = collectionName;
                        this.code_balance = nftCodeBalance;
                        this.hold_balance = nftP2pkhBalance;
                        this.transfer_count = nftTransferTimeCount;
                        return [2 /*return*/];
                }
            });
        });
    };
    NFT.createCollection = function (address, privateKey, data, utxos, network) {
        return __awaiter(this, void 0, void 0, function () {
            var tx, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tx = new Transaction();
                        for (i = 0; i < utxos.length; i++) {
                            tx.from(utxos[i]);
                        }
                        tx.addOutput(new Output({
                            script: NFT.buildTapeScript(data),
                            satoshis: 0,
                        }));
                        for (i = 0; i < data.supply; i++) {
                            tx.addOutput(new Output({
                                script: NFT.buildMintScript(address),
                                satoshis: 100,
                            }));
                        }
                        tx.feePerKb(100)
                            .change(address)
                            .sign(privateKey);

                        // 直接返回序列化的交易，不进行广播
                        return [2 /*return*/, tx.uncheckedSerialize()];
                }
            });
        });
    };
    NFT.createNFT = function (collection_id, address, privateKey, data, utxos, network) {
        return __awaiter(this, void 0, void 0, function () {
            var hold, nfttxo, writer, tx, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hold = NFT.buildHoldScript(address);
                        return [4 /*yield*/, NFT.fetchNFTTXO({ script: hold.toBuffer().toString("hex"), tx_hash: collection_id, network: network })];
                    case 1:
                        nfttxo = _a.sent();
                        if (!data.file) {
                            writer = new BufferWriter();
                            data.file = collection_id + writer.writeUInt32LE(nfttxo.outputIndex).toBuffer().toString("hex");
                        }
                        tx = new Transaction();
                        tx.from(nfttxo);
                        for (i = 0; i < utxos.length; i++) {
                            tx.from(utxos[i]);
                        }
                        tx.addOutput(new Output({
                            script: NFT.buildCodeScript(nfttxo.txId, nfttxo.outputIndex),
                            satoshis: 1000,
                        }))
                            .addOutput(new Output({
                                script: hold,
                                satoshis: 100,
                            }))
                            .addOutput(new Output({
                                script: NFT.buildTapeScript(data),
                                satoshis: 0,
                            }))
                            .feePerKb(100)
                            .change(address)
                            .setInputScript({
                                inputIndex: 0,
                                privateKey: privateKey
                            }, function (tx) {
                                var Sig = tx.getSignature(0);
                                var SigLength = (Sig.length / 2).toString(16);
                                var sig = SigLength + Sig;
                                var publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                                var publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                                return new Script(sig + publickey);
                            })
                            .sign(privateKey)
                            .seal();

                        // 直接返回序列化的交易，不进行广播
                        return [2 /*return*/, tx.uncheckedSerialize()];
                }
            });
        });
    };
    NFT.prototype.transferNFT = function (address_from, address_to, privateKey, utxos, network) {
        return __awaiter(this, void 0, void 0, function () {
            var code, nfttxo, pre_tx, pre_pre_tx, tx, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        code = NFT.buildCodeScript(this.collection_id, this.collection_index);
                        return [4 /*yield*/, NFT.fetchNFTTXO({ script: code.toBuffer().toString("hex"), network: network })];
                    case 1:
                        nfttxo = _a.sent();
                        return [4 /*yield*/, NFT.fetchTXraw(nfttxo.txId, network)];
                    case 2:
                        pre_tx = _a.sent();
                        return [4 /*yield*/, NFT.fetchTXraw(pre_tx.toObject().inputs[0].prevTxId, network)];
                    case 3:
                        pre_pre_tx = _a.sent();
                        tx = new Transaction()
                            .addInputFromPrevTx(pre_tx, 0)
                            .addInputFromPrevTx(pre_tx, 1);
                        for (i = 0; i < utxos.length; i++) {
                            tx.from(utxos[i]);
                        }
                        tx.addOutput(new Output({
                            script: code,
                            satoshis: this.code_balance,
                        }))
                            .addOutput(new Output({
                                script: NFT.buildHoldScript(address_to),
                                satoshis: this.hold_balance,
                            }))
                            .addOutput(new Output({
                                script: NFT.buildTapeScript(this.nftData),
                                satoshis: 0,
                            }))
                            .feePerKb(100)
                            .change(address_from)
                            .setInputScript({
                                inputIndex: 0,
                                privateKey: privateKey
                            }, function (tx) {
                                var Sig = tx.getSignature(0);
                                var SigLength = (Sig.length / 2).toString(16);
                                var sig = SigLength + Sig;
                                var publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                                var publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                                var currenttxdata = NFT.getCurrentTxdata(tx);
                                var prepretxdata = NFT.getPrePreTxdata(pre_pre_tx);
                                var pretxdata = NFT.getPreTxdata(pre_tx);
                                return new Script(sig + publickey + currenttxdata + prepretxdata + pretxdata);
                            })
                            .setInputScript({
                                inputIndex: 1,
                                privateKey: privateKey
                            }, function (tx) {
                                var Sig = tx.getSignature(1);
                                var SigLength = (Sig.length / 2).toString(16);
                                var sig = SigLength + Sig;
                                var publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                                var publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                                return new Script(sig + publickey);
                            })
                            .sign(privateKey)
                            .seal();

                        // 直接返回序列化的交易，不进行广播
                        return [2 /*return*/, tx.uncheckedSerialize()];
                }
            });
        });
    };
    NFT.buildCodeScript = function (tx_hash, outputIndex) {
        var tx_id = Buffer.from(tx_hash, "hex").reverse().toString("hex");
        var writer = new BufferWriter();
        var vout = writer.writeUInt32LE(outputIndex).toBuffer().toString("hex");
        var tx_id_vout = "0x" + tx_id + vout;
        var code = new Script('OP_1 OP_PICK OP_3 OP_SPLIT 0x01 0x14 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_1 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_1 OP_PICK 0x01 0x24 OP_SPLIT OP_DROP OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_SHA256 OP_6 OP_PUSH_META 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_1 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP 0x01 0x20 OP_SPLIT OP_DROP OP_3 OP_ROLL OP_EQUALVERIFY OP_SWAP OP_FROMALTSTACK OP_DUP OP_TOALTSTACK OP_EQUAL OP_IF OP_DROP OP_ELSE 0x24 ' + tx_id_vout + ' OP_EQUALVERIFY OP_ENDIF OP_1 OP_PICK OP_FROMALTSTACK OP_EQUALVERIFY OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_7 OP_PUSH_META OP_EQUALVERIFY OP_DUP OP_HASH160 OP_FROMALTSTACK OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x05 0x33436f6465');
        return code;
    };

    NFT.buildMintScript = function (address) {
        var pubKeyHash = Address.fromString(address).hashBuffer.toString("hex");
        var mint = new Script('OP_DUP OP_HASH160' + ' 0x14 0x' + pubKeyHash + ' OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x0d 0x5630204d696e74204e486f6c64');
        return mint;
    };

    NFT.buildHoldScript = function (address) {
        var pubKeyHash = Address.fromString(address).hashBuffer.toString("hex");
        var hold = new Script('OP_DUP OP_HASH160' + ' 0x14 0x' + pubKeyHash + ' OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x0d 0x56302043757272204e486f6c64');
        return hold;
    };

    NFT.buildTapeScript = function (data) {
        var dataHex = Buffer.from(JSON.stringify(data)).toString("hex");
        var tape = Script.fromASM("OP_FALSE OP_RETURN ".concat(dataHex, " 4e54617065"));
        return tape;
    };
    // NFT.encodeByBase64 = function (filePath) {
    //     return __awaiter(this, void 0, void 0, function () {
    //         var data, ext, mimeType, base64Data, err_1;
    //         return __generator(this, function (_a) {
    //             switch (_a.label) {
    //                 case 0:
    //                     _a.trys.push([0, 2, , 3]);
    //                     return [4 /*yield*/, fs.readFile(filePath)];
    //                 case 1:
    //                     data = _a.sent();
    //                     ext = path.extname(filePath).toLowerCase();
    //                     mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    //                     base64Data = "data:".concat(mimeType, ";base64,").concat(data.toString("base64"));
    //                     return [2 /*return*/, base64Data];
    //                 case 2:
    //                     err_1 = _a.sent();
    //                     throw new Error("Failed to read or encode file: ".concat(err_1.message));
    //                 case 3: return [2 /*return*/];
    //             }
    //         });
    //     });
    // };
    NFT.getCurrentTxdata = function (tx) {
        var amountlength = '08';
        var writer = new BufferWriter();
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(NFT.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(NFT.getOutputsData(tx, 1), 'hex'));
        return writer.toBuffer().toString('hex');
    };
    NFT.getPreTxdata = function (tx) {
        var version = 10;
        var vliolength = '10';
        var amountlength = '08';
        var hashlength = '20';
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
        writer.write(NFT.getLengthHex(inputWriter.toBuffer().length));
        writer.write(inputWriter.toBuffer());
        writer.write(Buffer.from(hashlength, 'hex'));
        writer.write(Hash.sha256(inputWriter2.toBuffer()));
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(NFT.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[1].satoshisBN);
        writer.write(NFT.getLengthHex(tx.outputs[1].script.toBuffer().length));
        writer.write(tx.outputs[1].script.toBuffer());
        writer.write(Buffer.from(NFT.getOutputsData(tx, 2), 'hex'));
        return writer.toBuffer().toString('hex');
    };
    NFT.getPrePreTxdata = function (tx) {
        var version = 10;
        var vliolength = '10';
        var amountlength = '08';
        var hashlength = '20';
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
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(NFT.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(NFT.getOutputsData(tx, 1), 'hex'));
        return writer.toBuffer().toString('hex');
    };
    NFT.getOutputsData = function (tx, index) {
        var outputs = '';
        var outputslength = '';
        var outputWriter = new BufferWriter();
        for (var i = index; i < tx.outputs.length; i++) {
            outputWriter.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter.write(Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs = outputWriter.toBuffer().toString('hex');
        if (outputs === '') {
            outputs = '00';
            outputslength = '';
        }
        else {
            outputslength = NFT.getLengthHex(outputs.length / 2).toString('hex');
        }
        return outputslength + outputs;
    };
    NFT.getLengthHex = function (length) {
        if (length < 76) {
            return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
        }
        else if (length <= 255) {
            return Buffer.concat([Buffer.from('4c', 'hex'), Buffer.from(length.toString(16).padStart(2, '0'), 'hex')]);
        }
        else if (length <= 65535) {
            return Buffer.concat([Buffer.from('4d', 'hex'), Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse()]);
        }
        else if (length <= 0xFFFFFFFF) {
            var lengthBuffer = Buffer.alloc(4);
            lengthBuffer.writeUInt32LE(length);
            return Buffer.concat([Buffer.from('4e', 'hex'), lengthBuffer]);
        }
        else {
            throw new Error('Length exceeds maximum supported size (4 GB)');
        }
    };
    NFT.getBaseURL = function (network) {
        var url_testnet = "http://tbcdev.org:5000/v1/tbc/main/";
        var url_mainnet = "https://turingwallet.xyz/v1/tbc/main/";
        var base_url = network == "testnet" ? url_testnet : url_mainnet;
        return base_url;
    };
    NFT.fetchTXraw = function (txid, network) {
        return __awaiter(this, void 0, void 0, function () {
            var base_url, url, response, rawtx, tx, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        base_url = "";
                        if (network) {
                            base_url = NFT.getBaseURL(network);
                        }
                        else {
                            base_url = NFT.getBaseURL("mainnet");
                        }
                        url = base_url + "tx/hex/".concat(txid);
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
                        throw new Error("Failed to fetch TXraw.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    NFT.broadcastTXraw = function (txraw, network) {
        return __awaiter(this, void 0, void 0, function () {
            var base_url, url, response, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        base_url = "";
                        if (network) {
                            base_url = NFT.getBaseURL(network);
                        }
                        else {
                            base_url = NFT.getBaseURL("mainnet");
                        }
                        url = base_url + "broadcast/tx/raw";
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
                        throw new Error("Failed to broadcast TXraw.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    NFT.fetchUTXOs = function (address, network) {
        return __awaiter(this, void 0, void 0, function () {
            var base_url, url, response, data, scriptPubKey_1, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        base_url = "";
                        if (network) {
                            base_url = NFT.getBaseURL(network);
                        }
                        else {
                            base_url = NFT.getBaseURL("mainnet");
                        }
                        url = base_url + "address/".concat(address, "/unspent/");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url)];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch UTXO: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        scriptPubKey_1 = Script.buildPublicKeyHashOut(address).toBuffer().toString('hex');
                        return [2 /*return*/, data.map(function (utxo) {
                            return ({
                                txId: utxo.tx_hash,
                                outputIndex: utxo.tx_pos,
                                script: scriptPubKey_1,
                                satoshis: utxo.value
                            });
                        })];
                    case 4:
                        error_3 = _a.sent();
                        throw new Error("Failed to fetch UTXO.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    NFT.selectUTXOs = function (address, amount_tbc, network) {
        return __awaiter(this, void 0, void 0, function () {
            var utxos, amount_satoshis, closestUTXO, totalAmount, selectedUTXOs, _i, utxos_1, utxo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utxos = [];
                        if (!network) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fetchUTXOs(address, network)];
                    case 1:
                        utxos = _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.fetchUTXOs(address)];
                    case 3:
                        utxos = _a.sent();
                        _a.label = 4;
                    case 4:
                        utxos.sort(function (a, b) { return a.satoshis - b.satoshis; });
                        amount_satoshis = amount_tbc * Math.pow(10, 6);
                        closestUTXO = utxos.find(function (utxo) { return utxo.satoshis >= amount_satoshis + 50000; });
                        if (closestUTXO) {
                            return [2 /*return*/, [closestUTXO]];
                        }
                        totalAmount = 0;
                        selectedUTXOs = [];
                        for (_i = 0, utxos_1 = utxos; _i < utxos_1.length; _i++) {
                            utxo = utxos_1[_i];
                            totalAmount += utxo.satoshis;
                            selectedUTXOs.push(utxo);
                            if (totalAmount >= amount_satoshis + 2000) {
                                break;
                            }
                        }
                        if (totalAmount < amount_satoshis + 2000) {
                            throw new Error("Insufficient balance");
                        }
                        return [2 /*return*/, selectedUTXOs];
                }
            });
        });
    };
    NFT.fetchNFTTXO = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var script, tx_hash, network, base_url, script_hash, url, response, data, filteredUTXOs, min_vout_utxo, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        script = params.script, tx_hash = params.tx_hash, network = params.network;
                        base_url = "";
                        if (network) {
                            base_url = NFT.getBaseURL(network);
                        }
                        else {
                            base_url = NFT.getBaseURL("mainnet");
                        }
                        script_hash = Buffer.from(Hash.sha256(Buffer.from(script, "hex")).toString("hex"), "hex").reverse().toString("hex");
                        url = base_url + "script/hash/".concat(script_hash, "/unspent");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url)];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch UTXO: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        if (tx_hash) {
                            filteredUTXOs = data.filter(function (item) { return item.tx_hash === tx_hash; });
                            if (filteredUTXOs.length === 0) {
                                throw new Error('No matching UTXO found.');
                            }
                            min_vout_utxo = filteredUTXOs.reduce(function (prev, current) {
                                return prev.tx_pos < current.tx_pos ? prev : current;
                            });
                            return [2 /*return*/, {
                                txId: min_vout_utxo.tx_hash,
                                outputIndex: min_vout_utxo.tx_pos,
                                script: script,
                                satoshis: min_vout_utxo.value
                            }];
                        }
                        else {
                            return [2 /*return*/, {
                                txId: data[0].tx_hash,
                                outputIndex: data[0].tx_pos,
                                script: script,
                                satoshis: data[0].value
                            }];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _a.sent();
                        throw new Error("Failed to fetch UTXO.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    NFT.fetchNFTInfo = function (contract_id, network) {
        return __awaiter(this, void 0, void 0, function () {
            var base_url, url, response, data, nftInfo, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        base_url = "";
                        if (network) {
                            base_url = NFT.getBaseURL(network);
                        }
                        else {
                            base_url = NFT.getBaseURL("mainnet");
                        }
                        url = base_url + "nft/infos/contract_ids";
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                if_icon_needed: true,
                                nft_contract_list: [contract_id]
                            })
                        })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            if (!response.ok) {
                                throw new Error("Failed to fetch NFTInfo: ".concat(response.statusText));
                            }
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        nftInfo = {
                            collectionId: data.nftInfoList[0].collectionId,
                            collectionIndex: data.nftInfoList[0].collectionIndex,
                            collectionName: data.nftInfoList[0].collectionName,
                            nftCodeBalance: data.nftInfoList[0].nftCodeBalance,
                            nftP2pkhBalance: data.nftInfoList[0].nftP2pkhBalance,
                            nftName: data.nftInfoList[0].nftName,
                            nftSymbol: data.nftInfoList[0].nftSymbol,
                            nftAttributes: data.nftInfoList[0].nftAttributes,
                            nftDescription: data.nftInfoList[0].nftDescription,
                            nftTransferTimeCount: data.nftInfoList[0].nftTransferTimeCount,
                            nftIcon: data.nftInfoList[0].nftIcon
                        };
                        return [2 /*return*/, nftInfo];
                    case 4:
                        error_5 = _a.sent();
                        throw new Error("Failed to fetch NFTInfo.");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return NFT;
}());
module.exports = NFT;
