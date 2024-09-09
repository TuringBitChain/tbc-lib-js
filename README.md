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
