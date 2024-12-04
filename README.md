tbc
===

Javascript Turing BC library.

To get started, just `npm install tbc-lib-js`.

Please see ./doc for documents details.


A transaction construct demo program:
```
const Transaction = require('tbc-lib-js/lib/transaction/transaction');
const PrivateKey = require('tbc-lib-js/lib/privatekey');
const Address = require('tbc-lib-js/lib/address');
const Script = require('tbc-lib-js/lib/script');
const Signature = require('tbc-lib-js/lib/crypto/signature');  // Import the Signature module
const Mnemonic = require('tbc-lib-js/lib/mnemonic/mnemonic');
const PublicKey = require('tbc-lib-js/lib/publickey');

// generate mnemonic
//const mnemonic = new Mnemonic();
const mnemonic = Mnemonic.fromString(
    "word word word word word word word word word word word word",
    Mnemonic.Words.ENGLISH
);

// get HDPrivateKey from mnemonic
const HDPrivateKey = mnemonic.toHDPrivateKey('','mainnet');

// create private key from seed with compressed format
// will sign the transaction with this private key
const DerivationPath = "m/44'/236'/0'/1/0";
const derivedHDPrivateKey =HDPrivateKey.deriveChild(DerivationPath);
const privateKey = derivedHDPrivateKey.privateKey;

// get public key from private key
const publicKey = privateKey.toPublicKey();

// get WIF private key
const wif = privateKey.toWIF();

// get address from private key
const address = privateKey.toAddress();

// print results
console.log('private key:', privateKey.toString());
console.log('public key:', publicKey.toString());
console.log('WIF private key (compressed):', wif);
console.log('mnemonic:', mnemonic.phrase);
console.log('address:', address.toString());



// Create a new transaction
const transaction = new Transaction();

// Add the first input
const utxo1 = {
    txId: '<txid>',
    outputIndex: 0,
    script: '<lockingScript>',
    satoshis: 50000000
};
transaction.from(utxo1);

//Add the second input
// const utxo2 = {
//     txId: '<txid>',
//     outputIndex: 1,
//     script: '<lockingScript>',
//     satoshis: 50000000
// };
// transaction.from(utxo2);

// Set the output
const toAddress = new Address('1Jb...');
const amount = 40000000;
transaction.to(toAddress, amount);

// Set the change address
const changeAddress = new Address('1B2...');
transaction.change(changeAddress);

// Set the fee
const fee = 1000;
transaction.fee(fee);

// Explicitly sign each input
transaction.sign(privatekey, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);
//transaction.sign(privateKey2, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);


// Serialize the transaction
const serializedTransaction = transaction.serialize();
console.log('Serialized Transaction:', serializedTransaction);


```

Create FT
===
# FT Issuance on Turing Blockchain using `tbc-lib-js`

This document provides a step-by-step guide for issuing an FT (Fungible Token) on the Turing blockchain using the `tbc-lib-js` library. The guide is beginner-friendly and covers key concepts such as setting up a wallet, creating a transaction, and issuing an FT.

To get started, install the library using the following command:`(Note:Download the @types/node package corresponding to your Node.js)`

```bash
npm i tbc-lib-js
npm i --save-dev @types/node
```
FT Issuance Program
The following program demonstrates how to issue an FT using a UTXO (Unspent Transaction Output) on the Turing blockchain. It includes creating a new transaction, adding inputs and outputs, signing the transaction, and retrieving the serialized transaction hex.
```ts
import * as tbc from 'tbc-lib-js';
import { FT } from 'tbc-lib-js'

/**
 * Step 1: Set up the wallet private key and address.
 * This private key will be used to sign the transaction.
 */
const privateKeyA = tbc.PrivateKey.fromString('L1u2TmR7hMMMSV9Bx2Lyt3sujbboqEFqnKygnPRnQERhKB4qptuK');
const publicKeyA = tbc.PublicKey.fromPrivateKey(privateKeyA);
const addressA = tbc.Address.fromPrivateKey(privateKeyA).toString();

const addressB = '1FhSD1YezTXbdRGWzNbNvUj6qeKQ6gZDMq'

/**
 * Step 2: Define token parameters.
 */
const ftName = 'test_usdt';
const ftSymbol = 'test_usdt';
const ftDecimal = 6; 
const ftAmount = 210000000;

async function main() {
    try {

       /**
        * Step 3: Create a new token instance.
        */
        const newToken = new FT({
            name: ftName,
            symbol: ftSymbol,
            amount: ftAmount,
            decimal: ftDecimal
        });

       /**
        * Step 4: Mint new tokens and broadcast the transaction.
        */
        const mintTX = await newToken.MintFT(privateKeyA, addressA); // Step 4.1: Create mint transaction
        await newToken.broadcastTXraw(mintTX); // Step 4.2: Broadcast mint transaction


       /**
        * Step 5: Initialize an existing token and perform a transfer.
        */
        const Token = new FT('ee8d97e5953a6843c3269a7ce3ae4c5264b7af8539fa07764a7f0cf260bf5eb5'); // Step 5.1: Initialize token with contract TXID
        await Token.initialize(); // Step 5.2: Initialize token parameters
        const transferTX = await Token.transfer(privateKeyA, addressB, 0.02); // Step 5.3: Create transfer transaction
        await Token.broadcastTXraw(transferTX); // Step 5.4: Broadcast transfer transaction


    } catch (error) {
        console.error('Error:', error);
    }
}

main();
```
Explanation: UTXO refers to the output of P2PKH, which provides fees for transactions. Fttxo refers to the output of storing ft contract code.

The FT SDK only provides basic UTXO retrieval, which means adding only one UTXO and FTTXO for transactions. To better build transactions, developers are advised to learn how to manage UTXO locally. If there is insufficient transaction fee or FT amount, please try checking the balance from the API. If the balance is sufficient, you can manually add multiple UTXO or FTTXO. 
`Note:When manually adding, ensure that the utxo input is after the fttxo input.`


poolNFT
===
```ts
import * as tbc from 'tbc-lib-js';
import { poolNFT } from 'tbc-lib-js';

//测试链私钥
const privateKeyA = tbc.PrivateKey.fromString('L1u2TmR7hMMMSV9Bx2Lyt3sujbboqEFqnKygnPRnQERhKB4qptuK');
const publicKeyA = tbc.PublicKey.fromPrivateKey(privateKeyA);
const addressA = tbc.Address.fromPrivateKey(privateKeyA).toString();

async function main() {
    try {
        //Step 1: 创建poolNFT，在initCreate()方法中传入FT合约ID
        const pool = new poolNFT();
        await pool.initCreate('80e056fe24e90ff4ef849eca33047243e27ebada13eea695db0d660726fec2ed');
        const tx1 = await pool.createPoolNFT(privateKeyA);
        await pool.broadcastTXraw(tx1);

        //Step 2: 使用已创建的poolNFT，传入poolNFT合约ID进行初始化
        const poolNftContractId = 'a17cfb4c11560c38d54e4ffaa24b94c7bee39bbc929f13e46db9bc69403846ce';
        const poolUse = new poolNFT(poolNftContractId);
        await poolUse.initfromContractId();

        //Step 2.1: 为刚创建的poolNFT注入初始资金。传入参数:TBC数量、FT数量、要换取的LP数量，当前设定池中初始LP数量等于注入的TBC数量
        let tbc = 30;
        let fta = 1000;
        let tx2 = await poolUse.initPoolNFT(privateKeyA, addressA, lp, tbc, fta);
        await poolUse.broadcastTXraw(tx2);

        //Step 2.2: 为已完成初始资金注入的poolNFT添加流动性。传入参数:向池中添加的TBC数量(会同步计算需要添加的Token数量)，要求添加至少0.1个TBC
        let tbc = 0.1;
        const tx3 = await poolUse.increaseLP(privateKeyA, addressA, tbc);
        await poolUse.broadcastTXraw(tx3);

        //Step 2.3: 花费拥有的LP。传入参数:要花费的LP数量，要求花费至少1个LP
        let lp = 2;
        const tx4 = await poolUse.consumLP(privateKeyA, addressA, lp);
        await poolUse.broadcastTXraw(tx4);

        //Step 2.4: 用TBC兑换Token。传入参数:要兑换的Token数量，要求至少花费0.1个TBC
        let fta = 100;
        const tx5 = await poolUse.swaptoToken(privateKeyA, addressA, fta);
        await poolUse.broadcastTXraw(tx5);

        //Step 2.5: Token兑换TBC。传入参数:要兑换的TBC数量，要求至少兑换0.1个TBC
        let tbc = 0.1;
        const tx6 = await poolUse.swaptoTBC(privateKeyA, addressA, tbc);
        await poolUse.broadcastTXraw(tx6);
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
```