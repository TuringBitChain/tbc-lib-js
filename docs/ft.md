```ts
import * as tbc from 'tbc-lib-js';
import * as partial_sha256 from 'tbc-lib-js/lib/util/partial-sha256';
const network = tbc.Networks.testnet;

const version = 10;
const vliolength = '10'; // Version + nLockTime + inputCount + outputCount (16 bytes)
const amountlength = '08'; // Length of the amount field (8 bytes)
const hashlength = '20'; // Length of the hash field (32 bytes)
interface FtInfo {
    contractTxid?: string;
    codeScript: string;
    tapeScript: string;
    totalSupply: number;
    decimal: number;
    name: string;
    symbol: string;
}

/**
 * Class representing a Fungible Token (FT) with methods for minting and transferring.
 */
export class FT {
    name: string;
    symbol: string;
    decimal: number;
    totalSupply: number;
    codeScript: string;
    tapeScript: string;
    contractTxid: string;

    /**
     * Constructs the FT instance either from a transaction ID or parameters.
     * @param txidOrParams - Either a contract transaction ID or token parameters.
     */
    constructor(txidOrParams?: string | { name: string, symbol: string, amount: number, decimal: number }) {
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
        } else if (txidOrParams) {
            // Initialize with new token parameters
            const { name, symbol, amount, decimal } = txidOrParams;

            // Validate the decimal value
            if (decimal > 18) {
                console.error('Error: The maximum value for decimal cannot exceed 18');
                throw new Error('The maximum value for decimal cannot exceed 18');
            }

            // Calculate the maximum allowable amount based on the decimal
            const maxAmount = Math.pow(10, 18 - decimal);
            if (amount > maxAmount) {
                console.error(`Error: When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
                throw new Error(`When decimal is ${decimal}, the maximum amount cannot exceed ${maxAmount}`);
            }

            this.name = name;
            this.symbol = symbol;
            this.decimal = decimal;
            this.totalSupply = amount;
        } else {
            throw new Error('Invalid constructor arguments');
        }
    }

    /**
     * Initializes the FT instance by fetching the FTINFO.
     */
    async initialize() {
        const ftInfo = await this.fetchFtInfo(this.contractTxid);
        this.name = ftInfo.name;
        this.symbol = ftInfo.symbol;
        this.decimal = ftInfo.decimal;
        this.totalSupply = ftInfo.totalSupply;
        this.codeScript = ftInfo.codeScript;
        this.tapeScript = ftInfo.tapeScript;
    }

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
        const factor = new BigNumber(Math.pow(10, decimal));
        const totalSupply = BigInt(new BigNumber(this.totalSupply).multipliedBy(new BigNumber(factor)).decimalPlaces(0));
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
        const factor = new BigNumber(Math.pow(10, decimal));
        const amountbn = BigInt(new BigNumber(amount).multipliedBy(new BigNumber(factor)).decimalPlaces(0));

        // Fetch FT UTXO for the transfer
        const ftutxos = await this.fetchFtUTXOs(this.contractTxid, privateKey.toAddress().toString(), amountbn);
        let tapeAmountSum = BigInt(0);
        for (let i = 0; i < ftutxos.length; i++) {
            tapeAmountSetIn.push(ftutxos[i].ftBalance!);
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
            .from(ftutxos)
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
        for (let i = 0; i < ftutxos.length; i++) {
            await tx.setInputScriptAsync({
                inputIndex: i,
            }, async (tx) => {
                const unlockingScript = await this.getFTunlock(privateKey, tx, i, ftutxos[i].txId, ftutxos[i].outputIndex);
                return unlockingScript;
            });
        }
        tx.sign(privateKey);
        await tx.sealAsync();
        const txraw = tx.uncheckedSerialize();
        return txraw;
    }

    /**
     * Fetches the raw transaction data for a given transaction ID.
     * @param txid - The transaction ID to fetch.
     * @returns The transaction object.
     */
    async fetchTXraw(txid: string): Promise<tbc.Transaction> {
        const url_testnet = `https://tbcdev.org/v1/tbc/main/tx/hex/${txid}`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/tx/hex/${txid}`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
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
            console.error("Error fetching TXraw:", error);
            throw new Error("Failed to fetch TXraw.");
        }
    }

    /**
     * Broadcasts the raw transaction to the network.
     * @param txraw - The raw transaction hex.
     * @returns The response from the broadcast API.
     */
    async broadcastTXraw(txraw: string): Promise<string> {
        const url_testnet = 'https://tbcdev.org/v1/tbc/main/broadcast/tx/raw';
        const url_mainnet = 'https://turingwallet.xyz/v1/tbc/main/broadcast/tx/raw';
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
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
            console.error("Error broadcasting TXraw:", error);
            throw new Error("Failed to broadcast TXraw.");
        }
    }

    /**
     * Fetches an FT UTXO that satisfies the required amount.
     * @param contractTxid - The contract transaction ID.
     * @param addressOrHash - The recipient's address or hash.
     * @param amount - The required amount.
     * @returns The FT UTXO that meets the amount requirement.
     */
    async fetchFtTXO(contractTxid: string, addressOrHash: any, amount: bigint): Promise<tbc.Transaction.IUnspentOutput> {
        let hash = '';
        if (tbc.Address.isValid(addressOrHash)) {
            // If the recipient is an address
            const publicKeyHash = tbc.Address.fromString(addressOrHash).hashBuffer.toString('hex');
            hash = publicKeyHash + '00';
        } else {
            // If the recipient is a hash
            if (addressOrHash.length !== 40) {
                throw new Error('Invalid address or hash');
            }
            hash = addressOrHash + '01';
        }
        const url_testnet = `https://tbcdev.org/v1/tbc/main/ft/utxo/combine/script/${hash}/contract/${contractTxid}`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/utxo/combine/script/${hash}/contract/${contractTxid}`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch from URL: ${url}, status: ${response.status}`);
            }
            const responseData = await response.json();
            let data = responseData.ftUtxoList[0];
            for (let i = 0; i < responseData.ftUtxoList.length; i++) {
                if (responseData.ftUtxoList[i].ftBalance >= amount) {
                    data = responseData.ftUtxoList[i];
                    break;
                }
            }
            const fttxo_codeScript = this.buildFTtransferCode(this.codeScript, addressOrHash).toBuffer().toString('hex');
            const fttxo: tbc.Transaction.IUnspentOutput = {
                txId: data.utxoId,
                outputIndex: data.utxoVout,
                script: fttxo_codeScript,
                satoshis: data.utxoBalance,
                ftBalance: data.ftBalance
            }
            return fttxo;
        } catch (error) {
            throw new Error("Failed to fetch FTTXO.");
        }
    }

    async fetchFtUTXOs(contractTxid: string, addressOrHash: any, amount: bigint): Promise<tbc.Transaction.IUnspentOutput[]> {
        interface FTUnspentOutput {
            utxoId: string;
            utxoVout: number;
            utxoBalance: number;
            ftContractId: string;
            ftBalance: bigint;
        }
        let hash = '';
        if (tbc.Address.isValid(addressOrHash)) {
            // If the recipient is an address
            const publicKeyHash = tbc.Address.fromString(addressOrHash).hashBuffer.toString('hex');
            hash = publicKeyHash + '00';
        } else {
            // If the recipient is a hash
            if (addressOrHash.length !== 40) {
                throw new Error('Invalid address or hash');
            }
            hash = addressOrHash + '01';
        }
        const url_testnet = `https://tbcdev.org/v1/tbc/main/ft/utxo/combine/script/${hash}/contract/${contractTxid}`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/utxo/combine/script/${hash}/contract/${contractTxid}`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch from URL: ${url}, status: ${response.status}`);
            }
            const codeScript = this.buildFTtransferCode(this.codeScript, addressOrHash).toBuffer().toString('hex');
            const responseData = await response.json();
            let sortedData: FTUnspentOutput[] = responseData.ftUtxoList.sort((a: FTUnspentOutput, b: FTUnspentOutput) => b.ftBalance - a.ftBalance);
            let sumBalance = BigInt(0);
            let ftutxos: tbc.Transaction.IUnspentOutput[] = [];
            for (let i = 0; i < sortedData.length && i < 5; i++) {
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
            if (sumBalance < amount) {
                const totalBalance = await FT.getFTbalance(contractTxid, addressOrHash);
                if (totalBalance >= amount) {
                    throw new Error('Insufficient FTbalance, please merge FT UTXOs');
                }
            }
            return ftutxos;
        } catch (error) {
            console.log(error);
            throw new Error("Failed to fetch FTUTXO.");
        }
    }

    /**
     * Fetches the FT information for a given contract transaction ID.
     *
     * @param {string} contractTxid - The contract transaction ID.
     * @returns {Promise<FtInfo>} Returns a Promise that resolves to an FtInfo object containing the FT information.
     * @throws {Error} Throws an error if the request to fetch FT information fails.
     */
    async fetchFtInfo(contractTxid: string): Promise<FtInfo> {
        const url_testnet = `https://tbcdev.org/v1/tbc/main/ft/info/contract/id/${contractTxid}`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/info/contract/id/${contractTxid}`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch from URL: ${url}, status: ${response.status}`);
            }
            const data = await response.json();
            const ftInfo: FtInfo = {
                codeScript: data.ftCodeScript,
                tapeScript: data.ftTapeScript,
                totalSupply: data.ftSupply,
                decimal: data.ftDecimal,
                name: data.ftName,
                symbol: data.ftSymbol
            }
            return ftInfo;
        } catch (error) {
            throw new Error("Failed to fetch FtInfo.");
        }
    }

    /**
     * Merges FT UTXOs.
     *
     * @param {tbc.PrivateKey} privateKey_from - The private key object.
     * @returns {Promise<boolean>} Returns a Promise that resolves to a boolean indicating whether the merge was successful.
     * @throws {Error} Throws an error if the merge fails.
     */
    async mergeFT(privateKey_from: tbc.PrivateKey): Promise<boolean> {
        const privateKey = privateKey_from;
        const address = privateKey.toAddress().toString();
        const contractTxid = this.contractTxid;
        const url_testnet = `https://tbcdev.org/v1/tbc/main/ft/utxo/address/${address}/contract/${contractTxid}`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/utxo/address/${address}/contract/${contractTxid}`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
        const fttxo_codeScript = this.buildFTtransferCode(this.codeScript, address).toBuffer().toString('hex');
        try {
            const utxo = await this.fetchUTXO(address);
            const response = await (await fetch(url)).json();
            let fttxo: tbc.Transaction.IUnspentOutput[] = [];
            if (response.ftUtxoList.length === 0) {
                throw new Error('No FT UTXO available');
            }
            if (response.ftUtxoList.length === 1) {
                console.log('Merge Success!');
                return true;
            } else {
                for (let i = 0; i < response.ftUtxoList.length && i < 5; i++) {
                    fttxo.push({
                        txId: response.ftUtxoList[i].utxoId,
                        outputIndex: response.ftUtxoList[i].utxoVout,
                        script: fttxo_codeScript,
                        satoshis: response.ftUtxoList[i].utxoBalance,
                        ftBalance: response.ftUtxoList[i].ftBalance
                    });
                }
            }
            const tapeAmountSetIn: bigint[] = [];
            let tapeAmountSum = BigInt(0);
            for (let i = 0; i < fttxo.length; i++) {
                tapeAmountSetIn.push(fttxo[i].ftBalance!);
                tapeAmountSum += BigInt(fttxo[i].ftBalance!);
            }
            const { amountHex, changeHex } = this.buildTapeAmount(tapeAmountSum, tapeAmountSetIn);
            if (changeHex != '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000') {
                throw new Error('Change amount is not zero');
            }
            
            const tx = new tbc.Transaction()
                .from(fttxo)
                .from(utxo);
            const codeScript = this.buildFTtransferCode(this.codeScript, address);
            tx.addOutput(new tbc.Transaction.Output({
                script: codeScript,
                satoshis: 2000
            }));
            const tapeScript = this.buildFTtransferTape(this.tapeScript, amountHex);
            tx.addOutput(new tbc.Transaction.Output({
                script: tapeScript,
                satoshis: 0
            }));
            tx.feePerKb(100)
            .change(privateKey.toAddress());
            for (let i = 0; i < fttxo.length; i++) {
                await tx.setInputScriptAsync({
                    inputIndex: i,
                }, async (tx) => {
                    const unlockingScript = await this.getFTunlock(privateKey, tx, i, fttxo[i].txId, fttxo[i].outputIndex);
                    return unlockingScript;
                });
            }
            tx.sign(privateKey);
            await tx.sealAsync();
            const txraw = tx.uncheckedSerialize();
            console.log('Merge FTUTXO:');
            await this.broadcastTXraw(txraw);
            // wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.mergeFT(privateKey);
            return true;
        } catch (error) {
            throw new Error("Merge Faild!.");
        }
    }

    /**
     * Get the FT balance for a specified contract transaction ID and address or hash.
     *
     * @param {string} contractTxid - The contract transaction ID.
     * @param {string} addressOrHash - The address or hash.
     * @returns {Promise<number>} Returns a Promise that resolves to the FT balance.
     * @throws {Error} Throws an error if the address or hash is invalid, or if the request fails.
     */
    static async getFTbalance(contractTxid: string, addressOrHash: any): Promise<number> {
        let hash = '';
        if (tbc.Address.isValid(addressOrHash)) {
            // If the recipient is an address
            const publicKeyHash = tbc.Address.fromString(addressOrHash).hashBuffer.toString('hex');
            hash = publicKeyHash + '00';
        } else {
            // If the recipient is a hash
            if (addressOrHash.length !== 40) {
                throw new Error('Invalid address or hash');
            }
            hash = addressOrHash + '01';
        }
        const url_testnet = `https://tbcdev.org/v1/tbc/main/ft/balance/combine/script/${hash}/contract/${contractTxid}`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/ft/balance/combine/script/${hash}/contract/${contractTxid}`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
        try {
            const response = await (await fetch(url)).json();
            const ftBalance = response.ftBalance;
            return ftBalance;
        } catch (error) {
            throw new Error("Failed to get ftBalance.");
        }
    }

    /**
     * Fetches a UTXO for the given address with sufficient balance.
     * @param address - The address to search for UTXOs.
     * @returns The UTXO with sufficient balance.
     */
    async fetchUTXO(address: any): Promise<tbc.Transaction.IUnspentOutput> {
        const url_testnet = `https://tbcdev.org/v1/tbc/main/address/${address}/unspent/`;
        const url_mainnet = `https://turingwallet.xyz/v1/tbc/main/address/${address}/unspent/`;
        let url = url_testnet;
        if (network === tbc.Networks.testnet) {
            url = url_testnet
        } else if (network === tbc.Networks.mainnet) {
            url = url_mainnet
        }
        const scriptPubKey = tbc.Script.buildPublicKeyHashOut(address).toBuffer().toString('hex');
        try {
            const response = await (await fetch(url)).json();
            let data = response[0];
            // Select a UTXO with value greater than 5000
            for (let i = 0; i < response.length; i++) {
                if (response[i].value > 5000) {
                    data = response[i];
                    break;
                }
            }
            if (data.value < 5000) {
                console.error('Error: UTXO value is less than 5000');
                throw new Error('UTXO value is less than 5000');
            }
            const utxo: tbc.Transaction.IUnspentOutput = {
                txId: data.tx_hash,
                outputIndex: data.tx_pos,
                script: scriptPubKey,
                satoshis: data.value
            }
            return utxo;
        } catch (error) {
            throw new Error("Failed to fetch UTXO.");
        }
    }

    /**
     * Builds the code script for transferring FT to a new address or hash.
     * @param code - The original code script in hex.
     * @param addressOrHash - The recipient's address or hash.
     * @returns The new code script as a tbc.Script object.
     */
    buildFTtransferCode(code: string, addressOrHash: string): tbc.Script {
        if (tbc.Address.isValid(addressOrHash)) {
            // If the recipient is an address
            const publicKeyHashBuffer = tbc.Address.fromString(addressOrHash).hashBuffer;
            const hashBuffer = Buffer.concat([publicKeyHashBuffer, Buffer.from([0x00])]);
            const codeBuffer = Buffer.from(code, 'hex');
            hashBuffer.copy(codeBuffer, 1537, 0, 21); // Replace the hash in the code script
            const codeScript = new tbc.Script(codeBuffer.toString('hex'));
            return codeScript;
        } else {
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
    buildFTtransferTape(tape: string, amountHex: string): tbc.Script {
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
    buildTapeAmount(amountBN: bigint, tapeAmountSet: bigint[], ftInputIndex?: number) {
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
            if (amountBN <= BigInt(0)) {
                break;
            }
            if (tapeAmountSet[i] < amountBN) {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(tapeAmountSet[i].toString()));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN(0));
                amountBN -= BigInt(tapeAmountSet[i]);
            } else {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(amountBN.toString()));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN((BigInt(tapeAmountSet[i]) - amountBN).toString()));
                amountBN = BigInt(0);
            }
        }
        // Fill the remaining slots with zeros or remaining amounts
        for (j += i; i < 6 && j < 6; i++, j++) {
            if (tapeAmountSet[i]) {
                amountwriter.writeUInt64LEBN(new tbc.crypto.BN(0));
                changewriter.writeUInt64LEBN(new tbc.crypto.BN(tapeAmountSet[i].toString()));
            } else {
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
    async getFTunlock(privateKey_from: tbc.PrivateKey, currentTX: tbc.Transaction, currentUnlockIndex: number, preTxId: string, preVout: number): Promise<tbc.Script> {
        const privateKey = privateKey_from;
        const preTX = await this.fetchTXraw(preTxId);
        const pretxdata = getPreTxdata(preTX, preVout);

        // Retrieve and process the tape data from the previous transaction
        const preTXtape = preTX.outputs[preVout + 1].script.toBuffer().subarray(3, 51).toString('hex');
        let prepretxdata = '';
        for (let i = preTXtape.length - 16; i >= 0; i -= 16) {
            const chunk = preTXtape.substring(i, i + 16);
            if (chunk != '0000000000000000') {
                const inputIndex = i / 16;
                const prepreTX = await this.fetchTXraw(preTX.inputs[inputIndex].prevTxId.toString('hex'));
                prepretxdata = prepretxdata + getPrePreTxdata(prepreTX, preTX.inputs[inputIndex].outputIndex);
            }
        }
        prepretxdata = '57' + prepretxdata;

        const currenttxdata = getCurrentTxdata(currentTX, currentUnlockIndex);
        const sig = (currentTX.getSignature(currentUnlockIndex, privateKey).length / 2).toString(16).padStart(2, '0') + currentTX.getSignature(currentUnlockIndex, privateKey);
        const publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') + privateKey.toPublicKey().toString();
        const unlockingScript = new tbc.Script(`${currenttxdata}${prepretxdata}${sig}${publicKey}${pretxdata}`);
        return unlockingScript;
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
    async getFTunlockSwap(privateKey_from: tbc.PrivateKey, currentTX: tbc.Transaction, currentUnlockIndex: number, preTxId: string, preVout: number): Promise<tbc.Script> {
        const privateKey = privateKey_from;
        const contractTX = await this.fetchTXraw(currentTX.inputs[0].prevTxId.toString('hex'));
        const contracttxdata = getContractTxdata(contractTX, currentTX.inputs[0].outputIndex);
        const preTX = await this.fetchTXraw(preTxId);
        const pretxdata = getPreTxdata(preTX, preVout);

        const preTXtape = preTX.outputs[preVout + 1].script.toBuffer().subarray(3, 51).toString('hex');
        var prepretxdata = '';
        for (let i = preTXtape.length - 16; i >= 0; i -= 16) {
            const chunk = preTXtape.substring(i, i + 16);
            if (chunk != '0000000000000000') {
                const inputIndex = i / 16;
                const prepreTX = await this.fetchTXraw(preTX.inputs[inputIndex].prevTxId.toString('hex'));
                prepretxdata = prepretxdata + getPrePreTxdata(prepreTX, preTX.inputs[inputIndex].outputIndex);
            }
        }
        prepretxdata = '57' + prepretxdata;

        const currentinputsdata = getCurrentInputsdata(currentTX);
        const currenttxdata = getCurrentTxdata(currentTX, currentUnlockIndex);
        const sig = (currentTX.getSignature(currentUnlockIndex, privateKey).length / 2).toString(16).padStart(2, '0') + currentTX.getSignature(currentUnlockIndex, privateKey);
        const publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') + privateKey.toPublicKey().toString();
        const unlockingScript = new tbc.Script(`${currenttxdata}${prepretxdata}${sig}${publicKey}${currentinputsdata}${contracttxdata}${pretxdata}`);
        return unlockingScript;
    }

    /**
     * Builds the code script for minting FT tokens.
     * @param txid - The transaction ID of the UTXO used for minting.
     * @param vout - The output index of the UTXO.
     * @param address - The recipient's address.
     * @param tapeSize - The size of the tape script.
     * @returns The code script as a tbc.Script object.
     */
    private getFTmintCode(txid: string, vout: number, address: any, tapeSize: number): tbc.Script {
        const writer = new tbc.encoding.BufferWriter();
        writer.writeReverse(Buffer.from(txid, 'hex'));
        writer.writeUInt32LE(vout);
        const utxoHex = writer.toBuffer().toString('hex');

        const publicKeyHash = tbc.Address.fromString(address).hashBuffer.toString('hex');
        const hash = publicKeyHash + '00';

        const tapeSizeHex = getSize(tapeSize).toString('hex');

        // The codeScript is constructed with specific opcodes and parameters for FT minting
        const codeScript = new tbc.Script(`OP_9 OP_PICK OP_TOALTSTACK OP_1 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_5 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_4 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_3 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_2 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_1 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_SWAP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_DUP OP_0 0x01 0x28 OP_MUL OP_SPLIT 0x01 0x28 OP_SPLIT OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_ENDIF OP_ADD OP_FROMALTSTACK OP_DROP OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_FROMALTSTACK OP_CAT OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_3 OP_PICK OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_TOALTSTACK OP_SHA256 OP_FROMALTSTACK OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_6 OP_PUSH_META 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_FROMALTSTACK OP_1 OP_SPLIT OP_NIP 0x01 0x14 OP_SPLIT OP_1 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_IF OP_DROP OP_1 OP_PICK OP_HASH160 OP_EQUALVERIFY OP_CHECKSIGVERIFY OP_ELSE OP_1 OP_EQUALVERIFY OP_2 OP_PICK OP_HASH160 OP_EQUALVERIFY OP_TOALTSTACK OP_CAT OP_FROMALTSTACK OP_CAT OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_OVER 0x01 0x20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_SHA256 OP_5 OP_PUSH_META OP_EQUALVERIFY OP_CHECKSIGVERIFY OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x24 OP_SPLIT OP_DROP OP_DUP OP_TOALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUAL OP_IF OP_FROMALTSTACK OP_DROP OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_FROMALTSTACK 0x24 0x${utxoHex} OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_2 OP_PICK OP_2 OP_PICK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_PARTIAL_HASH OP_CAT OP_CAT OP_FROMALTSTACK OP_CAT OP_SHA256 OP_CAT OP_CAT OP_CAT OP_SHA256 OP_SHA256 OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_FROMALTSTACK OP_FROMALTSTACK 0x01 0x20 OP_SPLIT OP_DROP OP_5 OP_ROLL OP_EQUALVERIFY OP_2SWAP OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_0 OP_EQUALVERIFY OP_7 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_SWAP OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_IF OP_DROP OP_DUP OP_SIZE OP_DUP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUALVERIFY OP_3 OP_SPLIT OP_SWAP OP_DROP OP_FROMALTSTACK OP_DUP OP_8 OP_MUL OP_2 OP_ROLL OP_SWAP OP_SPLIT OP_8 OP_SPLIT OP_DROP OP_BIN2NUM OP_DUP OP_0 OP_EQUAL OP_NOTIF OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_9 OP_PICK OP_9 OP_PICK OP_CAT OP_EQUALVERIFY OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_FROMALTSTACK OP_SWAP OP_SUB OP_TOALTSTACK OP_DROP OP_TOALTSTACK OP_SHA256 OP_CAT OP_TOALTSTACK OP_PARTIAL_HASH OP_FROMALTSTACK OP_CAT OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ELSE OP_DROP 0x01 0x${tapeSizeHex} OP_EQUAL OP_IF OP_2 OP_PICK OP_SIZE OP_5 OP_SUB OP_SPLIT 0x05 0x4654617065 OP_EQUAL OP_0 OP_EQUALVERIFY OP_DROP OP_ENDIF OP_PARTIAL_HASH OP_CAT OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_FROMALTSTACK OP_CAT OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_TOALTSTACK OP_ENDIF OP_ENDIF OP_DUP OP_2 OP_EQUAL OP_0 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_0 OP_EQUALVERIFY OP_DROP OP_1 OP_EQUALVERIFY OP_FROMALTSTACK OP_FROMALTSTACK OP_SHA256 OP_7 OP_PUSH_META OP_EQUAL OP_NIP 0x21 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff OP_DROP OP_RETURN 0x15 0x${hash} 0x05 0x32436f6465`);
        return codeScript;
    }

}

/**
 * Retrieves the transaction data needed for contract operations.
 * @param tx - The transaction object.
 * @returns The transaction data as a hex string.
 */
export function getContractTxdata(tx: tbc.Transaction, vout: number): string {
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
    writer.write(Buffer.from(amountlength, 'hex'));
    writer.writeUInt64LEBN(tx.outputs[vout].satoshisBN);
    writer.write(Buffer.from(hashlength, 'hex'));
    writer.write(tbc.crypto.Hash.sha256(tx.outputs[vout].script.toBuffer()));
    writer.write(Buffer.from(outputs2length, 'hex'));
    writer.write(Buffer.from(outputs2, 'hex'));

    const contracttxdata = writer.toBuffer().toString('hex');
    return `${contracttxdata}`;
}

/**
 * Retrieves the inputs data from the current transaction.
 * @param tx - The transaction object.
 * @returns The inputs data as a hex string.
 */
export function getCurrentInputsdata(tx: tbc.Transaction): string {
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
    return `${currentinputsdata}`
}

/**
 * Retrieves the current transaction data needed for unlocking scripts.
 * @param tx - The transaction object.
 * @param inputIndex - The index of the input being unlocked.
 * @returns The transaction data as a hex string.
 */
export function getCurrentTxdata(tx: tbc.Transaction, inputIndex: number): string {
    const endTag = '51';
    const writer = new tbc.encoding.BufferWriter();

    for (let i = 0; i < tx.outputs.length; i++) {
        const lockingscript = tx.outputs[i].script.toBuffer();

        if (lockingscript.length == 1564) {
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
        } else {
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
    const inputIndexMap: { [key: number]: string } = {
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
export function getPreTxdata(tx: tbc.Transaction, vout: number): string {
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
export function getPrePreTxdata(tx: tbc.Transaction, vout: number): string {
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
    if (lockingscript.length == 1564) {
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
    } else {
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
function getPrePreOutputsData(tx: tbc.Transaction, vout: number) {
    let outputs1 = ''; // Outputs before the specified index
    let outputs1length = '';
    let outputs2 = ''; // Outputs after the specified index
    let outputs2length = '';

    if (vout === 0) {
        outputs1 = '00';
        outputs1length = '';
    } else {
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
    } else {
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
function getPreOutputsData(tx: tbc.Transaction, vout: number) {
    let outputs1 = ''; // Outputs before the specified index
    let outputs1length = '';
    let outputs2 = ''; // Outputs after the specified index
    let outputs2length = '';

    if (vout === 0) {
        outputs1 = '00';
        outputs1length = '';
    } else {
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
    } else {
        outputs2length = getLengthHex(outputs2.length / 2).toString('hex');
    }

    return { outputs1, outputs1length, outputs2, outputs2length };
}

/**
 * Calculates the length of data and adds OP_PUSHDATA1 or OP_PUSHDATA2 if necessary.
 * @param length - The length of the data.
 * @returns A buffer representing the length with appropriate push opcode.
 */
function getLengthHex(length: number): Buffer {
    if (length < 76) {
        return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
    } else if (length > 75 && length < 256) {
        return Buffer.concat([Buffer.from('4c', 'hex'), Buffer.from(length.toString(16), 'hex')]);
    } else {
        return Buffer.concat([Buffer.from('4d', 'hex'), Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse()]);
    }
}

/**
 * Converts the size of data to a little-endian buffer.
 * @param length - The length of the data.
 * @returns A buffer representing the size in little-endian format.
 */
export function getSize(length: number): Buffer {
    if (length < 256) {
        return Buffer.from(length.toString(16).padStart(2, '0'), 'hex');
    } else {
        return Buffer.from(length.toString(16).padStart(4, '0'), 'hex').reverse();
    }
}

```