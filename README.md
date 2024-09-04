tbc
===

Javascript Turing BC library.

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
const mnemonic = Mnemonic.fromString("word word word word word word word word word word word word", Mnemonic.Words.ENGLISH);

// get seed from mnemonic
const seed = mnemonic.toSeed();

// create private key from seed with compressed format
// will sign the transaction with this private key
const privateKey = new PrivateKey(seed.slice(0, 32), 'livenet'); // 设置 compressed 为 true

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
//     txId: '8c70d452a2daa807e98f110b712b2098548b2395828275cdd590678c6bfd9a9f',
//     outputIndex: 1,
//     script: new Script('76a9148753ce4a64e77ccf2185214bdbbef44f5b597f0588ac'),
//     satoshis: 3149999965
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
