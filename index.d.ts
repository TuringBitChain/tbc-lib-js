/* eslint-disable @typescript-eslint/ban-types */
// Type definitions for tbc 1.5.6
// Project: https://github.com/TuringBitChain/tbc-lib-js
// Forked From: https://github.com/bitpay/bitcore-lib
// Definitions by: Lautaro Dragan <https://github.com/lautarodragan>
// Definitions extended by: David Case <https://github.com/shruggr>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// TypeScript Version: 3.0

/// <reference types="node" />

declare module "tbc-lib-js" {
  /**
   * Opcode class, representing opcodes used in Bitcoin Script
   * @constructor
   * @param {number} op_code
   * @class
   */
  class Opcode {
    /**
     * An empty array of bytes is pushed onto the stack. (This is not a no-op: an item is added to the stack.)
     * @opcode {`0`}
     * @hex {`0x00`}
     * @input Nothing
     * @output empty
     * @static
     */
    static smallInt(number): Opcode;
    static OP_0: number;
    /**
     * The next byte contains the number of bytes to be pushed onto the stack.
     * @opcode {`76`}
     * @hex {`0x4c`}
     * @input special
     * @output data
     * @static
     */
    static OP_PUSHDATA1: number;
    /**
     * The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
     * @opcode {`77`}
     * @hex {`0x4d`}
     * @input special
     * @output data
     * @static
     */
    static OP_PUSHDATA2: number;
    /**
     * The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
     * @opcode {`78`}
     * @hex {`0x4e`}
     * @input special
     * @output data
     * @static
     */
    static OP_PUSHDATA4: number;
    /**
     * The number -1 is pushed onto the stack.
     * @opcode {`79`}
     * @hex {`0x4f`}
     * @input Nothing
     * @output `-1`
     * @static
     */
    static OP_1NEGATE: number;
    /**
     * Reserved words, Using an unassigned opcode makes the transaction invalid.
     * @opcode {`80`}
     * @hex {`0x50`}
     * @input Nothing
     * @output Nothing
     * @static
     */
    static OP_RESERVED: number;
    /**
     * The number 1 is pushed onto the stack.
     * @opcode {`81`}
     * @hex {`0x51`}
     * @input Nothing
     * @output `1`
     * @static
     */
    static OP_TRUE: number;
    /**
     * The number 1 is pushed onto the stack.
     * @opcode {`81`}
     * @hex {`0x51`}
     * @input Nothing
     * @output `1`
     * @static
     */
    static OP_1: number;
    /**
     * The number in the word name 2 is pushed onto the stack.
     * @opcode {`82`}
     * @hex {`0x52`}
     * @input Nothing
     * @output `2`
     * @static
     */
    static OP_2: number;
    /**
     * The number in the word name 3 is pushed onto the stack.
     * @opcode {`83`}
     * @hex {`0x53`}
     * @input Nothing
     * @output `3`
     * @static
     */
    static OP_3: number;
    /**
     * The number in the word name 4 is pushed onto the stack.
     * @opcode {`84`}
     * @hex {`0x54`}
     * @input Nothing
     * @output `4`
     * @static
     */
    static OP_4: number;
    /**
     * The number in the word name 5 is pushed onto the stack.
     * @opcode {`85`}
     * @hex {`0x55`}
     * @input Nothing
     * @output `5`
     * @static
     */
    static OP_5: number;
    /**
     * The number in the word name 6 is pushed onto the stack.
     * @opcode {`86`}
     * @hex {`0x56`}
     * @input Nothing
     * @output `6`
     * @static
     */
    static OP_6: number;
    /**
     * The number in the word name 7 is pushed onto the stack.
     * @opcode {`87`}
     * @hex {`0x57`}
     * @input Nothing
     * @output `7`
     * @static
     */
    static OP_7: number;
    /**
     * The number in the word name 8 is pushed onto the stack.
     * @opcode {`88`}
     * @hex {`0x58`}
     * @input Nothing
     * @output `8`
     * @static
     */
    static OP_8: number;
    /**
     * The number in the word name 9 is pushed onto the stack.
     * @opcode {`89`}
     * @hex {`0x59`}
     * @input Nothing
     * @output `9`
     * @static
     */
    static OP_9: number;
    /**
     * The number in the word name 10 is pushed onto the stack.
     * @opcode {`90`}
     * @hex {`0x5a`}
     * @input Nothing
     * @output `10`
     * @static
     */
    static OP_10: number;
    /**
     * The number in the word name 11 is pushed onto the stack.
     * @opcode {`91`}
     * @hex {`0x5b`}
     * @input Nothing
     * @output `11`
     * @static
     */
    static OP_11: number;
    /**
     * The number in the word name 12 is pushed onto the stack.
     * @opcode {`92`}
     * @hex {`0x5c`}
     * @input Nothing
     * @output `12`
     * @static
     */
    static OP_12: number;
    /**
     * The number in the word name 13 is pushed onto the stack.
     * @opcode {`93`}
     * @hex {`0x5d`}
     * @input Nothing
     * @output `13`
     * @static
     */
    static OP_13: number;
    /**
     * The number in the word name 14 is pushed onto the stack.
     * @opcode {`94`}
     * @hex {`0x5e`}
     * @input Nothing
     * @output `14`
     * @static
     */
    static OP_14: number;
    /**
     * The number in the word name 15 is pushed onto the stack.
     * @opcode {`95`}
     * @hex {`0x5f`}
     * @input Nothing
     * @output `15`
     * @static
     */
    static OP_15: number;
    /**
     * The number in the word name 16 is pushed onto the stack.
     * @opcode {`96`}
     * @hex {`0x60`}
     * @input Nothing
     * @output `16`
     * @static
     */
    static OP_16: number;

    /**
     * Does nothing.
     * @opcode {`97`}
     * @hex {`0x61`}
     * @input Nothing
     * @output Nothing
     * @static
     */
    static OP_NOP: number;

    /**
     * DISABLED.Puts the version of the protocol under which this transaction will be evaluated onto the stack.
     * @opcode {`99`}
     * @hex {`0x62`}
     * @input Nothing
     * @output Protocol version
     * @static
     */
    static OP_VER: number;
    /**
     * If the top stack value is TRUE, statement 1 is executed.
     * If the top stack value is FALSE and ELSE is used, statement 2 is executed. If ELSE is NOT used, the script jumps to ENDIF.
     * The top stack value is removed.
     * @opcode {`99`}
     * @hex {`0x63`}
     * @example
     * `[expression] IF
     *      [statement 1]
     * ENDIF`
     * OR
     * `[expression] IF
     *      [statement 1]
     *  ELSE
     *      [statement 2]
     * ENDIF`
     * @static
     */
    static OP_IF: number;
    /**
     * If the top stack value is FALSE, statement 1 is executed.
     * If the top stack value is TRUE and ELSE is used, statement 2 is executed. If ELSE is NOT used, the script jumps to ENDIF.
     * The top stack value is removed.
     * @opcode {`100`}
     * @hex {`0x64`}
     * @example
     * `[expression] NOTIF
     *      [statement 1]
     * ENDIF`
     * OR
     * `[expression] NOTIF
     *      [statement 1]
     *  ELSE
     *      [statement 2]
     * ENDIF`
     * @static
     */
    static OP_NOTIF: number;
    /**
     * DISABLED
     * @opcode {`101`}
     * @hex {`0x65`}
     * @static
     */
    static OP_VERIF: number;
    /**
     * DISABLED
     * @opcode {`102`}
     * @hex {`0x66`}
     * @static
     */
    static OP_VERNOTIF: number;
    /**
     * If the preceding IF or NOTIF check was not valid then statement 2 is executed.
     * @opcode {`103`}
     * @hex {`0x67`}
     * @example
     * `[expression] IF
     *      [statement 1]
     *  ELSE
     *      [statement 2]
     * ENDIF`
     * @static
     */
    static OP_ELSE: number;
    /**
     * Ends an if/else block. All blocks must end, or the transaction is invalid. An OP_ENDIF without a prior matching OP_IF or OP_NOTIF is also invalid.
     * @opcode {`104`}
     * @hex {`0x68`}
     * @example
     * `[expression] IF
     *      [statement 1]
     *  ELSE
     *      [statement 2]
     * ENDIF`
     * @static
     */
    static OP_ENDIF: number;
    /**
     * Marks transaction as invalid if top stack value is not true. The top stack value is removed.
     * @opcode {`105`}
     * @hex {`0x69`}
     * @input True / false
     * @output Nothing / fail
     * @static
     */
    static OP_VERIFY: number;
    /**
     * OP_RETURN can also be used to create "False Return" outputs with a scriptPubKey consisting of OP_FALSE OP_RETURN followed by data.
     * Such outputs are provably unspendable and should be given a value of zero Satoshis. These outputs can be pruned from storage
     * in the UTXO set, reducing its size. After the Genesis upgrade in 2020 miners will be free to mine transactions
     * containing FALSE RETURN outputs of any size.
     * @opcode {`106`}
     * @hex {`0x6a`}
     * @input Nothing
     * @output Ends script with top value on stack as final result
     * @static
     */
    static OP_RETURN: number;

    // stack ops

    /**
     * Puts the input onto the top of the alt stack. Removes it from the main stack.
     * @opcode {`107`}
     * @hex {`0x6b`}
     * @input x1
     * @output (alt)x1
     * @static
     */
    static OP_TOALTSTACK: number;
    /**
     * Puts the input onto the top of the main stack. Removes it from the alt stack.
     * @opcode {`108`}
     * @hex {`0x6c`}
     * @input (alt)x1
     * @output x1
     * @static
     */
    static OP_FROMALTSTACK: number;
    /**
     * Removes the top two stack items.
     * @opcode {`109`}
     * @hex {`0x6d`}
     * @input x1 x2
     * @output Nothing
     * @static
     */
    static OP_2DROP: number;
    /**
     * Duplicates the top two stack items.
     * @opcode {`110`}
     * @hex {`0x6e`}
     * @input x1 x2
     * @output x1 x2 x1 x2
     * @static
     */
    static OP_2DUP: number;
    /**
     * Duplicates the top three stack items.
     * @opcode {`111`}
     * @hex {`0x6f`}
     * @input x1 x2 x3
     * @output x1 x2 x3 x1 x2 x3
     * @static
     */
    static OP_3DUP: number;
    /**
     * Copies the pair of items two spaces back in the stack to the front.
     * @opcode {`112`}
     * @hex {`0x70`}
     * @input x1 x2 x3 x4
     * @output x1 x2 x3 x4 x1 x2
     * @static
     */
    static OP_2OVER: number;
    /**
     * The fifth and sixth items back are moved to the top of the stack.
     * @opcode {`113`}
     * @hex {`0x71`}
     * @input x1 x2 x3 x4 x5 x6
     * @output x3 x4 x5 x6 x1 x2
     * @static
     */
    static OP_2ROT: number;
    /**
     * Swaps the top two pairs of items.
     * @opcode {`114`}
     * @hex {`0x72`}
     * @input x1 x2 x3 x4
     * @output x3 x4 x1 x2
     * @static
     */
    static OP_2SWAP: number;
    /**
     * If the top stack value is not 0, duplicate it.
     * @opcode {`115`}
     * @hex {`0x73`}
     * @input x
     * @output x / x x
     * @static
     */
    static OP_IFDUP: number;
    /**
     * Counts the number of stack items onto the stack and places the value on the top
     * @opcode {`116`}
     * @hex {`0x74`}
     * @input Nothing
     * @output Stack size
     * @static
     */
    static OP_DEPTH: number;
    /**
     * Removes the top stack item.
     * @opcode {`117`}
     * @hex {`0x75`}
     * @input x
     * @output Nothing
     * @static
     */
    static OP_DROP: number;
    /**
     * Removes the top stack item.
     * @opcode {`118`}
     * @hex {`0x76`}
     * @input x
     * @output x x
     * @static
     */
    static OP_DUP: number;
    /**
     * Removes the second-to-top stack item.
     * @opcode {`119`}
     * @hex {`0x77`}
     * @input x1 x2
     * @output x2
     * @static
     */
    static OP_NIP: number;
    /**
     * Copies the second-to-top stack item to the top.
     * @opcode {`120`}
     * @hex {`0x78`}
     * @input x1 x2
     * @output x1 x2 x1
     * @static
     */
    static OP_OVER: number;
    /**
     * The item `n` back in the stack is copied to the top.
     * @opcode {`121`}
     * @hex {`0x79`}
     * @input xn ... x2 x1 x0 {n}
     * @output 	xn ... x2 x1 x0 xn
     * @static
     */
    static OP_PICK: number;
    /**
     * The item `n` back in the stack is copied to the top.
     * @opcode {`122`}
     * @hex {`0x7a`}
     * @input xn ... x2 x1 x0 {n}
     * @output ... x2 x1 x0 xn
     * @static
     */
    static OP_ROLL: number;
    /**
     * The top three items on the stack are rotated to the left.
     * @opcode {`123`}
     * @hex {`0x7b`}
     * @input x1 x2 x3
     * @output x2 x3 x1
     * @static
     */
    static OP_ROT: number;
    /**
     * The top two items on the stack are swapped.
     * @opcode {`124`}
     * @hex {`0x7c`}
     * @input x1 x2
     * @output x2 x1
     * @static
     */
    static OP_SWAP: number;
    /**
     * The item at the top of the stack is copied and inserted before the second-to-top item.
     * @opcode {`125`}
     * @hex {`0x7d`}
     * @input x1 x2
     * @output x2 x1 x2
     * @static
     */
    static OP_TUCK: number;

    // splice ops
    static OP_CAT: number;
    static OP_SPLIT: number;
    static OP_NUM2BIN: number;
    static OP_BIN2NUM: number;
    static OP_SIZE: number;

    // bit logic
    static OP_INVERT: number;
    static OP_AND: number;
    static OP_OR: number;
    static OP_XOR: number;
    static OP_EQUAL: number;
    static OP_EQUALVERIFY: number;
    static OP_RESERVED1: number;
    static OP_RESERVED2: number;

    // numeric
    static OP_1ADD: number;
    static OP_1SUB: number;
    static OP_2MUL: number;
    static OP_2DIV: number;
    static OP_NEGATE: number;
    static OP_ABS: number;
    static OP_NOT: number;
    static OP_0NOTEQUAL: number;

    static OP_ADD: number;
    static OP_SUB: number;
    static OP_MUL: number;
    static OP_DIV: number;
    static OP_MOD: number;
    static OP_LSHIFT: number;
    static OP_RSHIFT: number;

    static OP_BOOLAND: number;
    static OP_BOOLOR: number;
    static OP_NUMEQUAL: number;
    static OP_NUMEQUALVERIFY: number;
    static OP_NUMNOTEQUAL: number;
    static OP_LESSTHAN: number;
    static OP_GREATERTHAN: number;
    static OP_LESSTHANOREQUAL: number;
    static OP_GREATERTHANOREQUAL: number;
    static OP_MIN: number;
    static OP_MAX: number;

    static OP_WITHIN: number;

    // crypto
    static OP_RIPEMD160: number;
    static OP_SHA1: number;
    static OP_SHA256: number;
    static OP_HASH160: number;
    static OP_HASH256: number;
    static OP_CODESEPARATOR: number;
    static OP_CHECKSIG: number;
    static OP_CHECKSIGVERIFY: number;
    static OP_CHECKMULTISIG: number;
    static OP_CHECKMULTISIGVERIFY: number;

    static OP_CHECKLOCKTIMEVERIFY: number;
    static OP_CHECKSEQUENCEVERIFY: number;

    // expansion
    static OP_NOP1: number;
    static OP_NOP2: number;
    static OP_NOP3: number;
    static OP_NOP4: number;
    static OP_NOP5: number;
    static OP_NOP6: number;
    static OP_NOP7: number;
    static OP_NOP8: number;
    static OP_NOP9: number;
    static OP_NOP10: number;

    static OP_PUSH_META: number;
    static OP_PARTIAL_HASH: number;

    // template matching params
    static OP_PUBKEYHASH: number;
    static OP_PUBKEY: number;
    static OP_INVALIDOPCODE: number;

    constructor(op_code: number);
  }

  export namespace encoding {
    class Base58 {
      static encode(buf: Buffer): string;
      static decode(str: string): Buffer;
    }
    class Base58Check {}
    class BufferReader {
      constructor(buf: Buffer);
      read(len: number): Buffer;
      readUInt8(): number;
      readUInt16BE(): number;
      readUInt16LE(): number;
      readUInt32BE(): number;
      readUInt32LE(): number;
      readInt32LE(): number;
      readUInt64BEBN(): number;
      readUInt64LEBN(): number;
      readVarintNum(): number;
      readVarLengthBuffer(): Buffer;
      readVarintBuf(): Buffer;
      readVarintBN(): crypto.BN;
      reverse(): this;
      readReverse(len?: number): Buffer;
      readAll(): Buffer;
      eof(): boolean;
      remaining(): number;
      pos: number;
    }
    class BufferWriter {
      write(buf: Buffer): this;
      writeUInt8(n: number): this;
      writeUInt16BE(n: number): this;
      writeUInt16LE(n: number): this;
      writeUInt32BE(n: number): this;
      writeUInt32LE(n: number): this;
      writeInt32LE(n: number): this;
      writeUInt64BEBN(n: crypto.BN): this;
      writeUInt64LEBN(n: crypto.BN): this;
      writeVarintNum(n: number): this;
      writeVarintBN(n: crypto.BN): this;
      writeReverse(buf: Buffer): this;
      toBuffer(): Buffer;
    }
    class Varint {}
  }

  export namespace crypto {
    interface IOpts {
      endian: "big" | "little";
      size?: number;
    }

    type Endianness = "le" | "be";

    class BN {
      constructor(
        number:
          | number
          | bigint
          | string
          | number[]
          | ReadonlyArray<number>
          | Buffer
          | BN,
        base?: number,
        endian?: Endianness
      );

      static Zero: BN;
      static One: BN;
      static Minus1: BN;

      clone(): BN;
      toString(base?: number | "hex", length?: number): string;
      toNumber(): number;
      toJSON(): string;
      toArray(endian?: Endianness, length?: number): number[];
      toBuffer(opts?: IOpts): Buffer;
      bitLength(): number;
      zeroBits(): number;
      byteLength(): number;
      isNeg(): boolean;
      isEven(): boolean;
      isOdd(): boolean;
      isZero(): boolean;
      isBN(): boolean;
      cmp(b: any): number;
      lt(b: any): boolean;
      lte(b: any): boolean;
      gt(b: any): boolean;
      gte(b: any): boolean;
      eq(b: any): boolean;
      eqn(b: any): boolean;
      gten(b: any): boolean;
      lten(b: any): boolean;
      isBN(b: any): boolean;

      neg(): BN;
      abs(): BN;
      add(b: BN): BN;
      sub(b: BN): BN;
      mul(b: BN): BN;
      sqr(): BN;
      pow(b: BN): BN;
      div(b: BN): BN;
      mod(b: BN): BN;
      divRound(b: BN): BN;

      or(b: BN): BN;
      and(b: BN): BN;
      xor(b: BN): BN;
      setn(b: number): BN;
      shln(b: number): BN;
      shrn(b: number): BN;
      testn(b: number): boolean;
      maskn(b: number): BN;
      bincn(b: number): BN;
      notn(w: number): BN;

      gcd(b: BN): BN;
      egcd(b: BN): { a: BN; b: BN; gcd: BN };
      invm(b: BN): BN;
      static fromSM(buf: Buffer, opts?: IOpts): BN;
      neg(): BN;
      add(one: BN): BN;
      toSM(opts?: IOpts): Buffer;
      toNumber(): number;
      static fromBuffer(buf: Buffer, opts?: IOpts): BN;
      static fromNumber(n: number): BN;
      static fromHex(hex: string, opts?: IOpts): BN;
      static fromString(hex: string, base?: number): BN;
    }

    namespace ECDSA {
      function sign(message: Buffer, key: PrivateKey): Signature;
      function verify(
        hashbuf: Buffer,
        sig: Signature,
        pubkey: PublicKey,
        endian?: "little"
      ): boolean;
    }

    namespace Hash {
      function sha1(buffer: Buffer): Buffer;
      function sha256(buffer: Buffer): Buffer;
      function sha256sha256(buffer: Buffer): Buffer;
      function sha256ripemd160(buffer: Buffer): Buffer;
      function sha512(buffer: Buffer): Buffer;
      function ripemd160(buffer: Buffer): Buffer;

      function sha256hmac(data: Buffer, key: Buffer): Buffer;
      function sha512hmac(data: Buffer, key: Buffer): Buffer;
    }

    namespace Random {
      function getRandomBuffer(size: number): Buffer;
    }

    class Point {
      static fromX(odd: boolean, x: crypto.BN | string): Point;
      static getG(): any;
      static getN(): crypto.BN;
      getX(): crypto.BN;
      getY(): crypto.BN;
      validate(): this;
      mul(n: crypto.BN): Point;
    }

    class Signature {
      static fromDER(sig: Buffer): Signature;
      static fromTxFormat(buf: Buffer): Signature;
      static fromString(data: string): Signature;
      static SIGHASH_ALL: number;
      static SIGHASH_NONE: number;
      static SIGHASH_SINGLE: number;
      static SIGHASH_FORKID: number;
      static SIGHASH_ANYONECANPAY: number;

      static ALL: number;
      static NONE: number;
      static SINGLE: number;
      static ANYONECANPAY_ALL: number;
      static ANYONECANPAY_NONE: number;
      static ANYONECANPAY_SINGLE: number;

      nhashtype: number;
      toString(): string;
      toBuffer(): Buffer;
      toDER(): Buffer;
      hasDefinedHashtype(): boolean;
      static isTxDER(buf: Buffer): boolean;
      hasLowS(): boolean;
      toTxFormat(): Buffer;
    }
  }

  export namespace Transaction {
    interface IUnspentOutput {
      address?: string;
      txId: string;
      outputIndex: number;
      script: string;
      satoshis: number;
      ftBalance?: bigint;
    }
    class UnspentOutput {
      static fromObject(o: IUnspentOutput): UnspentOutput;
      constructor(data: IUnspentOutput);
      inspect(): string;
      toObject(): IUnspentOutput;
      toString(): string;
    }

    class Output {
      readonly script: Script;
      readonly satoshis: number;
      readonly satoshisBN: crypto.BN;
      spentTxId: string | null;
      constructor(data: { script: Script; satoshis: number });

      setScript(script: Script | string | Buffer): this;
      inspect(): string;
      toObject(): { satoshis: number; script: string };
      getSize(): number;
      toBufferWriter(writer?: encoding.BufferWriter): encoding.BufferWriter;
      static fromBufferReader(reader: encoding.BufferReader): Output;
    }

    class Input {
      readonly prevTxId: Buffer;
      readonly outputIndex: number;
      sequenceNumber: number;
      readonly script: Script;
      output?: Output;
      constructor(params: object);
      isValidSignature(tx: Transaction, sig: any): boolean;
      setScript(script: Script): this;
      getSignatures(
        tx: Transaction,
        privateKey: PrivateKey,
        inputIndex: number,
        sigtype?: number
      ): any;
      getPreimage(
        tx: Transaction,
        inputIndex: number,
        sigtype?: number,
        isLowS?: boolean,
        csIdx?: number
      ): any;
    }

    namespace Input {
      class PublicKeyHash extends Input {}
    }

    class Signature {
      constructor(arg: Signature | string | object);

      signature: crypto.Signature;
      publicKey: PublicKey;
      prevTxId: Buffer;
      outputIndex: number;
      inputIndex: number;
      sigtype: number;
    }

    namespace Sighash {
      function sighashPreimage(
        transaction: Transaction,
        sighashType: number,
        inputNumber: number,
        subscript: Script,
        satoshisBN: crypto.BN,
        flags?: number,
        hashCache?: HashCache
      ): Buffer;
      function sighash(
        transaction: Transaction,
        sighashType: number,
        inputNumber: number,
        subscript: Script,
        satoshisBN: crypto.BN,
        flags?: number,
        hashCache?: HashCache
      ): Buffer;
      function sign(
        transaction: Transaction,
        privateKey: PrivateKey,
        sighashType: number,
        inputIndex: number,
        subscript: Script,
        satoshisBN: crypto.BN,
        flags?: number,
        hashCache?: HashCache
      ): crypto.Signature;
      function verify(
        transaction: Transaction,
        signature: Signature,
        publicKey: PublicKey,
        inputIndex: number,
        subscript: Script,
        satoshisBN: crypto.BN,
        flags?: number,
        hashCache?: HashCache
      ): boolean;
    }
  }

  export class Transaction {
    static DUMMY_PRIVATEKEY: PrivateKey;
    inputs: Transaction.Input[];
    outputs: Transaction.Output[];
    readonly id: string;
    readonly hash: string;
    readonly inputAmount: number;
    readonly outputAmount: number;
    nid: string;
    nLockTime: number;

    constructor(raw?: string);

    from(
      utxo: Transaction.IUnspentOutput | Transaction.IUnspentOutput[],
      pubkeys?: PublicKey[],
      threshold?: number
    ): this;

    fromString(rawTxHex: string): this;
    fromBuffer(buffer: Buffer): this;
    to(address: Address[] | Address | string, amount: number): this;
    change(address: Address | string): this;
    fee(amount: number): this;
    feePerKb(amount: number): this;
    sign(
      privateKey: PrivateKey[] | string[] | PrivateKey | string,
      sigtype?: number
    ): this;
    applySignature(sig: {
      inputIndex: number;
      sigtype: number;
      publicKey: PublicKey;
      signature: crypto.Signature;
    }): this;
    verifySignature(
      sig: crypto.Signature,
      pubkey: PublicKey,
      nin: number,
      subscript: Script,
      satoshisBN: crypto.BN,
      flags: number
    ): boolean;
    addInput(
      input: Transaction.Input,
      outputScript?: Script | string,
      satoshis?: number
    ): this;
    removeInput(txId: string, outputIndex: number): void;
    addOutput(output: Transaction.Output): this;
    addData(value: Buffer | string): this;
    lockUntilDate(time: Date | number): this;
    lockUntilBlockHeight(height: number): this;

    hasWitnesses(): boolean;
    getFee(): number;
    getChangeOutput(): Transaction.Output | null;
    getChangeAddress(): Address | null;
    getLockTime(): Date | number;
    setLockTime(t: number): this;

    verify(): string | true;
    isCoinbase(): boolean;

    enableRBF(): this;
    isRBF(): boolean;

    inspect(): string;
    serialize(opts?: object): string;
    uncheckedSerialize(): string;

    toObject(): any;
    toBuffer(): Buffer;

    isFullySigned(): boolean;

    getSerializationError(opts?: object): any;

    getUnspentValue(): number;
    setInputScript(
      inputIndex:
        | number
        | {
            inputIndex: number;
            privateKey?: PrivateKey | Array<PrivateKey>;
            sigtype?: number;
            isLowS?: boolean;
          },
      unlockingScript:
        | Script
        | ((tx: Transaction, outputInPrevTx: Transaction.Output) => Script)
    ): this;
    setInputScriptAsync(
      inputIndex:
        | number
        | {
            inputIndex: number;
            sigtype?: number;
            isLowS?: boolean;
          },
      callback: (
        tx: Transaction,
        outputInPrevTx: Transaction.Output
      ) => Promise<Script>
    ): Promise<this>;
    setInputSequence(inputIndex: number, sequence: number): this;
    setOutput(
      outputIndex: number,
      output: Transaction.Output | ((tx: Transaction) => Transaction.Output)
    ): this;
    seal(): this;
    sealAsync(): Promise<this>;
    isSealed(): boolean;
    getChangeAmount(): number;
    getEstimateSize(): number;
    getEstimateFee(): number;
    checkFeeRate(feePerKb?: number): boolean;
    prevouts(): string;
    getSignature(
      inputIndex: number,
      privateKey?: PrivateKey | Array<PrivateKey>,
      sigtype?: number
    ): string | Array<string>;
    getPreimage(
      inputIndex: number,
      sigtype?: number,
      isLowS?: boolean,
      csIdx?: number
    ): string;
    addInputFromPrevTx(prevTx: Transaction, outputIndex?: number): this;
    addDummyInput(script: Script, satoshis: number): this;
    dummyChange(): this;
    /**
     * @deprecated please use `verifyScript` instead
     * @param inputIndex
     */
    verifyInputScript(inputIndex: number): {
      success: boolean;
      error: string;
      failedAt: any;
    };
    verifyScript(inputIndex: number): {
      success: boolean;
      error: string;
      failedAt: any;
    };
    getInputAmount(inputIndex: number): number;
    getOutputAmount(outputIndex: number): number;
  }

  export class ECIES {
    constructor(opts?: any, algorithm?: string);

    privateKey(privateKey: PrivateKey): ECIES;
    publicKey(publicKey: PublicKey): ECIES;
    encrypt(message: string | Buffer): Buffer;
    decrypt(encbuf: Buffer): Buffer;
  }
  export class Block {
    hash: string;
    height: number;
    transactions: Transaction[];
    header: {
      time: number;
      prevHash: string;
    };

    constructor(data: Buffer | object);
  }

  export class PrivateKey {
    constructor(key?: string | PrivateKey, network?: Networks.Type);

    readonly bn: crypto.BN;

    readonly publicKey: PublicKey;
    readonly compressed: boolean;
    readonly network: Networks.Network;

    toAddress(network?: Networks.Type): Address;
    toPublicKey(): PublicKey;
    toString(): string;
    toObject(): object;
    toJSON(): object;
    toWIF(): string;
    toHex(): string;
    toBigNumber(): any; //BN;
    toBuffer(): Buffer;
    inspect(): string;

    static fromString(str: string): PrivateKey;
    static fromWIF(str: string): PrivateKey;
    static fromRandom(netowrk?: string | Networks.Type): PrivateKey;
    static fromBuffer(buf: Buffer, network: Networks.Type): PrivateKey;
    static fromHex(hex: string, network: Networks.Type): PrivateKey;
    static getValidationError(data: string): any | null;
    static isValid(data: string): boolean;
  }

  export class PublicKey {
    constructor(source: string | PublicKey | crypto.Point, extra?: object);

    readonly point: crypto.Point;
    readonly compressed: boolean;
    readonly network: Networks.Network;

    toDER(): Buffer;
    toObject(): object;
    toBuffer(): Buffer;
    toAddress(network?: Networks.Type): Address;
    toString(): string;
    toHex(): string;
    inspect(): string;

    static fromPrivateKey(privateKey: PrivateKey): PublicKey;
    static fromBuffer(buf: Buffer, strict?: boolean): PublicKey;
    static fromDER(buf: Buffer, strict?: boolean): PublicKey;
    //static fromPoint(point: Point, compressed: boolean): PublicKey;
    //static fromX(odd: boolean, x: Point): PublicKey;
    static fromString(str: string): PublicKey;
    static fromHex(hex: string): PublicKey;
    static getValidationError(data: string): any | null;
    static isValid(data: string): boolean;
  }

  export class Message {
    constructor(message: string | Buffer);

    readonly messageBuffer: Buffer;

    sign(privateKey: PrivateKey): string;
    verify(address: string | Address, signature: string): boolean;
    toObject(): object;
    toJSON(): string;
    toString(): string;
    inspect(): string;

    static sign(message: string | Buffer, privateKey: PrivateKey): string;
    static verify(
      message: string | Buffer,
      address: string | Address,
      signature: string
    ): boolean;
    static MAGIC_BYTES: Buffer;
    static magicHash(): string;
    static fromString(str: string): Message;
    static fromJSON(json: string): Message;
    static fromObject(obj: object): Message;
  }

  export class Mnemonic {
    constructor(data: string | Array<string>, wordList?: Array<string>);

    readonly wordList: Array<string>;
    readonly phrase: string;

    toSeed(passphrase?: string): Buffer;
    toHDPrivateKey(passphrase: string, network: Networks.Type): HDPrivateKey;
    toString(): string;
    inspect(): string;

    static fromRandom(wordlist?: Array<string>): Mnemonic;
    static fromString(mnemonic: string, wordList?: Array<string>): Mnemonic;
    static isValid(mnemonic: string, wordList?: Array<string>): boolean;
    static fromSeed(seed: Buffer, wordlist: Array<string>): Mnemonic;
  }

  export class HDPrivateKey {
    constructor(data?: string | Buffer | object);

    readonly hdPublicKey: HDPublicKey;

    readonly xprivkey: Buffer;
    readonly xpubkey: Buffer;
    readonly network: Networks.Network;
    readonly depth: number;
    readonly privateKey: PrivateKey;
    readonly publicKey: PublicKey;
    readonly fingerPrint: Buffer;

    derive(arg: string | number, hardened?: boolean): HDPrivateKey;
    deriveChild(arg: string | number, hardened?: boolean): HDPrivateKey;
    deriveNonCompliantChild(
      arg: string | number,
      hardened?: boolean
    ): HDPrivateKey;

    toString(): string;
    toObject(): object;
    toJSON(): object;
    toBuffer(): Buffer;
    toHex(): string;
    inspect(): string;

    static fromRandom(): HDPrivateKey;
    static fromString(str: string): HDPrivateKey;
    static fromObject(obj: object): HDPrivateKey;
    static fromSeed(
      hexa: string | Buffer,
      network: string | Networks.Type
    ): HDPrivateKey;
    static fromBuffer(buf: Buffer): HDPrivateKey;
    static fromHex(hex: string): HDPrivateKey;
    static isValidPath(arg: string | number, hardened: boolean): boolean;
    static isValidSerialized(
      data: string | Buffer,
      network?: string | Networks.Type
    ): boolean;
    static getSerializedError(
      data: string | Buffer,
      network?: string | Networks.Type
    ): any | null;
  }

  export class HDPublicKey {
    constructor(arg: string | Buffer | object);

    readonly xpubkey: Buffer;
    readonly network: Networks.Network;
    readonly depth: number;
    readonly publicKey: PublicKey;
    readonly fingerPrint: Buffer;

    derive(arg: string | number, hardened?: boolean): HDPublicKey;
    deriveChild(arg: string | number, hardened?: boolean): HDPublicKey;

    toString(): string;
    toObject(): object;
    toJSON(): object;
    toBuffer(): Buffer;
    toHex(): string;
    inspect(): string;

    static fromString(str: string): HDPublicKey;
    static fromObject(obj: object): HDPublicKey;
    static fromBuffer(buf: Buffer): HDPublicKey;
    static fromHex(hex: string): HDPublicKey;

    static fromHDPrivateKey(hdPrivateKey: HDPrivateKey): HDPublicKey;
    static isValidPath(arg: string | number): boolean;
    static isValidSerialized(
      data: string | Buffer,
      network?: string | Networks.Type
    ): boolean;
    static getSerializedError(
      data: string | Buffer,
      network?: string | Networks.Type
    ): any | null;
  }

  export namespace Script {
    const types: {
      DATA_OUT: string;
    };

    interface IOpChunk {
      buf: Buffer;
      len: number;
      opcodenum: number;
    }

    function buildMultisigOut(
      publicKeys: PublicKey[],
      threshold: number,
      opts: object
    ): Script;
    function buildMultisigIn(
      pubkeys: PublicKey[],
      threshold: number,
      signatures: Buffer[],
      opts: object
    ): Script;

    function buildPublicKeyHashOut(
      address: Address | PublicKey | string
    ): Script;
    function buildPublicKeyOut(pubkey: PublicKey): Script;
    function buildSafeDataOut(
      data: string | Buffer | Array<string | Buffer>,
      encoding?: string
    ): Script;
    function buildScriptHashOut(script: Script): Script;
    function buildPublicKeyIn(
      signature: crypto.Signature | Buffer,
      sigtype: number
    ): Script;
    function buildPublicKeyHashIn(
      publicKey: PublicKey,
      signature: crypto.Signature | Buffer,
      sigtype: number
    ): Script;

    function fromAddress(address: string | Address): Script;
    function fromASM(str: string): Script;
    function fromHex(hex: string): Script;
    function fromString(str: string): Script;
    function fromBuffer(buf: Buffer): Script;

    function toASM(): string;
    function toBuffer(): Buffer;
    function toHex(): string;
    function toString(): string;

    function empty(): Script;

    namespace Interpreter {
      interface InterpretState {
        step: any;
        mainstack: any;
        altstack: any;
      }
      type StepListenerFunction = (
        step: any,
        stack: any[],
        altstack: any[]
      ) => void;
    }

    export class Interpreter {
      static SCRIPT_ENABLE_MAGNETIC_OPCODES: number;
      static SCRIPT_ENABLE_MONOLITH_OPCODES: number;
      static SCRIPT_VERIFY_STRICTENC: number;
      static SCRIPT_ENABLE_SIGHASH_FORKID: number;
      static SCRIPT_VERIFY_LOW_S: number;
      static SCRIPT_VERIFY_NULLFAIL: number;
      static SCRIPT_VERIFY_DERSIG: number;
      static SCRIPT_VERIFY_MINIMALDATA: number;
      static SCRIPT_VERIFY_NULLDUMMY: number;
      static SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS: number;
      static SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY: number;
      static SCRIPT_VERIFY_CHECKSEQUENCEVERIFY: number;
      static MAX_SCRIPT_ELEMENT_SIZE: number;
      static MAXIMUM_ELEMENT_SIZE: number;
      static SCRIPT_VERIFY_CLEANSTACK: number;
      static DEFAULT_FLAGS: number;
      stepListener?: Interpreter.StepListenerFunction;
      errstr?: string;
      verify: (
        inputScript: Script,
        outputScript: Script,
        txn: Transaction,
        nin: number,
        flags: any,
        satoshisBN: crypto.BN
      ) => boolean;
    }
  }

  export class Script {
    constructor(data?: string | object);

    chunks: Array<Script.IOpChunk>;
    length: number;

    set(obj: object): this;

    toBuffer(): Buffer;
    toASM(): string;
    toString(): string;
    toHex(): string;

    isPublicKeyHashOut(): boolean;
    isPublicKeyHashIn(): boolean;

    getPublicKey(): Buffer;
    getPublicKeyHash(): Buffer;

    isPublicKeyOut(): boolean;
    isPublicKeyIn(): boolean;

    isScriptHashOut(): boolean;
    isWitnessScriptHashOut(): boolean;
    isWitnessPublicKeyHashOut(): boolean;
    isWitnessProgram(): boolean;
    isScriptHashIn(): boolean;
    isMultisigOut(): boolean;
    isMultisigIn(): boolean;
    isDataOut(): boolean;
    isSafeDataOut(): boolean;

    getData(): Buffer;
    isPushOnly(): boolean;

    classify(): string;
    classifyInput(): string;
    classifyOutput(): string;

    isStandard(): boolean;

    prepend(obj: any): this;
    add(obj: any): this;

    hasCodeseparators(): boolean;
    removeCodeseparators(): this;

    equals(script: Script): boolean;

    getAddressInfo(): Address | boolean;
    findAndDelete(script: Script): this;
    checkMinimalPush(i: number): boolean;
    getSignatureOperationsCount(accurate: boolean): number;

    toAddress(network?: Networks.Type): Address;

    clone(): Script;

    subScript(n: number): Script;

    static fromChunks(chunks: Array<Script.IOpChunk>): Script;
  }

  export interface Util {
    readonly buffer: {
      reverse(a: any): any;
    };
  }

  export namespace Networks {
    interface Network {
      readonly name: string;
      readonly alias: string;
    }

    type Type = "livenet" | "testnet" | Network;

    const livenet: Network;
    const mainnet: Network;
    const testnet: Network;
    const defaultNetwork: Network;

    function add(data: any): Network;
    function remove(network: Networks.Type): void;
    function get(
      args: string | number | Networks.Type,
      keys?: string | string[]
    ): Network;
  }

  export class Address {
    readonly hashBuffer: Buffer;
    readonly network: Networks.Network;
    readonly type: string;

    constructor(
      data: Buffer | Uint8Array | string | object,
      network?: Networks.Type | string | number,
      type?: string
    );
    static fromString(address: string, network?: Networks.Type): Address;
    static fromHex(hex: string, network?: Networks.Type): Address;
    static fromPublicKey(data: PublicKey, network?: Networks.Type): Address;
    static fromPrivateKey(
      privateKey: PrivateKey,
      network?: Networks.Type
    ): Address;
    static fromPublicKeyHash(
      hash: Buffer | Uint8Array,
      network?: Networks.Type
    ): Address;
    static fromScriptHash(
      hash: Buffer | Uint8Array,
      network?: Networks.Type
    ): Address;
    static isValid(
      data: Buffer | Uint8Array | string | object,
      network?: Networks.Type | string,
      type?: string
    ): boolean;
    toBuffer(): Buffer;
    toHex(): string;
    toString(): string;
    toObject(): {
      hash: string;
      type: string;
      network: string;
    };
  }

  export class Unit {
    static fromBTC(amount: number): Unit;
    static fromMilis(amount: number): Unit;
    static fromBits(amount: number): Unit;
    static fromSatoshis(amount: number): Unit;

    constructor(amount: number, unitPreference: string);

    toBTC(): number;
    toMilis(): number;
    toBits(): number;
    toSatoshis(): number;
  }

  export class BlockHeader {
    constructor(arg: Buffer | JSON | object);

    toObject(): {
      hash: string;
      version: number;
      prevHash: string;
      merkleRoot: string;
      time: number;
      bits: number;
      nonce: number;
    };
  }
  export class MerkleBlock {
    constructor(arg: Buffer | JSON | object);

    toObject(): {
      header: {
        hash: string;
        version: number;
        prevHash: string;
        merkleRoot: string;
        time: number;
        bits: number;
        nonce: number;
      };
      numTransactions: number;
      hashes: Array<string>;
      flags: Array<number>;
    };
  }

  export class HashCache {
    constructor(
      prevoutsHashBuf?: Buffer,
      sequenceHashBuf?: Buffer,
      outputsHashBuf?: Buffer
    );

    static fromBuffer(buf: Buffer): HashCache;
    static fromJSON(json: object): HashCache;
    static fromHex(hex: string): HashCache;

    toBuffer(): HashCache;
    toJSON(): HashCache;
    toHex(): HashCache;
  }

  interface TapeAmount {
    amountHex: string;
    changeHex: string;
  }

  export class FT {
    name: string;
    symbol: string;
    decimal: number;
    totalSupply: number;
    codeScript: string;
    tapeScript: string;
    contractTxid: string;

    constructor(
      txidOrParams:
        | string
        | { name: string; symbol: string; amount: number; decimal: number }
    );
    initialize(): Promise<void>;
    buildFTtransferCode(code: string, addressOrHash: string): Script;
    buildFTtransferTape(tape: string, amountHex: string): Script;
    buildTapeAmount(
      amountBN: bigint,
      tapeAmountSet: bigint[],
      ftInputIndex?: number
    ): TapeAmount;
    getFTunlock(
      privateKey_from: PrivateKey,
      currentTX: Transaction,
      currentUnlockIndex: number,
      preTxId: string,
      preVout: number
    ): Promise<Script>;
    getFTunlockSwap(
      privateKey_from: PrivateKey,
      currentTX: Transaction,
      currentUnlockIndex: number,
      preTxId: string,
      preVout: number
    ): Promise<Script>;
    getFTmintCode(
      txid: string,
      vout: number,
      address: any,
      tapeSize: number
    ): Script;
    MintFT(privateKey_from: PrivateKey, address_to: string): Promise<string>;
    transfer(
      privateKey_from: PrivateKey,
      address_to: string,
      amount: number
    ): Promise<string>;
    broadcastTXraw(txraw: string): Promise<string>;
    mergeFT(privateKey_from: PrivateKey): Promise<boolean>;
  }

  interface MultiTxRaw {
    txraw: string;
    amounts: number[];
  }

  interface Unspent {
    tx_hash: string;
    tx_pos: number;
    height: number;
    value: number;
  }

  export class Multisig {
    ft: FT | undefined;
    network: "mainnet" | "testnet";

    constructor(config?: { ft?: FT; network?: "testnet" | "mainnet" });
    static getCombineHash(address: string): string;
    static createMultisigAddress(
      pubkeys: string[],
      signatureCount: number,
      publicKeyCount: number
    ): string;
    static getSignatureAndPublicKeyCount(address: string): {
      signatureCount: number;
      publicKeyCount: number;
    };
    static getMultisigLockScript(address: string): string;
    static verifyMultisigAddress(pubkeys: string[], address: string): boolean;
    createMultisigWalletTransaction(
      address_from: string,
      pubkeys: string[],
      signatureCount: number,
      publicKeyCount: number,
      satoshis: number,
      privateKey: PrivateKey
    ): Promise<string>;
    createP2pkhToMultisigTransaction(
      fromAddress: string,
      toAddress: string,
      satoshis: number,
      privateKey: PrivateKey
    ): Promise<string>;
    fromMultisigTransaction(
      fromAddress: string,
      toAddress: string,
      satoshis: number
    ): Promise<MultiTxRaw>;
    signfromMultisigTransaction(
      fromAddress: string,
      multiTxraw: MultiTxRaw,
      privateKey: PrivateKey
    ): string[];
    createFromMultisigTransaction(
      txraw: string,
      sigs: string[][],
      pubkeys: string
    ): Promise<string>;
    p2pkhToMultiMintFT(
      privateKey_from: PrivateKey,
      address_to: string
    ): Promise<string>;
    fromMultisigMintFt(
      address_from: string,
      address_to: string
    ): Promise<MultiTxRaw>;
    signfromMultisigMintFTTransaction(
      address_from: string,
      multiTxraw: MultiTxRaw,
      privateKey: PrivateKey
    ): string[];
    createFromMultisigMintFTTransaction(
      txraw: string,
      sigs: string[][],
      pubkeys: string
    ): Promise<string>;
    p2pkhToMultiFtTransfer(
      privateKey_from: PrivateKey,
      address_to: string,
      amount: number
    ): Promise<string>;
    fromMultisigTransferFt(
      privateKey_from: PrivateKey,
      address_from: string,
      address_to: string,
      amount: number
    ): Promise<MultiTxRaw>;
    signfromMultisigTransferFTTransaction(
      fromAddress: string,
      multiTxraw: MultiTxRaw,
      privateKey: PrivateKey
    ): string[];
    createFromMultisigTransferFTTransaction(
      txraw: string,
      sigs: string[][],
      pubkeys: string
    ): Promise<string>;
  }

  interface CollectionData {
    collectionName: string;
    description: string;
    supply: number;
    file: string;
  }

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
    nftAttributes: string;
    nftDescription: string;
    nftTransferTimeCount: number;
    nftIcon: string;
  }

  export class NFT {
    constructor(contract_id: string);
    initialize(network?: "testnet" | "mainnet"): Promise<void>;
    static createCollection(
      address: string,
      privateKey: PrivateKey,
      data: CollectionData,
      utxos: Transaction.IUnspentOutput[],
      network?: "testnet" | "mainnet"
    ): Promise<string>;
    static createNFT(
      collection_id: string,
      address: string,
      privateKey: PrivateKey,
      data: NFTData,
      utxos: Transaction.IUnspentOutput[],
      network?: "testnet" | "mainnet"
    ): Promise<string>;
    transferNFT(
      address_from: string,
      address_to: string,
      privateKey: PrivateKey,
      utxos: Transaction.IUnspentOutput[],
      network?: "testnet" | "mainnet"
    ): Promise<string>;
    // static encodeByBase64(filePath: string): Promise<string>;
    static selectUTXOs(
      address: string,
      amount_tbc: number,
      network?: "testnet" | "mainnet"
    ): Promise<Transaction.IUnspentOutput[]>;
    static broadcastTXraw(
      txraw: string,
      network?: "testnet" | "mainnet"
    ): Promise<string>;
  }

  export namespace poolNFT {
    interface PoolNFTInfo {
      ft_lp_amount: bigint;
      ft_a_amount: bigint;
      tbc_amount: bigint;
      ft_lp_partialhash: string;
      ft_a_partialhash: string;
      ft_a_contractTxid: string;
      poolnft_code: string;
      currentContractTxid: string;
      currentContractVout: number;
      currentContractSatoshi: number;
    }

    interface poolNFTDifference {
      ft_lp_difference: bigint;
      ft_a_difference: bigint;
      tbc_amount_difference: bigint;
    }
  }

  export class poolNFT {
    constructor(
      txidOrParams?:
        | string
        | { ftContractTxid: string; tbc_amount: number; ft_a: number }
    );
    initCreate(ftContractTxid?: string): Promise<void>;
    initfromContractId(): Promise<void>;
    createPoolNFT(privateKey_from: PrivateKey): Promise<string>;
    initPoolNFT(
      privateKey_from: PrivateKey,
      address_to: string,
      tbc_amount?: number,
      ft_a?: number
    ): Promise<string>;
    initCreate(ftContractTxid?: string): Promise<void>;
    initfromContractId(): Promise<void>;
    createPoolNFT(privateKey_from: PrivateKey): Promise<string>;
    initPoolNFT(
      privateKey_from: PrivateKey,
      address_to: string,
      tbc_amount?: number,
      ft_a?: number
    ): Promise<string>;
    increaseLP(
      privateKey_from: PrivateKey,
      address_to: string,
      amount_tbc: number
    ): Promise<string>;
    consumLP(
      privateKey_from: PrivateKey,
      address_to: string,
      amount_lp: number
    ): Promise<string>;
    swaptoToken(
      privateKey_from: PrivateKey,
      address_to: string,
      amount_token: number
    ): Promise<string>;
    swaptoTBC(
      privateKey_from: PrivateKey,
      address_to: string,
      amount_tbc: number
    ): Promise<string>;
    fetchPoolNFTInfo(contractTxid: string): Promise<poolNFT.PoolNFTInfo>;
    fetchPoolNftUTXO(contractTxid: string): Promise<Transaction.IUnspentOutput>;
    fetchFtlpUTXO(
      ftlpCode: string,
      amount: bigint
    ): Promise<Transaction.IUnspentOutput>;
    mergeFTLP(privateKey_from: PrivateKey): Promise<boolean>;
    mergeFTinPool(privateKey_from: PrivateKey): Promise<boolean>;
    getPoolNFTunlock(
      privateKey_from: PrivateKey,
      currentTX: Transaction,
      currentUnlockIndex: number,
      preTxId: string,
      preVout: number,
      option: 1 | 2 | 3 | 4,
      swapOption?: 1 | 2
    ): Promise<Script>;
    getPoolNftCode(txid: string, vout: number): Script;
    getFTLPcode(
      poolNftCodeHash: string,
      address: string,
      tapeSize: number
    ): Script;
  }

  export class Taproot {
    static wifToSeckey(wif: string): Buffer;
    static seckeyToWif(seckey: Buffer): string;
    static pubkeyGen(seckey: Buffer): Buffer;
    static pubkeyToLegacyAddress(pubKey: Buffer): string;
    static pubkeyToTaprootTweakPubkey(pubkey: Buffer): Buffer;
    static seckeyToTaprootTweakSeckey(seckey: Buffer): Buffer;
    static taprootAddressToTaprootTweakPubkey(taprootAddress: string): Buffer;
    static taprootTweakPubkeyToTaprootAddress(
      taprootTweakPublicKey: Buffer
    ): string;
    static taprootAddressToTaprootTweakLegacyAddress(
      taprootAddress: string
    ): string;
    static wifToTaprootAddress(wif: string): string;
  }
}
