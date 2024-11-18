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
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
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
var axios_1 = require("axios");
var tbc_lib_js_1 = require("tbc-lib-js");
var NFT = /** @class */ (function () {
    function NFT(baseUrl) {
        this.baseUrl = baseUrl;
    }

    NFT.prototype.getCurrentTxdata = function (tx) {
        var amountlength = '08';
        var writer = new tbc_lib_js_1.encoding.BufferWriter();
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(this.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(this.getOutputsData(tx, 1), 'hex'));
        return writer.toBuffer().toString('hex');
    };

    NFT.prototype.getPreTxdata = function (tx) {
        var version = 10;
        var vliolength = '10';
        var amountlength = '08';
        var hashlength = '20';
        var writer = new tbc_lib_js_1.encoding.BufferWriter();
        writer.write(Buffer.from(vliolength, 'hex'));
        writer.writeUInt32LE(version);
        writer.writeUInt32LE(tx.nLockTime);
        writer.writeInt32LE(tx.inputs.length);
        writer.writeInt32LE(tx.outputs.length);
        var inputWriter = new tbc_lib_js_1.encoding.BufferWriter();
        var inputWriter2 = new tbc_lib_js_1.encoding.BufferWriter();
        for (var _i = 0, _a = tx.inputs; _i < _a.length; _i++) {
            var input = _a[_i];
            inputWriter.writeReverse(input.prevTxId);
            inputWriter.writeUInt32LE(input.outputIndex);
            inputWriter.writeUInt32LE(input.sequenceNumber);
            inputWriter2.write(tbc_lib_js_1.crypto.Hash.sha256(input.script.toBuffer()));
        }
        writer.write(this.getLengthHex(inputWriter.toBuffer().length));
        writer.write(inputWriter.toBuffer());
        writer.write(Buffer.from(hashlength, 'hex'));
        writer.write(tbc_lib_js_1.crypto.Hash.sha256(inputWriter2.toBuffer()));
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(this.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[1].satoshisBN);
        writer.write(this.getLengthHex(tx.outputs[1].script.toBuffer().length));
        writer.write(tx.outputs[1].script.toBuffer());
        writer.write(Buffer.from(this.getOutputsData(tx, 2), 'hex'));
        return writer.toBuffer().toString('hex');
    };

    NFT.prototype.getPrePreTxdata = function (tx) {
        var version = 10;
        var vliolength = '10';
        var amountlength = '08';
        var hashlength = '20';
        var writer = new tbc_lib_js_1.encoding.BufferWriter();
        writer.write(Buffer.from(vliolength, 'hex'));
        writer.writeUInt32LE(version);
        writer.writeUInt32LE(tx.nLockTime);
        writer.writeInt32LE(tx.inputs.length);
        writer.writeInt32LE(tx.outputs.length);
        var inputWriter = new tbc_lib_js_1.encoding.BufferWriter();
        var inputWriter2 = new tbc_lib_js_1.encoding.BufferWriter();
        for (var _i = 0, _a = tx.inputs; _i < _a.length; _i++) {
            var input = _a[_i];
            inputWriter.writeReverse(input.prevTxId);
            inputWriter.writeUInt32LE(input.outputIndex);
            inputWriter.writeUInt32LE(input.sequenceNumber);
            inputWriter2.write(tbc_lib_js_1.crypto.Hash.sha256(input.script.toBuffer()));
        }
        writer.write(Buffer.from(hashlength, 'hex'));
        writer.write(tbc_lib_js_1.crypto.Hash.sha256(inputWriter.toBuffer()));
        writer.write(Buffer.from(hashlength, 'hex'));
        writer.write(tbc_lib_js_1.crypto.Hash.sha256(inputWriter2.toBuffer()));
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(this.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(this.getOutputsData(tx, 1), 'hex'));
        return writer.toBuffer().toString('hex');
    };

    NFT.prototype.getOutputsData = function (tx, index) {
        var outputs = '';
        var outputslength = '';
        var outputWriter = new tbc_lib_js_1.encoding.BufferWriter();
        for (var i = index; i < tx.outputs.length; i++) {
            outputWriter.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter.write(tbc_lib_js_1.crypto.Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs = outputWriter.toBuffer().toString('hex');
        if (outputs === '') {
            outputs = '00';
            outputslength = '';
        }
        else {
            outputslength = this.getLengthHex(outputs.length / 2).toString('hex');
        }
        return outputslength + outputs;
    };

    NFT.prototype.getLengthHex = function (length) {
        if (length < 76) {
            return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
        }
        else if (length > 75 && length < 256) {
            return Buffer.concat([Buffer.from('4c', 'hex'), Buffer.from(length.toString(16), 'hex')]);
        }
        else {
            return Buffer.concat([Buffer.from('4d', 'hex'), Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse()]);
        }
    };

    NFT.prototype.fetchTXraw = function (txid) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, rawtx, tx, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.baseUrl, "/v1/tbc/main/tx/hex/").concat(txid);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.get(url)];
                    case 2:
                        response = _a.sent();
                        rawtx = response.data;
                        tx = new tbc_lib_js_1.Transaction();
                        tx.fromString(rawtx);
                        return [2 /*return*/, tx];
                    case 3:
                        error_1 = _a.sent();
                        throw new Error("Failed to fetch TXraw.");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };

    NFT.prototype.broadcastTXraw = function (txraw) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.baseUrl, "/v1/tbc/main/broadcast/tx/raw");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.post(url, {
                            txHex: txraw
                        })];
                    case 2:
                        response = _a.sent();
                        console.log('txid:', response.data.result);
                        if (response.data.error) {
                            console.log('error:', response.data.error);
                        }
                        return [2 /*return*/, response.data.result];
                    case 3:
                        error_2 = _a.sent();
                        throw new Error("Failed to broadcast TXraw.");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };

    NFT.prototype.fetchUTXO = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var url, scriptPubKey, response, data, i, utxo, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.baseUrl, "/v1/tbc/main/address/").concat(address.toString(), "/unspent/");
                        scriptPubKey = tbc_lib_js_1.Script.buildPublicKeyHashOut(address).toBuffer().toString('hex');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.get(url)];
                    case 2:
                        response = _a.sent();
                        data = response.data[0];
                        for (i = 0; i < response.data.length; i++) {
                            if (response.data[i].value > 5000 && response.data[i].value < 100000) {
                                data = response.data[i];
                                break;
                            }
                        }
                        if (data.value < 5000) {
                            throw new Error('UTXO value is less than 5000');
                        }
                        utxo = {
                            txId: data.tx_hash,
                            outputIndex: data.tx_pos,
                            script: scriptPubKey,
                            satoshis: data.value
                        };
                        return [2 /*return*/, utxo];
                    case 3:
                        error_3 = _a.sent();
                        throw new Error("Failed to fetch UTXO.");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };

    NFT.prototype.buildCodeScript = function (utxo) {
        var txId = Buffer.from(utxo.txId, "hex").reverse().toString("hex");
        var writer = new tbc_lib_js_1.encoding.BufferWriter();
        var vout = writer.writeUInt32LE(utxo.outputIndex).toBuffer().toString("hex");
        var script = "0x" + txId + vout;
        var code = new tbc_lib_js_1.Script("OP_1 OP_PICK OP_3 OP_SPLIT 0x01 0x14 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_1 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_1 OP_PICK 0x01 0x24 OP_SPLIT OP_DROP OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_SHA256 OP_6 OP_PUSH_META 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_1 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP 0x01 0x20 OP_SPLIT OP_DROP OP_3 OP_ROLL OP_EQUALVERIFY OP_SWAP OP_FROMALTSTACK OP_DUP OP_TOALTSTACK OP_EQUAL OP_IF OP_DROP OP_ELSE 0x24 ".concat(script, " OP_EQUALVERIFY OP_ENDIF OP_1 OP_PICK OP_FROMALTSTACK OP_EQUALVERIFY OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_7 OP_PUSH_META OP_EQUALVERIFY OP_DUP OP_HASH160 OP_FROMALTSTACK OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x05 0x03436f6465"));
        return code;
    };

    NFT.prototype.buildHoldScript = function (address, flag) {
        var pubKeyHash = address.hashBuffer.toString("hex");
        var hold;
        if (flag) {
            var flagHex = Buffer.from(flag, 'utf8').toString('hex');
            var flagHexlength = this.getLengthHex(flagHex.length / 2).toString('hex');
            hold = new tbc_lib_js_1.Script('OP_DUP OP_HASH160' + ' 0x14 0x' + pubKeyHash + ' OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x' + flagHexlength + ' 0x' + flagHex);
        }
        else {
            hold = new tbc_lib_js_1.Script('OP_DUP OP_HASH160' + ' 0x14 0x' + pubKeyHash + ' OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x0d 0x5631204d696e74204e486f6c64');
        }
        return hold;
    };

    NFT.prototype.buildTapeScript = function (data) {
        var dataHex = Buffer.from(JSON.stringify(data)).toString("hex");
        var dataHexLength = this.getLengthHex(dataHex.length / 2).toString('hex');
        var tape = new tbc_lib_js_1.Script('OP_FALSE OP_RETURN 0x' + dataHexLength + ' 0x' + dataHex + ' 0x05 0x4e54617065');
        return tape;
    };

    NFT.prototype.createNFT = function (fromAddress, toAddress, privateKey, data) {
        return __awaiter(this, void 0, void 0, function () {
            var utxo, code, hold, tape, tx;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchUTXO(fromAddress)];
                    case 1:
                        utxo = _a.sent();
                        code = this.buildCodeScript(utxo);
                        hold = this.buildHoldScript(toAddress);
                        tape = this.buildTapeScript(data);
                        tx = new tbc_lib_js_1.Transaction()
                            .from(utxo)
                            .addOutput(new tbc_lib_js_1.Transaction.Output({
                                script: code,
                                satoshis: 1000,
                            }))
                            .addOutput(new tbc_lib_js_1.Transaction.Output({
                                script: hold,
                                satoshis: 500,
                            }))
                            .addOutput(new tbc_lib_js_1.Transaction.Output({
                                script: tape,
                                satoshis: 0,
                            }))
                            .fee(1000)
                            .change(fromAddress)
                            .sign(privateKey)
                            .seal();
                        return [4 /*yield*/, this.broadcastTXraw(tx.uncheckedSerialize())];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };

    NFT.prototype.transferNFT = function (fromAddress, toAddress, privateKey, data, txId) {
        return __awaiter(this, void 0, void 0, function () {
            var tx1, tx0, utxo, hold, tape, tx2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchTXraw(txId)];
                    case 1:
                        tx1 = _a.sent();
                        return [4 /*yield*/, this.fetchTXraw(tx1.toObject().inputs[0].prevTxId)];
                    case 2:
                        tx0 = _a.sent();
                        return [4 /*yield*/, this.fetchUTXO(fromAddress)];
                    case 3:
                        utxo = _a.sent();
                        hold = this.buildHoldScript(toAddress);
                        tape = this.buildTapeScript(data);
                        tx2 = new tbc_lib_js_1.Transaction()
                            .addInputFromPrevTx(tx1, 0)
                            .addInputFromPrevTx(tx1, 1)
                            .from(utxo)
                            .addOutput(new tbc_lib_js_1.Transaction.Output({
                                script: tbc_lib_js_1.Script.fromString(tx1.toObject().outputs[0].script),
                                satoshis: 1000,
                            }))
                            .addOutput(new tbc_lib_js_1.Transaction.Output({
                                script: hold,
                                satoshis: 500,
                            }))
                            .addOutput(new tbc_lib_js_1.Transaction.Output({
                                script: tape,
                                satoshis: 0,
                            }))
                            .fee(3000)
                            .change(fromAddress)
                            .setInputScript({
                                inputIndex: 0
                            }, function (tx) {
                                var Sig = tx.getSignature(0, privateKey);
                                var SigLength = (Sig.length / 2).toString(16);
                                var sig = SigLength + Sig;
                                var publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                                var publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                                var prepretxdata = _this.getPrePreTxdata(tx0);
                                var pretxdata = _this.getPreTxdata(tx1);
                                var currenttxdata = _this.getCurrentTxdata(tx);
                                return new tbc_lib_js_1.Script(sig + publickey + currenttxdata + prepretxdata + pretxdata);
                            })
                            .setInputScript({
                                inputIndex: 1
                            }, function (tx) {
                                var Sig = tx.getSignature(1, privateKey);
                                var SigLength = (Sig.length / 2).toString(16);
                                var sig = SigLength + Sig;
                                var publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                                var publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                                return new tbc_lib_js_1.Script(sig + publickey);
                            })
                            .sign(privateKey)
                            .seal();
                        return [4 /*yield*/, this.broadcastTXraw(tx2.uncheckedSerialize())];
                    case 4: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return NFT;
}());

module.exports = NFT
