interface MultiTxRaw {
    txraw: string;
    amounts: number[];
}

interface Unspent {
    tx_hash: string,
    tx_pos: number,
    height: number,
    value: number
}

class Multisig {

    ft: FT | undefined;
    network: "testnet" | "mainnet" = "mainnet";

    constructor(config?: { ft?: FT, network?: "testnet" | "mainnet" }) {

        this.ft = config?.ft ?? undefined;
        this.network = config?.network ?? "mainnet";
    }

    private static getHash(pubkeys: string[]): Buffer {

        let multiPublicKeys = "";

        for (let i = 0; i < pubkeys.length; i++) {
            multiPublicKeys = multiPublicKeys + pubkeys[i];
        }

        const buf = Buffer.from(multiPublicKeys, "hex");
        const hash = crypto.Hash.sha256ripemd160(buf);

        return hash;
    }

    static verifyMultisigAddress(pubkeys: string[], address: string): boolean {
        const hash_from_pubkeys = Multisig.getHash(pubkeys).toString();
        const buf = Buffer.from(base58.decode(address))
        const hash_from_address = buf.subarray(1, 21).toString("hex");
        return hash_from_pubkeys === hash_from_address;
    }


    static createMultisigAddress(pubkeys: string[], signatureCount: number, publicKeyCount: number): string {

        if (signatureCount < 1 || signatureCount > 6) {
            throw new Error("Invalid signatureCount.");
        }

        if (publicKeyCount < 3 || publicKeyCount > 10) {
            throw new Error("Invalid publicKeyCount.");
        }

        const hash = Multisig.getHash(pubkeys)

        const prefix = (signatureCount << 4) | (publicKeyCount & 0x0f);

        const versionBuffer = Buffer.from([prefix]);

        const addressBuffer = Buffer.concat([versionBuffer, hash]);

        const addressHash = crypto.Hash.sha256sha256(addressBuffer)

        const checksum = addressHash.subarray(0, 4)

        const addressWithChecksum = Buffer.concat([addressBuffer, checksum]);

        return base58.encode(addressWithChecksum);
    }

    static getSignatureAndPublicKeyCount(address: string): { signatureCount: number, publicKeyCount: number } {
        const buf = Buffer.from(base58.decode(address))

        const prefix = buf[0];

        const signatureCount = (prefix >> 4) & 0x0f;

        const publicKeyCount = prefix & 0x0f;

        return { signatureCount, publicKeyCount };
    };


    static getMultisigLockScript(address: string): string {
        const buf = Buffer.from(base58.decode(address))

        const { signatureCount, publicKeyCount } = Multisig.getSignatureAndPublicKeyCount(address);

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
            lockScriptPrefix = lockScriptPrefix + `OP_CAT `;
        }

        const multisigLockScript = `OP_${signatureCount} OP_SWAP ` + lockScriptPrefix + `OP_HASH160 ${hash} OP_EQUALVERIFY OP_${publicKeyCount} OP_CHECKMULTISIG`;

        return multisigLockScript;
    }

    private buildHoldScript(pubkey: string): Script {
        const publicKeyHash = crypto.Hash.sha256ripemd160(Buffer.from(pubkey, "hex")).toString('hex');
        return new Script('OP_DUP OP_HASH160' + ' 0x14 0x' + publicKeyHash + ' OP_EQUALVERIFY OP_CHECKSIG OP_RETURN 0x08 0x6d756c7469736967');
    }

    private buildTapeScript(address: string, pubkeys: string[]): Script {
        const data = {
            address,
            pubkeys
        };

        var dataHex = Buffer.from(JSON.stringify(data)).toString("hex");
        return Script.fromASM('OP_FALSE OP_RETURN ' + dataHex + ' 4d54617065');
    }

    async createMultisigWalletTransaction(address_from: string, pubkeys: string[], signatureCount: number, publicKeyCount: number, satoshis: number, privateKey: PrivateKey) {
        const address = Multisig.createMultisigAddress(pubkeys, signatureCount, publicKeyCount);

        const utxos = await this.selectUTXOs(address_from, satoshis);

        const tx = new Transaction();

        const lockScript = Multisig.getMultisigLockScript(address);

        for (let i = 0; i < utxos.length; i++) {
            tx.from(utxos[i])
        }

        tx.addOutput(new Transaction.Output({
            script: Script.fromASM(lockScript),
            satoshis
        }))

        for (let i = 0; i < publicKeyCount; i++) {
            tx.addOutput(new Transaction.Output({
                script: this.buildHoldScript(pubkeys[i]),
                satoshis: 100
            }));
        }

        tx.addOutput(new Transaction.Output({
            script: this.buildTapeScript(address, pubkeys),
            satoshis: 0
        }));

        tx.feePerKb(100)
            .change(address_from)
            .sign(privateKey)

        const raw = tx.uncheckedSerialize();
        return await this.broadcastTXraw(raw);
    }

    async createP2pkhToMultisigTransaction(fromAddress: string, toAddress: string, satoshis: number, privateKey: PrivateKey): Promise<String> {
        const utxos = await this.selectUTXOs(fromAddress, satoshis);

        const lockScript = Multisig.getMultisigLockScript(toAddress);

        const tx = new Transaction();

        for (let i = 0; i < utxos.length; i++) {
            tx.from(utxos[i])
        }

        tx.addOutput(new Transaction.Output({
            script: Script.fromASM(lockScript),
            satoshis
        }))
            .fee(500)
            .change(fromAddress)
            .sign(privateKey)

        const raw = tx.uncheckedSerialize();
        return await this.broadcastTXraw(raw);
    }

    async fromMultisigTransaction(fromAddress: string, toAddress: string, satoshis: number): Promise<MultiTxRaw> {
        const fromLockScript = Multisig.getMultisigLockScript(fromAddress);

        const umtxos = await this.selectUTMXOs(fromAddress, satoshis);

        let count = 0;
        let amounts: number[] = [];

        for (let i = 0; i < umtxos.length; i++) {
            count += umtxos[i].satoshis;
            amounts.push(umtxos[i].satoshis);
        }

        const tx = new Transaction();

        for (let i = 0; i < umtxos.length; i++) {
            tx.from(umtxos[i]);
        }

        tx.fee(500)

        if (toAddress.startsWith("1")) {
            tx.to(toAddress, satoshis)
                .addOutput(new Transaction.Output({
                    script: Script.fromASM(fromLockScript),
                    satoshis: count - satoshis - 500
                }))
        } else {
            const toLockScript = Multisig.getMultisigLockScript(toAddress);

            tx.addOutput(new Transaction.Output({
                script: Script.fromASM(toLockScript),
                satoshis: satoshis
            }))
                .addOutput(new Transaction.Output({
                    script: Script.fromASM(fromLockScript),
                    satoshis: count - satoshis - 500
                }))
        }
        const txraw = tx.uncheckedSerialize();

        return { txraw, amounts }
    }


    signfromMultisigTransaction(fromAddress: string, multiTxraw: MultiTxRaw, privateKey: PrivateKey): string[] {

        const fromLockScript = Multisig.getMultisigLockScript(fromAddress);
        const { txraw, amounts } = multiTxraw;

        const tx = new Transaction(txraw);

        for (let i = 0; i < amounts.length; i++) {
            tx.inputs[i].output = new Transaction.Output({ script: Script.fromASM(fromLockScript), satoshis: amounts[i] });
        }

        let sigs: string[] = []

        for (let i = 0; i < amounts.length; i++) {
            sigs[i] = <string>(tx.getSignature(i, privateKey));
        }

        return sigs;
    }

    async createFromMultisigTransaction(txraw: string, sigs: string[][], pubkeys: string): Promise<String> {

        const tx = new Transaction(txraw);

        for (let j = 0; j < sigs.length; j++) {
            tx.setInputScript({
                inputIndex: j
            }, tx => {

                let signature = "";
                for (let i = 0; i < sigs[j].length; i++) {
                    if (i < sigs[j].length - 1) {
                        signature = signature + sigs[j][i] + " ";
                    } else {
                        signature = signature + sigs[j][i];
                    }
                }

                const unlockingScript = Script.fromASM(`OP_0 ${signature} ${pubkeys}`);

                return unlockingScript;
            })
        }

        const raw = tx.uncheckedSerialize();

        return await this.broadcastTXraw(raw);
    }

    async fromMultisigMintFt(address_from: string, address_to: string): Promise<MultiTxRaw> {
        if (!this.ft) {
            throw new Error("FT is undefined!");
        }

        const name = this.ft.name;
        const symbol = this.ft.symbol;
        const decimal = this.ft.decimal;
        const totalSupply = this.ft.totalSupply * Math.pow(10, decimal);

        const amountbn = new crypto.BN(totalSupply.toString());
        const amountwriter = new encoding.BufferWriter();
        amountwriter.writeUInt64LEBN(amountbn);
        for (let i = 1; i < 6; i++) {
            amountwriter.writeUInt64LEBN(new crypto.BN(0));
        }
        const tapeAmount = amountwriter.toBuffer().toString('hex');

        const nameHex = Buffer.from(name, 'utf8').toString('hex');
        const symbolHex = Buffer.from(symbol, 'utf8').toString('hex');
        const decimalHex = decimal.toString(16).padStart(2, '0');

        const tape = Script.fromASM(`OP_FALSE OP_RETURN ${tapeAmount} ${decimalHex} ${nameHex} ${symbolHex} 4654617065`);

        const tapeSize = tape.toBuffer().length;

        const umtxo = await this.fetchUMTXO(address_from);

        let codeScript: Script;
        if (address_to.startsWith("1")) {
            codeScript = this.ft.getFTmintCode(umtxo.txId, umtxo.outputIndex, address_to, tapeSize);
        } else {
            const hash = crypto.Hash.sha256ripemd160(crypto.Hash.sha256(Script.fromASM(Multisig.getMultisigLockScript(address_to)).toBuffer())).toString("hex");
            codeScript = this.ft.getFTmintCode(umtxo.txId, umtxo.outputIndex, hash, tapeSize);
        }

        this.ft.codeScript = codeScript.toBuffer().toString('hex');
        this.ft.tapeScript = tape.toBuffer().toString('hex');

        const fromMultiLockScript = Multisig.getMultisigLockScript(address_from);

        const tx = new Transaction().from(umtxo)
            .fee(1000)
            .addOutput(new Transaction.Output({
                script: codeScript,
                satoshis: 2000
            }))
            .addOutput(new Transaction.Output({
                script: tape,
                satoshis: 0
            }))
            .addOutput(new Transaction.Output({
                script: Script.fromASM(fromMultiLockScript),
                satoshis: umtxo.satoshis - 3000
            }))

        const txraw = tx.uncheckedSerialize();
        return { txraw, amounts: [umtxo.satoshis] }
    }

    signfromMultisigMintFTTransaction(address_from: string, multiTxraw: MultiTxRaw, privateKey: PrivateKey): string[] {
        const { txraw, amounts } = multiTxraw;

        const fromMultiLockScript = Multisig.getMultisigLockScript(address_from);

        const tx = new Transaction(txraw)
        tx.inputs[0].output = new Transaction.Output({ script: Script.fromASM(fromMultiLockScript), satoshis: amounts[0] });


        let sigs: string[] = []

        sigs[0] = <string>(tx.getSignature(0, privateKey));

        return sigs;

    }

    async createFromMultisigMintFTTransaction(txraw: string, sigs: string[][], pubkeys: string): Promise<String> {
        if (!this.ft) {
            throw new Error("FT is undefined!");
        }

        const tx = new Transaction(txraw)
        // tx.inputs[0].output = new Transaction.Output({ script: Script.fromASM(fromMultiLockScript), satoshis: amounts[0] });

        tx.setInputScript({
            inputIndex: 0
        }, tx => {
            //@ts-ignore
            let signature = "";
            for (let i = 0; i < sigs[0].length; i++) {
                if (i < sigs[0].length - 1) {
                    signature = signature + sigs[0][i] + " ";
                }
                else {
                    signature = signature + sigs[0][i];
                }
            }

            const unlockingScript = Script.fromASM(`OP_0 ${signature} ${pubkeys}`);

            return unlockingScript;
        })

        const raw = tx.uncheckedSerialize();
        this.ft.contractTxid = tx.hash;

        return await this.broadcastTXraw(raw);
    }

    async p2pkhToMultiFtTransfer(privateKey_from: PrivateKey, address_to: string, amount: number): Promise<String> {
        if (!this.ft) {
            throw new Error("FT is undefined!");
        }
        const code = this.ft.codeScript;
        const tape = this.ft.tapeScript;
        const decimal = this.ft.decimal;
        const privateKey = privateKey_from;
        const tapeAmountSetIn: bigint[] = [];
        if (amount < 0) {
            throw new Error('Invalid amount');
        }
        const amountbn = BigInt(amount * Math.pow(10, decimal));

        const hash = crypto.Hash.sha256ripemd160(crypto.Hash.sha256(Script.fromASM(Multisig.getMultisigLockScript(address_to)).toBuffer())).toString("hex");

        // Fetch FT UTXO for the transfer
        const fttxo_1 = await this.fetchFtTXO(this.ft.contractTxid, privateKey.toAddress().toString(), amountbn);
        if (fttxo_1.ftBalance === undefined) {
            throw new Error('ftBalance is undefined');
        }
        tapeAmountSetIn.push(fttxo_1.ftBalance);

        // Calculate the total available balance
        let tapeAmountSum = BigInt(0);
        let tapeAmount = BigInt(0);
        for (let i = 0; i < tapeAmountSetIn.length; i++) {
            tapeAmount = BigInt(tapeAmountSetIn[i]);
            tapeAmountSum += tapeAmount;
        }

        // Validate the decimal and amount
        if (decimal > 18) {
            console.error('Error: The maximum value for decimal cannot exceed 18');
            throw new Error('The maximum value for decimal cannot exceed 18');
        }
        const maxAmount = Math.pow(10, 18 - decimal);
        if (amount > maxAmount) {
            console.error(`Error: When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
            throw new Error(`When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
        }

        // Check if the balance is sufficient
        if (amountbn > tapeAmountSum) {
            console.error('Error: Insufficient balance, please add more FT UTXOs');
            throw new Error('Insufficient balance, please add more FT UTXOs');
        }

        // Build the amount and change hex strings for the tape
        const { amountHex, changeHex } = this.ft.buildTapeAmount(amountbn, tapeAmountSetIn);

        // Fetch UTXO for the sender's address
        const utxo = await this.fetchUTXO(privateKey.toAddress().toString());

        // Construct the transaction
        const tx = new Transaction()
            .from(fttxo_1)
            .from(utxo);


        // Build the code script for the recipient
        const codeScript = this.ft.buildFTtransferCode(code, hash);
        tx.addOutput(new Transaction.Output({
            script: codeScript,
            satoshis: 2000
        }));

        const tapeScript = this.ft.buildFTtransferTape(tape, amountHex);
        tx.addOutput(new Transaction.Output({
            script: tapeScript,
            satoshis: 0
        }));

        if (amountbn < tapeAmountSum) {
            const changeCodeScript = this.ft.buildFTtransferCode(code, privateKey.toAddress().toString());
            tx.addOutput(new Transaction.Output({
                script: changeCodeScript,
                satoshis: 2000
            }));

            const changeTapeScript = this.ft.buildFTtransferTape(tape, changeHex);
            tx.addOutput(new Transaction.Output({
                script: changeTapeScript,
                satoshis: 0
            }));
        }

        tx.feePerKb(100)
            .change(privateKey.toAddress());

        await tx.setInputScriptAsync({
            inputIndex: 0,
        }, async (tx) => {
            const unlockingScript = await this.ft!.getFTunlock(privateKey, tx, 0, fttxo_1.txId, fttxo_1.outputIndex);
            return unlockingScript;
        });

        tx.sign(privateKey);
        await tx.sealAsync();
        const txraw = tx.uncheckedSerialize();
        return await this.broadcastTXraw(txraw);
    }

    async fromMultisigTransferFt(privateKey_from: PrivateKey, address_from: string, address_to: string, amount: number): Promise<MultiTxRaw> {
        if (!this.ft) {
            throw new Error("FT is undefined!");
        }
        const code = this.ft.codeScript;
        const tape = this.ft.tapeScript;
        const decimal = this.ft.decimal;
        const privateKey = privateKey_from;
        const tapeAmountSetIn: bigint[] = [];
        if (amount < 0) {
            throw new Error('Invalid amount');
        }
        const amountbn = BigInt(amount * Math.pow(10, decimal));

        const hash_from = crypto.Hash.sha256ripemd160(crypto.Hash.sha256(Script.fromASM(Multisig.getMultisigLockScript(address_from)).toBuffer())).toString("hex");

        const fttxo_1 = await this.fetchFtTXO(this.ft.contractTxid, hash_from, amountbn);
        if (fttxo_1.ftBalance === undefined) {
            throw new Error('ftBalance is undefined');
        }
        tapeAmountSetIn.push(fttxo_1.ftBalance);

        let tapeAmountSum = BigInt(0);
        let tapeAmount = BigInt(0);
        for (let i = 0; i < tapeAmountSetIn.length; i++) {
            tapeAmount = BigInt(tapeAmountSetIn[i]);
            tapeAmountSum += tapeAmount;
        }

        if (decimal > 18) {
            console.error('Error: The maximum value for decimal cannot exceed 18');
            throw new Error('The maximum value for decimal cannot exceed 18');
        }
        const maxAmount = Math.pow(10, 18 - decimal);
        if (amount > maxAmount) {
            console.error(`Error: When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
            throw new Error(`When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
        }

        if (amountbn > tapeAmountSum) {
            console.error('Error: Insufficient balance, please add more FT UTXOs');
            throw new Error('Insufficient balance, please add more FT UTXOs');
        }

        const { amountHex, changeHex } = this.ft.buildTapeAmount(amountbn, tapeAmountSetIn, 1);

        const umtxo = await this.fetchUMTXO(address_from);

        const fromMultiLockScript = Multisig.getMultisigLockScript(address_from);

        const tx = new Transaction()
            .from(umtxo)
            .from(fttxo_1);

        let codeScript: Script;
        if (address_to.startsWith("1")) {
            codeScript = this.ft.buildFTtransferCode(code, address_to);
        } else {
            const hash_to = crypto.Hash.sha256ripemd160(crypto.Hash.sha256(Script.fromASM(Multisig.getMultisigLockScript(address_to)).toBuffer())).toString("hex");
            codeScript = this.ft.buildFTtransferCode(code, hash_to);
        }

        const tapeScript = this.ft.buildFTtransferTape(tape, amountHex);

        tx.addOutput(new Transaction.Output({
            script: codeScript,
            satoshis: 2000
        })).addOutput(new Transaction.Output({
            script: tapeScript,
            satoshis: 0
        }));

        if (amountbn < tapeAmountSum) {
            const changeCodeScript = this.ft.buildFTtransferCode(code, hash_from);
            tx.addOutput(new Transaction.Output({
                script: changeCodeScript,
                satoshis: 2000
            }));

            const changeTapeScript = this.ft.buildFTtransferTape(tape, changeHex);
            tx.addOutput(new Transaction.Output({
                script: changeTapeScript,
                satoshis: 0
            }));
        }

        tx.fee(5000)
            .addOutput(new Transaction.Output({
                script: Script.fromASM(fromMultiLockScript),
                satoshis: umtxo.satoshis - 5000
            }));

        await tx.setInputScriptAsync({
            inputIndex: 1,
        }, async (tx) => {
            const unlockingScript = await this.ft!.getFTunlockSwap(privateKey, tx, 1, fttxo_1.txId, fttxo_1.outputIndex);
            return unlockingScript;
        });

        const txraw = tx.uncheckedSerialize();

        return { txraw, amounts: [umtxo.satoshis] }
    }

    signfromMultisigTransferFTTransaction(fromAddress: string, multiTxraw: MultiTxRaw, privateKey: PrivateKey): string[] {
        if (!this.ft) {
            throw new Error("FT is undefined!");
        }
        const fromMultiLockScript = Multisig.getMultisigLockScript(fromAddress);

        const hash_from = crypto.Hash.sha256ripemd160(crypto.Hash.sha256(Script.fromASM(Multisig.getMultisigLockScript(fromAddress)).toBuffer())).toString("hex");

        const fttxo_codeScript = this.ft.buildFTtransferCode(this.ft.codeScript, hash_from).toBuffer().toString('hex');

        const { txraw, amounts } = multiTxraw;

        const tx = new Transaction(txraw);

        tx.inputs[0].output = new Transaction.Output({ script: Script.fromASM(fromMultiLockScript), satoshis: amounts[0] });
        tx.inputs[1].output = new Transaction.Output({ script: Script.fromString(fttxo_codeScript), satoshis: 2000 });

        let sigs: string[] = []

        sigs[0] = <string>(tx.getSignature(0, privateKey));

        return sigs;

    }

    async createFromMultisigTransferFTTransaction(txraw: string, sigs: string[][], pubkeys: string): Promise<String> {
        if (!this.ft) {
            throw new Error("FT is undefined!");
        }

        const tx = new Transaction(txraw);

        tx.setInputScript({
            inputIndex: 0
        }, tx => {
            let signature = "";
            for (let i = 0; i < sigs[0].length; i++) {
                if (i < sigs[0].length - 1) {
                    signature = signature + sigs[0][i] + " ";
                }
                else {
                    signature = signature + sigs[0][i];
                }
            }

            const unlockingScript = Script.fromASM(`OP_0 ${signature} ${pubkeys}`);

            return unlockingScript;
        })

        return await this.broadcastTXraw(tx.uncheckedSerialize());
    }

}