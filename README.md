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
```
import { FT } from 'tbc-lib-js/lib/contract/ft'
import * as tbc from 'tbc-lib-js';

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
const ftDecimal = 10; 
const ftAmount = 2.1;

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