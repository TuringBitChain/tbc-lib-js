"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultisigTransactionHelper = void 0;

var tbc_lib_js_1 = require("tbc-lib-js");
var bs58_1 = require("bs58");

class Multisig {
    // Get hash from public keys
    static getHash(pubkeys) {
        let multiPublicKeys = "";
        for (let i = 0; i < pubkeys.length; i++) {
            multiPublicKeys = multiPublicKeys + pubkeys[i].toString();
        }
        const buf = Buffer.from(multiPublicKeys, "hex");
        const hash = tbc_lib_js_1.crypto.Hash.sha256ripemd160(buf)

        return hash;
    }

    // Create multisig address
    static createMultisigAddress(hash, signatureCount, publicKeyCount) {
        if (signatureCount < 1 || signatureCount > 6) {
            throw new Error("Invalid signatureCount.");
        }
        if (publicKeyCount < 3 || publicKeyCount > 10) {
            throw new Error("Invalid publicKeyCount.");
        }
        const prefix = (signatureCount << 4) | (publicKeyCount & 0x0f);
        const versionBuffer = Buffer.from([prefix]);
        const addressBuffer = Buffer.concat([versionBuffer, hash]);

        const checksum = tbc_lib_js_1.crypto.Hash.sha256sha256(addressBuffer).subarray(0, 4);
        const addressWithChecksum = Buffer.concat([addressBuffer, checksum]);
        return bs58_1.encode(addressWithChecksum);
    }

    // Get signature and public key count
    static getSignatureAndPublicKeyCount(buf) {
        const prefix = buf[0];
        const signatureCount = (prefix >> 4) & 0x0f;
        const publicKeyCount = prefix & 0x0f;
        return { signatureCount, publicKeyCount };
    }

    // Get multisig lock script
    static getMultisigLockScript(address) {
        const buf = Buffer.from(bs58_1.decode(address));
        const { signatureCount, publicKeyCount } = this.getSignatureAndPublicKeyCount(buf);

        if (signatureCount < 1 || signatureCount > 6) {
            throw new Error("Invalid signatureCount.");
        }
        if (publicKeyCount < 3 || publicKeyCount > 10) {
            throw new Error("Invalid publicKeyCount.");
        }

        const hash = buf.subarray(1, 21).toString("hex");
        let lockScriptPrefix = "";
        for (let i = 0; i < publicKeyCount - 1; i++) {
            lockScriptPrefix = lockScriptPrefix + "21 OP_SPLIT ";
        }
        for (let i = 0; i < publicKeyCount; i++) {
            lockScriptPrefix = lockScriptPrefix + `OP_${publicKeyCount - 1} OP_PICK `;
        }
        for (let i = 0; i < publicKeyCount - 1; i++) {
            lockScriptPrefix = lockScriptPrefix + "OP_CAT ";
        }

        const multisigLockScript = `OP_${signatureCount} OP_SWAP ` + lockScriptPrefix + `OP_HASH160 ${hash} OP_EQUALVERIFY OP_${publicKeyCount} OP_CHECKMULTISIG`;
        return multisigLockScript;
    }

    // Create P2PKH to multisig transaction
    static createP2pkhToMultisigTransaction(fromAddress, toAddress, satoshis, utxo, privateKey) {
        const transaction = new tbc_lib_js_1.Transaction();
        const lockScript = this.getMultisigLockScript(toAddress);
        transaction.from(utxo)
            .addOutput(new tbc_lib_js_1.Transaction.Output({
                script: tbc_lib_js_1.Script.fromASM(lockScript),
                satoshis: satoshis
            }))
            .fee(300)
            .change(fromAddress)
            .sign(privateKey);
        return transaction;
    }

    // Create from multisig transaction
    static fromMultisigTransaction(fromAddress, toAddress, satoshis, utxo) {
        const transaction = new tbc_lib_js_1.Transaction();
        const fromLockScript = this.getMultisigLockScript(fromAddress);

        if (toAddress.startsWith("1")) {
            transaction.from(utxo)
                .fee(300)
                .to(toAddress, satoshis)
                .addOutput(new tbc_lib_js_1.Transaction.Output({
                    script: tbc_lib_js_1.Script.fromASM(fromLockScript),
                    satoshis: satoshis - 300
                }));
        } else {
            const toLockScript = this.getMultisigLockScript(toAddress);
            transaction.from(utxo)
                .fee(300)
                .addOutput(new tbc_lib_js_1.Transaction.Output({
                    script: tbc_lib_js_1.Script.fromASM(toLockScript),
                    satoshis: satoshis
                }))
                .addOutput(new tbc_lib_js_1.Transaction.Output({
                    script: tbc_lib_js_1.Script.fromASM(fromLockScript),
                    satoshis: satoshis - 300
                }));
        }
        return transaction;
    }

    // Sign from multisig transaction
    static signfromMultisigTransaction(transaction, privateKey, inputIndex) {
        const sig = transaction.getSignature(inputIndex, privateKey);
        return sig;
    }

    // Create from multisig transaction with signatures
    static createFromMultisigTransaction(transaction, sigs, pubkeys, inputIndex) {
        transaction.setInputScript({
            inputIndex: inputIndex
        }, function (tx) {
            let signature = "";
            for (let i = 0; i < sigs.length; i++) {
                if (i < sigs.length - 1) {
                    signature = signature + sigs[i] + " ";
                } else {
                    signature = signature + sigs[i];
                }
            }
            const unlockingScript = tbc_lib_js_1.Script.fromASM(`OP_0 ${signature} ${pubkeys}`);
            return unlockingScript;
        });
        return transaction;
    }
}

module.exports = Multisig
