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
   * @param {Object} bytes
   * @returns {BigInt}
   */
  static intFromBuffer(buffer) {
    return BigInt("0x" + buffer.toString("hex"));
  }

  /**
   *
   * @param {BigInt} int
   * @returns {Buffer}
   */
  static bufferFromInt(bigInt) {
    return Buffer.from(bigInt.toString(16), "hex");
  }

  /**
   *
   * @param {Object} obj1
   * @param {Object} obj2
   * @returns {boolean}
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
   * @param {{{x: BigInt, y: BigInt}}} point
   * @returns {boolean}
   */
  static hasEvenY(p) {
    if (p === null) throw Error("point is null !");
    return p.y % 2n === 0n;
  }

  /**
   *
   * @param {BigInt} x
   * @returns {[BigInt,]}
   */
  static liftX(x) {
    if (x >= P) return null;
    let y_sq = (x ** 3n + 7n) % P;
    // let y = modSqrt(y_sq, P);
    let y = Taproot.modExp(y_sq, (P + 1n) / 4n, P);
    if (y ** 2n % P !== y_sq) return null;
    return { x, y: y % 2n === 0n ? y : P - y };
  }

  /**
   *
   * @param {BigInt} a
   * @param {BigInt} mod
   * @returns {BigInt}
   *
   */
  // static modSqrt(a, mod) {
  //   if (a === 0n) return 0n;
  //   if (mod === 2n) return a % mod;
  //   let q = mod - 1n;
  //   let s = 0n;
  //   while (q % 2n === 0n) {
  //     q /= 2n;
  //     s += 1n;
  //   }
  //   let z = 2n;
  //   while (modExp(z, (mod - 1n) / 2n, mod) === 1n) {
  //     z += 1n;
  //   }
  //   let m = s;
  //   let c = modExp(z, q, mod);
  //   let t = modExp(a, q, mod);
  //   let r = modExp(a, (q + 1n) / 2n, mod);

  //   while (t !== 0n && t !== 1n) {
  //     let t2i = t;
  //     let i = 0n;
  //     while (t2i !== 1n) {
  //         t2i = modExp(t2i, 2n, mod);
  //         i += 1n;
  //     }
  //     let b = modExp(c, 2n ** (m - i - 1n), mod);
  //     m = i;
  //     c = modExp(b, 2n, mod);
  //     t = modExp(t, 2n ** i, mod);
  //     r = modMul(r, b, mod);
  //   }
  //   return t === 0n ? null : r;
  // }

  /**
   *
   * @param {BigInt} base
   * @param {BigInt} exp
   * @param {BigInt} mod
   * @returns {BigInt}
   */
  static modExp(base, exp, mod) {
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (exp % 2n === 1n) {
        res = Taproot.modMul(res, base, mod);
      }
      exp = exp / 2n;
      base = Taproot.modMul(base, base, mod);
    }
    return res;
  }

  /**
   *
   * @param {BigInt} a
   * @param {BigInt} b
   * @param {BigInt} mod
   * @returns
   */
  static modMul(a, b, mod) {
    return Taproot.modCheck((a * b) % mod, mod);
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
      const x = Taproot.modCheck(obj.x, mod);
      const y = Taproot.modCheck(obj.y, mod);
      res = { x, y };
    } else {
      throw Error("Wrong type !");
    }
    return res;
  }

  /**
   * point add static
   * @param {{x: BigInt, y: BigInt}} p
   * @param {{x: BigInt, y: BigInt}} q
   * @returns {{x: BigInt, y: BigInt}}
   */
  static pointAdd(p, q) {
    if (p === null) return q;
    if (q === null) return p;
    if (p.x === q.x && p.y !== q.y) return null;

    let lam;
    if (Taproot.isEqual(p, q)) {
      lam = (3n * p.x * p.x * Taproot.modExp(2n * p.y, P - 2n, P)) % P;
    } else {
      lam = ((q.y - p.y) * Taproot.modExp(q.x - p.x, P - 2n, P)) % P;
    }
    lam = Taproot.modCheck(lam, P);
    const x = (lam * lam - p.x - q.x) % P;
    const y = (lam * (p.x - x) - p.y) % P;

    return Taproot.modCheck({ x, y }, P);
  }

  /**
   *
   * @param {{x: BigInt, y: BigInt}} p
   * @param {BigInt} n
   * @returns {{x: BigInt, y: BigInt}}
   */
  static pointMul(p, n) {
    let res = null;
    let temp = p;
    while (n > 0n) {
      if (n % 2n === 1n) {
        res = Taproot.pointAdd(res, temp);
      }

      temp = Taproot.pointAdd(temp, temp);
      n /= 2n;
    }
    return res;
  }

  /**
   *
   * @param {Buffer} tag
   * @param {Buffer} msg
   * @returns {Buffer}
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
   * @param {Buffer} script
   * @returns {Buffer}
   */
  static serScript(script) {
    // need to achieve
    return script;
  }

  /**
   *
   * @param {Array} scriptTree
   * @returns
   */
  static taprootTreeHelper(scriptTree) {
    if (Array.isArray(scriptTree) && scriptTree.length === 2) {
      const [left, right] = scriptTree;
      let [leftTree, leftHash] = Taproot.taprootTreeHelper(left);
      let [rightTree, rightHash] = Taproot.taprootTreeHelper(right);

      const combinedTree = [
        ...leftTree.map(([leaf, leftConcat]) => [
          leaf,
          Buffer.concat([leftConcat, rightHash]),
        ]),
        ...rightTree.map(([leaf, rightConcat]) => [
          leaf,
          Buffer.concat([rightConcat, leftHash]),
        ]),
      ];

      if (leftHash.compare(rightHash) > 0) {
        [leftHash, rightHash] = [rightHash, leftHash]; // Swap hashes if needed
      }

      const branchHash = Taproot.taggedHash(
        "TapBranch",
        Buffer.concat([leftHash, rightHash])
      );
      return [combinedTree, branchHash];
    } else if (Array.isArray(scriptTree) && scriptTree.length === 2) {
      // Ensure that the leaf node is also an array with two elements
      const [leafVersion, script] = scriptTree;
      const scriptBuffer = Taproot.serScript(script);
      const leafHash = Taproot.taggedHash(
        "TapLeaf",
        Buffer.concat([Buffer.from([leafVersion]), scriptBuffer])
      );

      // Return a tuple of tree and hash
      return [[[leafVersion, script], Buffer.alloc(0)], leafHash];
    } else {
      throw new Error("Invalid scriptTree format");
    }
  }
  /**
   *
   * @param {String} wif
   * @returns {Buffer}
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
   * @returns {String}
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
   * @returns {Buffer}
   */
  static pubkeyGen(seckey) {
    if (!secp256k1.privateKeyVerify(seckey)) {
      throw new Error("Invalid seckey.");
    }
    const d0 = Taproot.intFromBuffer(seckey);
    if (d0 < 1n || d0 >= N) {
      throw Error("The secret key must be an integer in the range 1..n-1.");
    }
    const p = Taproot.pointMul(G, d0);
    if (p === null) throw Error("The point is null.");
    const prefix = Buffer.from(p.y % 2n === 0n ? "\x02" : "\x03");
    return Buffer.concat([prefix, Taproot.bufferFromInt(p.x)]);
  }

  /**
   *
   * @param {Buffer} pubkey
   * @param {Buffer} h
   * @returns {Buffer}
   */
  static taprootTweakPubkey(pubkey, h) {
    if (!Buffer.isBuffer(pubkey) || pubkey.length !== 33) {
      throw new Error("Invalid public key: must be a 33-byte Buffer.");
    }
    pubkey = Uint8Array.prototype.slice.call(pubkey, 1);
    const t = Taproot.intFromBuffer(
      Taproot.taggedHash("TapTweak", Buffer.concat([pubkey, h]))
    );
    if (t >= N) {
      throw new Error("Invalid tweak value");
    }

    const p = Taproot.liftX(Taproot.intFromBuffer(pubkey));
    if (p === null) {
      throw new Error("Invalid public key");
    }

    const q = Taproot.pointAdd(p, Taproot.pointMul(G, t));
    const prefix = Buffer.from(q.y % 2n === 0n ? "\x02" : "\x03");
    return Buffer.concat([prefix, Taproot.bufferFromInt(q.x)]);
  }

  /**
   *
   * @param {Buffer} pubkey
   * @param {Array} scriptTree
   * @returns {Buffer}
   */
  static pubkeyToTaprootTweakPubkey(pubkey) {
    let h = "";
    return Taproot.taprootTweakPubkey(pubkey, Buffer.from(h, "ascii"));
  }

  /**
   *
   * @param {Buffer} seckey
   * @param {Array} scriptTree
   * @returns {Buffer}
   */
  static seckeyToTaprootTweakSeckey(seckey) {
    let h = "";
    return Taproot.taprootTweakSeckey(seckey, Buffer.from(h, "ascii"));
  }

  /**
   *
   * @param {Buffer} seckey
   * @param {Buffer} h
   */
  static taprootTweakSeckey(seckey, h) {
    if (!secp256k1.privateKeyVerify(seckey)) {
      throw new Error("Invalid seckey.");
    }
    seckey = Taproot.intFromBuffer(seckey);
    const p = Taproot.pointMul(G, seckey);
    seckey = Taproot.hasEvenY(p) ? seckey : N - seckey;
    const t = Taproot.intFromBuffer(
      Taproot.taggedHash(
        "TapTweak",
        Buffer.concat([Taproot.bufferFromInt(p.x), h])
      )
    );
    if (t >= N) throw Error("value error !");
    return Taproot.bufferFromInt((seckey + t) % N);
  }

  /**
   *
   * @param {Buffer} data
   * @returns {String}
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
   * @param {String} bech32Address
   * @returns {Buffer}
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
   * @returns {Buffer}
   */
  static compressPubkey(pubkey) {
    if (pubkey.length === 33) return pubkey;
    const x = Uint8Array.prototype.slice.call(pubkey, 1, 33);
    const y = Uint8Array.prototype.slice.call(pubkey, 33, 65);
    const isEven = (y[31] & 0x01) === 0;
    const prefix = isEven ? Buffer.from([0x02]) : Buffer.from([0x03]);
    return Buffer.concat([prefix, x]);
  }

  // /**
  //  *
  //  * @param {Buffer} pubkey
  //  * @returns {String}
  //  */
  // static pubkeyToLegacyAddress(pubkey) {
  //   const compressedPubkey = compressPubkey(pubkey);
  //   return bitcoin.payments.p2pkh({pubkey: compressedPubkey}).address;
  // }

  /**
   *
   * @param {Buffer} pubkey
   * @returns
   */
  static pubkeyToLegacyAddress(pubkey) {
    const compressedPubkey = Taproot.compressPubkey(pubkey);
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
   * @param {Buffer} taprootTweakPublicKey
   * @returns {String}
   */
  static taprootTweakPubkeyToTaprootAddress(taprootTweakPublicKey) {
    return Taproot.bech32mEncode(taprootTweakPublicKey);
  }

  /**
   *
   * @param {String} taprootAddress
   * @returns {Buffer}
   */
  static taprootAddressToTaprootTweakPubkey(taprootAddress) {
    // default odd
    return Buffer.concat([
      Buffer.from([0x02]),
      Taproot.bech32mDecode(taprootAddress),
    ]);
  }

  /**
   *
   * @param {String} taprootAddress
   * @returns {String}
   */
  static taprootAddressToTaprootTweakLegacyAddress(taprootAddress) {
    const taprootTweakPubkey =
      Taproot.taprootAddressToTaprootTweakPubkey(taprootAddress);
    return Taproot.pubkeyToLegacyAddress(taprootTweakPubkey);
  }

  /**
   * wif to taproot
   * @param {String} wif
   * @returns {String}
   */
  static wifToTaprootAddress(wif) {
    const privateKeyHex = Taproot.wifToSeckey(wif);
    const publicKey = Taproot.pubkeyGen(privateKeyHex);
    const taprootTweakPubkey = Taproot.pubkeyToTaprootTweakPubkey(
      publicKey,
      null
    );
    return Taproot.taprootTweakPubkeyToTaprootAddress(taprootTweakPubkey);
  }
}

module.exports = Taproot;
