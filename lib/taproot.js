const secp256k1 = require("secp256k1");
const bech32m = require("bech32").bech32m;
const bs58 = require("bs58");
const crypto = require("crypto");

const P = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F"
);
const N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
);
const G = {
  x: BigInt(
    "0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"
  ),
  y: BigInt(
    "0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"
  ),
};

class Taproot {
  /**
   *
   * @param {Buffer} buffer
   * @returns {BigInt} bigint
   */
  static intFromBuffer(buffer) {
    return BigInt("0x" + buffer.toString("hex"));
  }

  /**
   *
   * @param {BigInt} bigInt
   * @returns {Buffer} buffer
   */
  static bufferFromInt(bigInt) {
    const buffer = Buffer.alloc(32); // 32 bytes buffer
    const numBuf = Buffer.from(bigInt.toString(16).padStart(64, "0"), "hex");
    numBuf.copy(buffer, 32 - numBuf.length); // right align
    return buffer;
  }

  /**
   *
   * @param {Object} obj1
   * @param {Object} obj2
   * @returns {boolean} true or false
   */
  static isEqual(obj1, obj2) {
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
      return false;
    }
    for (let key in obj1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }
    return true;
  }

  /**
   *
   * @param {{x: BigInt, y: BigInt}} point
   * @returns {boolean} Is y even?
   */
  static hasEvenY(point) {
    if (point === null) throw Error("point is null !");
    return point.y % 2n === 0n;
  }

  /**
   *
   * @param {BigInt} x
   * @returns {{x: BigInt, y: BigInt}} point
   */
  static liftX(x) {
    if (x >= P) return null;
    let y_sq = (x ** 3n + 7n) % P;
    // let y = modSqrt(y_sq, P);
    let y = this.modExp(y_sq, (P + 1n) / 4n, P);
    if (y ** 2n % P !== y_sq) return null;
    return { x, y: y % 2n === 0n ? y : P - y };
  }

  /**
   *
   * @param {BigInt} base
   * @param {BigInt} exp
   * @param {BigInt} mod
   * @returns {BigInt} exp result
   */
  static modExp(base, exp, mod) {
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (exp % 2n === 1n) {
        res = this.modMul(res, base, mod);
      }
      exp = exp / 2n;
      base = this.modMul(base, base, mod);
    }
    return res;
  }

  /**
   *
   * @param {BigInt} a
   * @param {BigInt} b
   * @param {BigInt} mod
   * @returns mul result
   */
  static modMul(a, b, mod) {
    return this.modCheck((a * b) % mod, mod);
  }

  /**
   *
   * @param {Object} obj
   * @returns {Object}
   */
  static modCheck(obj, mod) {
    let res = obj;
    if (typeof obj === "bigint") {
      if (obj < 0n) res = obj + mod;
    } else if (typeof obj === "object") {
      const x = this.modCheck(obj.x, mod);
      const y = this.modCheck(obj.y, mod);
      res = { x, y };
    } else {
      throw Error("Wrong type !");
    }
    return res;
  }

  /**
   * point add function
   * @param {{x: BigInt, y: BigInt}} p
   * @param {{x: BigInt, y: BigInt}} q
   * @returns {{x: BigInt, y: BigInt}} add result
   */
  static pointAdd(p, q) {
    if (p === null) return q;
    if (q === null) return p;
    if (p.x === q.x && p.y !== q.y) return null;

    let lam;
    if (this.isEqual(p, q)) {
      lam = (3n * p.x * p.x * this.modExp(2n * p.y, P - 2n, P)) % P;
    } else {
      lam = ((q.y - p.y) * this.modExp(q.x - p.x, P - 2n, P)) % P;
    }
    lam = this.modCheck(lam, P);
    const x = (lam * lam - p.x - q.x) % P;
    const y = (lam * (p.x - x) - p.y) % P;

    return this.modCheck({ x, y }, P);
  }

  /**
   *
   * @param {{x: BigInt, y: BigInt}} p
   * @param {BigInt} n
   * @returns {{x: BigInt, y: BigInt}} pointMul result
   */
  static pointMul(p, n) {
    let res = null;
    let temp = p;
    while (n > 0n) {
      if (n % 2n === 1n) {
        res = this.pointAdd(res, temp);
      }

      temp = this.pointAdd(temp, temp);
      n /= 2n;
    }
    return res;
  }

  /**
   *
   * @param {Buffer} tag
   * @param {Buffer} msg
   * @returns {Buffer} taggedHash result
   */
  static taggedHash(tag, msg) {
    const tagHash = crypto.createHash("sha256").update(tag).digest();
    return crypto
      .createHash("sha256")
      .update(Buffer.concat([tagHash, tagHash, msg]))
      .digest();
  }

  /**
   *
   * @param {string} wif
   * @returns {Buffer} hex format seckey
   */
  static wifToSeckey(wif) {
    const decoded = bs58.decode(wif);
    // console.log(decoded)
    const prefix = decoded[0];
    if (prefix !== 128) {
      throw Error("Prefix is not 0x80.");
    }
    const seckey = decoded.slice(1, -5);
    const checksum = decoded.slice(-4);
    const hash1 = crypto
      .createHash("sha256")
      .update(decoded.slice(0, -4))
      .digest();
    const hash2 = crypto.createHash("sha256").update(hash1).digest();
    if (
      Buffer.from(checksum).compare(
        Uint8Array.prototype.slice.call(hash2, 0, 4)
      ) !== 0
    ) {
      throw new Error("Invalid WIF: checksum does not match.");
    }

    return Buffer.from(seckey);
  }

  /**
   *
   * @param {Buffer} seckey
   * @returns {string} wif format seckey
   */
  static seckeyToWif(seckey) {
    if (!secp256k1.privateKeyVerify(seckey)) {
      throw new Error("Invalid seckey.");
    }
    const prefix = Buffer.from([0x80]);
    const post = Buffer.from([0x01]);
    const extendedKey = Buffer.concat([prefix, seckey, post]);
    const hash1 = crypto.createHash("sha256").update(extendedKey).digest();
    const hash2 = crypto.createHash("sha256").update(hash1).digest();
    const checksum = Uint8Array.prototype.slice.call(hash2, 0, 4);
    const wifKey = Buffer.concat([extendedKey, checksum]);
    return bs58.encode(wifKey);
  }

  /**
   *
   * @param {Buffer} seckey
   * @returns {Buffer} compressed pubkey
   */
  static pubkeyGen(seckey) {
    if (!secp256k1.privateKeyVerify(seckey)) {
      throw new Error("Invalid seckey.");
    }
    const d0 = this.intFromBuffer(seckey);
    if (d0 < 1n || d0 >= N) {
      throw Error("The secret key must be an integer in the range 1..n-1.");
    }
    const p = this.pointMul(G, d0);
    if (p === null) throw Error("The point is null.");
    const prefix = Buffer.from(p.y % 2n === 0n ? "\x02" : "\x03");
    return Buffer.concat([prefix, this.bufferFromInt(p.x)]);
  }

  /**
   *
   * @param {Buffer} pubkey
   * @returns {Buffer} tapTweakPubkey
   */
  static pubkeyToTaprootTweakPubkey(pubkey) {
    let script = "";
    const h = Buffer.from(script, "ascii");

    if (!Buffer.isBuffer(pubkey) || pubkey.length !== 33) {
      throw new Error("Invalid public key: must be a 33-byte Buffer.");
    }
    pubkey = Uint8Array.prototype.slice.call(pubkey, 1);
    const t = this.intFromBuffer(
      this.taggedHash("TapTweak", Buffer.concat([pubkey, h]))
    );
    if (t >= N) {
      throw new Error("Invalid tweak value");
    }

    const p = this.liftX(this.intFromBuffer(pubkey));
    if (p === null) {
      throw new Error("Invalid public key");
    }

    const q = this.pointAdd(p, this.pointMul(G, t));
    // const prefix = Buffer.from(q.y % 2n === 0n ? '\x02': '\x03');
    const prefix = Buffer.from([0x02]);
    return Buffer.concat([prefix, this.bufferFromInt(q.x)]);
  }

  /**
   *
   * @param {Buffer} seckey
   * @returns {Buffer} tapTweakSeckey
   */
  static seckeyToTaprootTweakSeckey(seckey) {
    let script = "";
    const h = Buffer.from(script, "ascii");

    if (!secp256k1.privateKeyVerify(seckey)) {
      throw new Error("Invalid seckey.");
    }
    seckey = this.intFromBuffer(seckey);
    const p = this.pointMul(G, seckey);
    seckey = this.hasEvenY(p) ? seckey : N - seckey;
    const t = this.intFromBuffer(
      this.taggedHash("TapTweak", Buffer.concat([this.bufferFromInt(p.x), h]))
    );
    if (t >= N) throw Error("value error !");
    let tapTweakSeckey = this.bufferFromInt((seckey + t) % N);
    if (this.pubkeyGen(tapTweakSeckey)[0] === 3) {
      tapTweakSeckey = this.bufferFromInt(
        (N - this.intFromBuffer(tapTweakSeckey)) % N
      );
    }
    return tapTweakSeckey;
  }

  /**
   *
   * @param {Buffer} data
   * @returns {string} taproot
   */
  static bech32mEncode(data) {
    // need 32 bytes
    if (data.length !== 32) {
      if (data.length === 33) {
        data = Uint8Array.prototype.slice.call(data, 1);
      } else {
        throw Error("Invalid buffer length.");
      }
    }
    const prefix = "bc";
    const version = 1;
    const words = bech32m.toWords(data);
    words.unshift(version);
    return bech32m.encode(prefix, words);
  }

  /**
   *
   * @param {string} bech32Address
   * @returns {Buffer} pubkey
   */
  static bech32mDecode(bech32Address) {
    const { prefix, words } = bech32m.decode(bech32Address);
    if (prefix !== "bc") {
      throw Error("Invalid prefix.");
    }
    const version = words[0];
    if (version !== 1) {
      throw Error("Invalid version.");
    }
    // console.log(words);
    const data = bech32m.fromWords(words.slice(1));

    return Buffer.from(data);
  }

  /**
   *
   * @param {Buffer} pubkey
   * @returns {Buffer} compressed pubkey
   */
  static compressPubkey(pubkey) {
    if (pubkey.length === 33) return pubkey;
    const x = Uint8Array.prototype.slice.call(pubkey, 1, 33);
    const y = Uint8Array.prototype.slice.call(pubkey, 33, 65);
    const isEven = (y[31] & 0x01) === 0;
    const prefix = isEven ? Buffer.from([0x02]) : Buffer.from([0x03]);
    return Buffer.concat([prefix, x]);
  }

  /**
   *
   * @param {Buffer} pubkey
   * @returns {string} legacy address
   */
  static pubkeyToLegacyAddress(pubkey) {
    const compressedPubkey = this.compressPubkey(pubkey);
    const sha256Hash = crypto
      .createHash("sha256")
      .update(compressedPubkey)
      .digest();
    const ripemd160Hash = crypto
      .createHash("ripemd160")
      .update(sha256Hash)
      .digest();
    const versionedPayload = Buffer.concat([
      Buffer.from(["\x00"]),
      ripemd160Hash,
    ]);
    const checksum = crypto
      .createHash("sha256")
      .update(crypto.createHash("sha256").update(versionedPayload).digest())
      .digest();
    const checksum4 = Uint8Array.prototype.slice.call(checksum, 0, 4);
    const addressBuffer = Buffer.concat([versionedPayload, checksum4]);
    const address = bs58.encode(addressBuffer);
    return address;
  }

  /**
   *
   * @param {Buffer} tapTweakPublicKey
   * @returns {string} taproot address
   */
  static taprootTweakPubkeyToTaprootAddress(tapTweakPublicKey) {
    return this.bech32mEncode(tapTweakPublicKey);
  }

  /**
   *
   * @param {string} taprootAddress
   * @returns {Buffer} odd and even pubkey
   */
  static taprootAddressToTaprootTweakPubkey(taprootAddress) {
    // default even
    return Buffer.concat([
      Buffer.from([0x02]),
      this.bech32mDecode(taprootAddress),
    ]);
  }

  /**
   *
   * @param {string} taprootAddress
   * @returns {string} TapTweakLegacyAddress
   */
  static taprootAddressToTaprootTweakLegacyAddress(taprootAddress) {
    const tapTweakPubkey =
      this.taprootAddressToTaprootTweakPubkey(taprootAddress);
    return this.pubkeyToLegacyAddress(tapTweakPubkey);
  }

  /**
   * wif to taproot
   * @param {string} wif
   * @returns {string} taproot address
   */
  static wifToTaprootAddress(wif) {
    const seckey = this.wifToSeckey(wif);
    const pubkey = this.pubkeyGen(seckey);
    const tapTweakPubkey = this.pubkeyToTaprootTweakPubkey(pubkey);
    return this.taprootTweakPubkeyToTaprootAddress(tapTweakPubkey);
  }
}

module.exports = Taproot;
