```ts
/**
     * Mints a new FT and returns the raw transaction hex.
     * @param privateKey_from - The private key of the sender.
     * @param address_to - The recipient's address.
     * @returns The raw transaction hex string.
     */
    async MintFT(privateKey_from: tbc.PrivateKey, address_to: any): Promise<string> {
        const name = this.name;
        const symbol = this.symbol;
        const decimal = this.decimal;
        const totalSupply = BigInt(this.totalSupply * Math.pow(10, decimal));
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
        //console.log('tape:', tape.toBuffer().toString('hex'));
        const tapeSize = tape.toBuffer().length;

        // Fetch UTXO for the private key's address
        const utxo = await this.fetchUTXO(privateKey.toAddress().toString());

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

        const txraw = tx.uncheckedSerialize();
        this.contractTxid = tx.hash;
        return txraw;
    }

    /**
     * Transfers FT tokens to another address and returns the raw transaction hex.
     * @param privateKey_from - The private key of the sender.
     * @param address_to - The recipient's address.
     * @param amount - The amount to transfer.
     * @returns The raw transaction hex string.
     */
    async transfer(privateKey_from: tbc.PrivateKey, address_to: string, amount: number): Promise<string> {
        const code = this.codeScript;
        const tape = this.tapeScript;
        const decimal = this.decimal;
        const privateKey = privateKey_from;
        const tapeAmountSetIn: bigint[] = [];
        if (amount < 0) {
            throw new Error('Invalid amount');
        }
        const amountbn = BigInt(amount * Math.pow(10, decimal));

        // Fetch FT UTXO for the transfer
        const fttxo_1 = await this.fetchFtTXO(this.contractTxid, privateKey.toAddress().toString(), amountbn);
        if (fttxo_1.ftBalance === undefined) {
            throw new Error('ftBalance is undefined');
        }
        tapeAmountSetIn.push(fttxo_1.ftBalance);

        // Calculate the total available balance
        let tapeAmountSum = BigInt(0);
        for (let i = 0; i < tapeAmountSetIn.length; i++) {
            tapeAmountSum += BigInt(tapeAmountSetIn[i]);
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
        const { amountHex, changeHex } = this.buildTapeAmount(amountbn, tapeAmountSetIn);

        // Fetch UTXO for the sender's address
        const utxo = await this.fetchUTXO(privateKey.toAddress().toString());

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
        tx.change(privateKey.toAddress());

        // Set the input script asynchronously for the FT UTXO
        await tx.setInputScriptAsync({
            inputIndex: 0,
        }, async (tx) => {
            const unlockingScript = await this.getFTunlock(privateKey, tx, 0, fttxo_1.txId, fttxo_1.outputIndex);
            return unlockingScript;
        });

        tx.sign(privateKey);
        await tx.sealAsync();
        const txraw = tx.uncheckedSerialize();
        return txraw;
    }
```