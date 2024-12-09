import * as tbc from "tbc-lib-js"
const fs = require('fs').promises;
const path = require('path');

interface CollectionData {
    collectionName: string;
    description: string;
    supply: number;
    file: string;
};

interface NFTData {
    nftName: string;
    symbol: string;
    discription: string;
    attributes: string;
    file?: string;
}

interface NFTInfo {
    collectionId: string;
    collectionIndex: number;
    collectionName: string;
    nftCodeBalance: number;
    nftP2pkhBalance: number;
    nftName: string;
    nftSymbol: string;
    nft_attributes: string;
    nftDescription: string;
    nftTransferTimeCount: number;
    nftIcon: string
}

class NFT {
    collection_id: string = "";
    collection_index: number = 0;
    collection_name: string = "";
    code_balance: number = 0;
    hold_balance: number = 0;
    transfer_count: number = 0;
    contract_id: string = "";
    nftData: NFTData = {
        nftName: "",
        symbol: "",
        file: "",
        discription: "",
        attributes: "",
    };

    constructor(contract_id: string) {
        this.contract_id = contract_id;
    }

    async initialize(network?: "testnet" | "mainnet") {
        const {
            collectionId,
            collectionIndex,
            collectionName,
            nftCodeBalance,
            nftP2pkhBalance,
            nftName,
            nftSymbol,
            nft_attributes,
            nftDescription,
            nftTransferTimeCount,
            nftIcon } = await NFT.fetchNFTInfo(this.contract_id, network);
        let file: string = "";
        const writer = new tbc.encoding.BufferWriter();
        if (nftIcon === collectionId + writer.writeUInt32LE(collectionIndex).toBuffer().toString("hex")) {
            file = nftIcon;
        } else {
            file = this.contract_id + "00000000";
        }
        this.nftData = {
            nftName,
            symbol: nftSymbol,
            discription: nftDescription,
            attributes: nft_attributes,
            file
        }
        this.collection_id = collectionId;
        this.collection_index = collectionIndex;
        this.collection_name = collectionName;
        this.code_balance = nftCodeBalance;
        this.hold_balance = nftP2pkhBalance;
        this.transfer_count = nftTransferTimeCount;
    }

    static async createCollection(address: string, privateKey: tbc.PrivateKey, data: CollectionData, utxos: tbc.Transaction.IUnspentOutput[], network?: "testnet" | "mainnet"): Promise<string> {
        const tx = new tbc.Transaction();
        for (let i = 0; i < utxos.length; i++) {
            tx.from(utxos[i]);
        }
        tx.addOutput(new tbc.Transaction.Output({
            script: NFT.buildTapeScript(data),
            satoshis: 0,
        }));

        for (let i = 0; i < data.supply; i++) {
            tx.addOutput(new tbc.Transaction.Output({
                script: NFT.buildHoldScript(address),
                satoshis: 100,
            }));
        }

        tx.feePerKb(100)
            .change(address)
            .sign(privateKey);

        return await NFT.broadcastTXraw(tx.uncheckedSerialize(), network);

    }

    static async createNFT(collection_id: string, address: string, privateKey: tbc.PrivateKey, data: NFTData, utxos: tbc.Transaction.IUnspentOutput[], network?: "testnet" | "mainnet"): Promise<string> {
        const hold = NFT.buildHoldScript(address);
        const nfttxo = await NFT.fetchNFTTXO({ script: hold.toBuffer().toString("hex"), tx_hash: collection_id, network });
        if (!data.file) {
            const writer = new tbc.encoding.BufferWriter();
            data.file = collection_id + writer.writeUInt32LE(nfttxo.outputIndex).toBuffer().toString("hex");
        }
        const tx = new tbc.Transaction();
        tx.from(nfttxo);
        for (let i = 0; i < utxos.length; i++) {
            tx.from(utxos[i]);
        };
        tx.addOutput(new tbc.Transaction.Output({
            script: NFT.buildCodeScript(nfttxo.txId, nfttxo.outputIndex),
            satoshis: 1000,
        }))
            .addOutput(new tbc.Transaction.Output({
                script: hold,
                satoshis: 100,
            }))
            .addOutput(new tbc.Transaction.Output({
                script: NFT.buildTapeScript(data),
                satoshis: 0,
            }))
            .feePerKb(100)
            .change(address)
            .setInputScript({
                inputIndex: 0,
                privateKey
            }, (tx) => {
                const Sig = tx.getSignature(0);
                const SigLength = (Sig.length / 2).toString(16);
                const sig = SigLength + Sig;
                const publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                const publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                return new tbc.Script(sig + publickey);
            })
            .sign(privateKey)
            .seal()
        return await NFT.broadcastTXraw(tx.uncheckedSerialize(), network);
    }

    async transferNFT(address_from: string, address_to: string, privateKey: tbc.PrivateKey, utxos: tbc.Transaction.IUnspentOutput[], network?: "testnet" | "mainnet"): Promise<string> {
        const code = NFT.buildCodeScript(this.collection_id, this.collection_index);
        const nfttxo = await NFT.fetchNFTTXO({ script: code.toBuffer().toString("hex"), network });
        const pre_tx = await NFT.fetchTXraw(nfttxo.txId, network);
        const pre_pre_tx = await NFT.fetchTXraw(pre_tx.toObject().inputs[0].prevTxId, network);

        const tx = new tbc.Transaction()
            .addInputFromPrevTx(pre_tx, 0)
            .addInputFromPrevTx(pre_tx, 1)
        for (let i = 0; i < utxos.length; i++) {
            tx.from(utxos[i]);
        };
        tx.addOutput(new tbc.Transaction.Output({
            script: code,
            satoshis: this.code_balance,
        }))
            .addOutput(new tbc.Transaction.Output({
                script: NFT.buildHoldScript(address_to),
                satoshis: this.hold_balance,
            }))
            .addOutput(new tbc.Transaction.Output({
                script: NFT.buildTapeScript(this.nftData),
                satoshis: 0,
            }))
            .feePerKb(100)
            .change(address_from)
            .setInputScript({
                inputIndex: 0,
                privateKey
            }, (tx) => {
                const Sig = tx.getSignature(0);
                const SigLength = (Sig.length / 2).toString(16);
                const sig = SigLength + Sig;
                const publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                const publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                const currenttxdata = NFT.getCurrentTxdata(tx);
                const prepretxdata = NFT.getPrePreTxdata(pre_pre_tx)
                const pretxdata = NFT.getPreTxdata(pre_tx)
                return new tbc.Script(sig + publickey + currenttxdata + prepretxdata + pretxdata);
            })
            .setInputScript({
                inputIndex: 1,
                privateKey
            }, (tx) => {
                const Sig = tx.getSignature(1);
                const SigLength = (Sig.length / 2).toString(16);
                const sig = SigLength + Sig;
                const publicKeylength = (privateKey.toPublicKey().toBuffer().toString('hex').length / 2).toString(16);
                const publickey = publicKeylength + privateKey.toPublicKey().toBuffer().toString('hex');
                return new tbc.Script(sig + publickey);
            })
            .sign(privateKey)
            .seal()

        return await NFT.broadcastTXraw(tx.uncheckedSerialize());
    }

    private static buildCodeScript(tx_hash: string, outputIndex: number): tbc.Script {
        const tx_id = Buffer.from(tx_hash, "hex").reverse().toString("hex");
        const writer = new tbc.encoding.BufferWriter();
        const vout = writer.writeUInt32LE(outputIndex).toBuffer().toString("hex");
        const tx_id_vout = "0x" + tx_id + vout;
        const code = new tbc.Script('OP_1 OP_PICK OP_3 OP_SPLIT 0x01 0x14 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_1 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_1 OP_PICK 0x01 0x24 OP_SPLIT OP_DROP OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_SHA256 OP_6 OP_PUSH_META 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_1 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP 0x01 0x20 OP_SPLIT OP_DROP OP_3 OP_ROLL OP_EQUALVERIFY OP_SWAP OP_FROMALTSTACK OP_DUP OP_TOALTSTACK OP_EQUAL OP_IF OP_DROP OP_ELSE 0x24 ' + tx_id_vout + ' OP_EQUALVERIFY OP_ENDIF OP_1 OP_PICK OP_FROMALTSTACK OP_EQUALVERIFY OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_7 OP_PUSH_META OP_EQUALVERIFY OP_DUP OP_HASH160 OP_FROMALTSTACK OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x05 0x33436f6465');
        return code;
    };

    private static buildHoldScript(address: string): tbc.Script {
        const pubKeyHash = tbc.Address.fromString(address).hashBuffer.toString("hex");
        const hold = new tbc.Script('OP_DUP OP_HASH160' + ' 0x14 0x' + pubKeyHash + ' OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x0d 0x5631204d696e74204e486f6c64');
        return hold;
    }

    private static buildTapeScript(data: CollectionData | NFTData): tbc.Script {
        const dataHex = Buffer.from(JSON.stringify(data)).toString("hex");
        const tape = tbc.Script.fromASM(`OP_FALSE OP_RETURN ${dataHex} 4e54617065`);
        return tape;
    }

    static async encodeByBase64(filePath: string): Promise<string> {
        try {
            const data = await fs.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
            const base64Data = `data:${mimeType};base64,${data.toString("base64")}`;
            return base64Data;
        } catch (err) {
            throw new Error(`Failed to read or encode file: ${err.message}`);
        }
    }

    private static getCurrentTxdata(tx: tbc.Transaction): string {
        const amountlength = '08';
        const writer = new tbc.encoding.BufferWriter();
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);
        writer.write(NFT.getLengthHex(tx.outputs[0].script.toBuffer().length));
        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(NFT.getOutputsData(tx, 1), 'hex'));
        return writer.toBuffer().toString('hex');
    }

    private static getPreTxdata(tx: tbc.Transaction): string {
        const version = 10;
        const vliolength = '10';
        const amountlength = '08';
        const hashlength = '20';

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
        writer.write(NFT.getLengthHex(inputWriter.toBuffer().length));
        writer.write(inputWriter.toBuffer());
        writer.write(Buffer.from(hashlength, 'hex'));
        writer.write(tbc.crypto.Hash.sha256(inputWriter2.toBuffer()));
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
    }

    private static getPrePreTxdata(tx: tbc.Transaction): string {
        const version = 10;
        const vliolength = '10';
        const amountlength = '08';
        const hashlength = '20';

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
        writer.write(Buffer.from(amountlength, 'hex'));
        writer.writeUInt64LEBN(tx.outputs[0].satoshisBN);

        writer.write(NFT.getLengthHex(tx.outputs[0].script.toBuffer().length));

        writer.write(tx.outputs[0].script.toBuffer());
        writer.write(Buffer.from(NFT.getOutputsData(tx, 1), 'hex'));
        return writer.toBuffer().toString('hex');
    }

    private static getOutputsData(tx: tbc.Transaction, index: number) {

        let outputs = '';
        let outputslength = '';

        const outputWriter = new tbc.encoding.BufferWriter();
        for (let i = index; i < tx.outputs.length; i++) {
            outputWriter.writeUInt64LEBN(tx.outputs[i].satoshisBN);
            outputWriter.write(tbc.crypto.Hash.sha256(tx.outputs[i].script.toBuffer()));
        }
        outputs = outputWriter.toBuffer().toString('hex');

        if (outputs === '') {
            outputs = '00';
            outputslength = '';
        } else {
            outputslength = NFT.getLengthHex(outputs.length / 2).toString('hex');
        }

        return outputslength + outputs;

    }

    private static getLengthHex(length: number): Buffer {
        if (length < 76) {
            return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
        } else if (length <= 255) {
            return Buffer.concat([Buffer.from('4c', 'hex'), Buffer.from(length.toString(16).padStart(2, '0'), 'hex')]);
        } else if (length <= 65535) {
            return Buffer.concat([Buffer.from('4d', 'hex'), Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse()]);
        } else if (length <= 0xFFFFFFFF) {
            const lengthBuffer = Buffer.alloc(4);
            lengthBuffer.writeUInt32LE(length);
            return Buffer.concat([Buffer.from('4e', 'hex'), lengthBuffer]);
        } else {
            throw new Error('Length exceeds maximum supported size (4 GB)');
        }
    }

    private static getBaseURL(network: "testnet" | "mainnet"): string {
        const url_testnet = `http://tbcdev.org:5000/v1/tbc/main/`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/`;
        const base_url = network == "testnet" ? url_testnet : url_mainnet;
        return base_url;
    }

    static async fetchTXraw(txid: string, network?: "testnet" | "mainnet"): Promise<tbc.Transaction> {
        let base_url = "";
        if (network) {
            base_url = NFT.getBaseURL(network)
        } else {
            base_url = NFT.getBaseURL("mainnet")
        }
        const url = base_url + `tx/hex/${txid}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch TXraw: ${response.statusText}`);
            }
            const rawtx = await response.json();
            const tx = new tbc.Transaction();
            tx.fromString(rawtx);
            return tx;
        } catch (error) {
            throw new Error("Failed to fetch TXraw.");
        }
    }

    static async broadcastTXraw(txraw: string, network?: "testnet" | "mainnet"): Promise<string> {
        let base_url = "";
        if (network) {
            base_url = NFT.getBaseURL(network)
        } else {
            base_url = NFT.getBaseURL("mainnet")
        }
        const url = base_url + `broadcast/tx/raw`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    txHex: txraw
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to broadcast TXraw: ${response.statusText}`);
            }
            const data = await response.json();
            console.log('txid:', data.result);
            if (data.error) {
                console.log('error:', data.error);
            }
            return data.result;
        } catch (error) {
            throw new Error("Failed to broadcast TXraw.");
        }
    }

    static async fetchUTXOs(address: string, network?: "testnet" | "mainnet"): Promise<tbc.Transaction.IUnspentOutput[]> {
        let base_url = "";
        if (network) {
            base_url = NFT.getBaseURL(network)
        } else {
            base_url = NFT.getBaseURL("mainnet")
        }
        const url = base_url + `address/${address}/unspent/`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch UTXO: ".concat(response.statusText));
            }
            const data: { tx_hash: string; tx_pos: number; height: number; value: number; }[] = await response.json();

            const scriptPubKey = tbc.Script.buildPublicKeyHashOut(address).toBuffer().toString('hex');

            return data.map((utxo) => ({
                txId: utxo.tx_hash,
                outputIndex: utxo.tx_pos,
                script: scriptPubKey,
                satoshis: utxo.value
            }));
        } catch (error) {
            throw new Error("Failed to fetch UTXO.");
        }
    }

    static async selectUTXOs(address: string, amount_tbc: number, network?: "testnet" | "mainnet"): Promise<tbc.Transaction.IUnspentOutput[]> {
        let utxos: tbc.Transaction.IUnspentOutput[] = [];
        if (network) {
            utxos = await this.fetchUTXOs(address, network);
        } else {
            utxos = await this.fetchUTXOs(address);
        }
        utxos.sort((a, b) => a.satoshis - b.satoshis);
        const amount_satoshis = amount_tbc * Math.pow(10, 6);
        const closestUTXO = utxos.find(utxo => utxo.satoshis >= amount_satoshis + 50000);
        if (closestUTXO) {
            return [closestUTXO];
        }

        let totalAmount = 0;
        const selectedUTXOs: tbc.Transaction.IUnspentOutput[] = [];

        for (const utxo of utxos) {
            totalAmount += utxo.satoshis;
            selectedUTXOs.push(utxo);

            if (totalAmount >= amount_satoshis + 2000) {
                break;
            }
        }

        if (totalAmount < amount_satoshis + 2000) {
            throw new Error("Insufficient balance");
        }

        return selectedUTXOs;
    }

    static async fetchNFTTXO(params: { script: string, tx_hash?: string, network?: "testnet" | "mainnet" }): Promise<tbc.Transaction.IUnspentOutput> {
        const { script, tx_hash, network } = params;
        let base_url = "";
        if (network) {
            base_url = NFT.getBaseURL(network)
        } else {
            base_url = NFT.getBaseURL("mainnet")
        }
        const script_hash = Buffer.from(tbc.crypto.Hash.sha256(Buffer.from(script, "hex")).toString("hex"), "hex").reverse().toString("hex");
        const url = base_url + `script/hash/${script_hash}/unspent`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch UTXO: ".concat(response.statusText));
            }
            const data: { tx_hash: string; tx_pos: number; height: number; value: number; }[] = await response.json();
            if (tx_hash) {
                const filteredUTXOs = data.filter(item => item.tx_hash === tx_hash);

                if (filteredUTXOs.length === 0) {
                    throw new Error('No matching UTXO found.');
                }

                const min_vout_utxo = filteredUTXOs.reduce((prev, current) =>
                    prev.tx_pos < current.tx_pos ? prev : current
                );

                return {
                    txId: min_vout_utxo.tx_hash,
                    outputIndex: min_vout_utxo.tx_pos,
                    script: script,
                    satoshis: min_vout_utxo.value
                }
            } else {
                return {
                    txId: data[0].tx_hash,
                    outputIndex: data[0].tx_pos,
                    script: script,
                    satoshis: data[0].value
                }
            }

        } catch (error) {
            throw new Error("Failed to fetch UTXO.");
        }
    }

    static async fetchNFTInfo(contract_id: string, network?: "testnet" | "mainnet"): Promise<NFTInfo> {
        let base_url = "";
        if (network) {
            base_url = NFT.getBaseURL(network)
        } else {
            base_url = NFT.getBaseURL("mainnet")
        }
        const url = base_url + "nft/infos/contract_ids"
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    if_icon_needed: true,
                    nft_contract_list: [contract_id]
                })
            });
            if (!response.ok) {
                if (!response.ok) {
                    throw new Error("Failed to fetch NFTInfo: ".concat(response.statusText));
                }
            }
            const data = await response.json();

            const nftInfo: NFTInfo = {
                collectionId: data.nftInfoList[0].collectionId,
                collectionIndex: data.nftInfoList[0].collectionIndex,
                collectionName: data.nftInfoList[0].collectionName,
                nftCodeBalance: data.nftInfoList[0].nftCodeBalance,
                nftP2pkhBalance: data.nftInfoList[0].nftP2pkhBalance,
                nftName: data.nftInfoList[0].nftName,
                nftSymbol: data.nftInfoList[0].nftSymbol,
                nft_attributes: data.nftInfoList[0].nft_attributes,
                nftDescription: data.nftInfoList[0].nftDescription,
                nftTransferTimeCount: data.nftInfoList[0].nftTransferTimeCount,
                nftIcon: data.nftInfoList[0].nftIcon
            }

            return nftInfo;
        } catch (error) {
            throw new Error("Failed to fetch NFTInfo.");
        }
    }
}

module.exports = NFT;



