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
const HDPrivateKey = mnemonic.toHDPrivateKey('','livenet');

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
    script: new Script('<lockingScript>'),
    satoshis: 50000000
};
transaction.from(utxo1);

//Add the second input
// const utxo2 = {
//     txId: '<txid>',
//     outputIndex: 1,
//     script: new Script('<script>'),
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

// Set the transaction version
transaction.version = 10;


// Explicitly sign each input
transaction.sign(privatekey, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);
//transaction.sign(privateKey2, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);


// Serialize the transaction
const serializedTransaction = transaction.serialize();
console.log('Serialized Transaction:', serializedTransaction);


```

Create NFT
===
# NFT Issuance on Turing Blockchain using `tbc-lib-js`

This document provides a step-by-step guide for issuing an NFT (Non-Fungible Token) on the Turing blockchain using the `tbc-lib-js` library. The guide is beginner-friendly, and covers key concepts such as setting up a wallet, creating a transaction, and issuing an NFT.

To get started, install the library using the following command:

```bash
npm install tbc-lib-js
```
NFT Issuance Program
The following program demonstrates how to issue an NFT using a UTXO (Unspent Transaction Output) on the Turing blockchain. It includes creating a new transaction, adding inputs and outputs, signing the transaction, and retrieving the serialized transaction hex.

```
const PrivateKey = require('tbc-lib-js/lib/privatekey');
const Address = require('tbc-lib-js/lib/address');
const Script = require('tbc-lib-js/lib/script');
const TBCNft = require('tbc-lib-js/lib/contract/nft');

/**
 * Step 1: Set up the wallet private key and address.
 * This private key will be used to sign the transaction.
 */
const walletPrivateKey = new PrivateKey('L1u2TmR7hMMMSV9Bx2Lyt3sujbboqEFqnKygnPRnQERhKB4qptuK');
const address = walletPrivateKey.toAddress();
console.log('Wallet Address:', address.toString());

/**
 * Step 2: Define the NFT recipient address.
 * This is the address where the newly issued NFT will be sent.
 */
const nftAddress = new Address('1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ');

/**
 * Step 3: Specify the UTXO details.
 * The UTXO is the source of funds for creating the NFT transaction.
 * The UTXO must belong to the walletPrivateKey.
 */
const utxo = {
    address: address,  // Address of the UTXO owner
    txId: '9ca9e95e1f0cf989b913518c2c19bd10b5b90a8bab4b49a4f57715b103b6c346',  // Transaction ID where the UTXO is located
    outputIndex: 1,  // Index of the output in the transaction
    script: new Script('76a9142158ccfe3dc673b74e67c1ffd77842fd8bc4361c88ac'),  // Locking script for the UTXO (P2PKH)
    satoshis: 1000000  // Amount in satoshis
};

/**
 * Step 4: Create NFT metadata.
 * This object contains information about the NFT, such as its name, symbol, and URI.
 */
const nftData = {
    name: 'NFT Name',  // Name of the NFT
    symbol: 'NFT Symbol',  // Symbol representing the NFT
    uri: 'https://nft.uri',  // URI pointing to the metadata or asset of the NFT
    data: {  // Additional data associated with the NFT
        key1: 'value1',
        key2: 'value2',
    },
};

/**
 * Step 5: Create the NFT transaction.
 * Use the `CreateNFT` method to construct a transaction for issuing the NFT.
 * The method takes the UTXO, wallet private key, recipient address, and NFT metadata as inputs.
 */
const transaction = TBCNft.CreateNFT(utxo, walletPrivateKey, nftAddress, nftData);

/**
 * Step 6: Output the created transaction.
 * The transaction will be serialized and returned as a hex string, which can be broadcasted to the blockchain.
 */
console.log('NFT Issuance Transaction:', transaction);

```
# Explanation
1,Setup Wallet Private Key and Address
A PrivateKey is created using a predefined WIF (Wallet Import Format) string. From this private key, we derive the wallet address that will be used to create and sign the transaction.

2,Define the NFT Recipient Address
The recipient's address is defined using the Address class. This is where the NFT will be sent after it is created.

3,Specify the UTXO
The UTXO represents an unspent output from a previous transaction that the wallet controls. It includes the transaction ID (txId), output index (outputIndex), locking script (script), and amount (satoshis).

4,Create NFT Metadata
Metadata for the NFT is provided in the form of an object. It contains fields like name, symbol, and uri to describe the NFT.

5,Create the NFT Transaction
The CreateNFT method constructs a transaction that includes:

6,The UTXO as the input.
Outputs that define where the NFT is being sent and any additional data related to the NFT.
The transaction is then signed using the wallet's private key.
Output the Transaction
The final transaction is serialized and printed to the console. This serialized transaction can be broadcasted to the blockchain network for inclusion in a block.

Notes
Ensure that the UTXO being used has enough funds to cover the transaction fees.
The NFT metadata can include any custom fields as required by your application.
The recipient address and UTXO details should be verified before creating the transaction to avoid errors.
This program demonstrates the basic structure of creating an NFT transaction. For more advanced use-cases, refer to the official tbc-lib-js documentation.

