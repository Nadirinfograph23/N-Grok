import { getPublicKey, sign, hashes } from "@noble/secp256k1";
import { createHash, createHmac } from "crypto";

// Configure sync hash functions required by @noble/secp256k1
hashes.sha256 = (msg: Uint8Array): Uint8Array => {
  return new Uint8Array(createHash("sha256").update(msg).digest());
};
hashes.hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
  return new Uint8Array(
    createHmac("sha256", key).update(message).digest()
  );
};

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

function xorEncode(privateKeyBytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < privateKeyBytes.length; i++) {
    raw += String.fromCharCode(privateKeyBytes[i]);
  }
  return Buffer.from(raw, "latin1").toString("base64");
}

export function generateKeys(): {
  privateKey: string;
  userPublicKey: number[];
} {
  const privBytes = new Uint8Array(32);
  crypto.getRandomValues(privBytes);

  const pubKey = getPublicKey(privBytes, true);
  const publicKeyArray = Array.from(pubKey);
  const encodedPriv = xorEncode(privBytes);

  return {
    privateKey: encodedPriv,
    userPublicKey: publicKeyArray,
  };
}

export function signChallenge(
  challengeData: Uint8Array,
  keyBase64: string
): { challenge: string; signature: string } {
  const keyBytes = Buffer.from(keyBase64, "base64");
  const digest = sha256(challengeData);
  const sigBytes = sign(digest, new Uint8Array(keyBytes), { prehash: false });
  const sig64 = sigBytes.slice(0, 64);

  return {
    challenge: Buffer.from(challengeData).toString("base64"),
    signature: Buffer.from(sig64).toString("base64"),
  };
}
