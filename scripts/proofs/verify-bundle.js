#!/usr/bin/env node
/*
  Verify signature proof bundles exported by the app.

  Supports two bundle formats:
  - Cardano (CIP-8): { addressHex|addressBech32, payloadHex, signatureHex, keyHex }
  - Solana: { addressBase58, payloadUtf8, signatureBase58, pubkeyBase58 }

  Usage:
    node scripts/proofs/verify-bundle.js '{"addressHex":"...","payloadHex":"...","signatureHex":"...","keyHex":"..."}'
    cat bundle.json | node scripts/proofs/verify-bundle.js
*/

const fs = require('fs');

async function verifyCardano(bundle) {
  const cbor = require('cbor');
  const nacl = require('tweetnacl');
  const blake = require('blakejs');
  const hexToBuf = (h) => Buffer.from(h, 'hex');
  const payKeyHashFromPub = (pub) => Buffer.from(blake.blake2b(pub, undefined, 28));

  async function payKeyHashFromAddr(addrStr) {
    const Cardano = await import('@emurgo/cardano-serialization-lib-nodejs');
    const { Address, BaseAddress, EnterpriseAddress } = Cardano;
    const addr = addrStr.startsWith('addr')
      ? Address.from_bech32(addrStr)
      : Address.from_bytes(hexToBuf(addrStr));
    const base = BaseAddress.from_address(addr);
    if (base) return Buffer.from(base.payment_cred().to_keyhash().to_bytes());
    const ent = EnterpriseAddress.from_address(addr);
    if (ent) return Buffer.from(ent.payment_cred().to_keyhash().to_bytes());
    throw new Error('Unsupported address');
  }

  const address = bundle.addressHex || bundle.addressBech32 || bundle.address;
  if (!address || !bundle.payloadHex || !bundle.signatureHex || !bundle.keyHex) {
    return { ok: false, reason: 'Missing fields for Cardano bundle' };
  }

  try {
    const sign1 = cbor.decode(hexToBuf(bundle.signatureHex));
    if (!Array.isArray(sign1) || sign1.length !== 4) throw new Error('Bad COSE_Sign1');
    const protectedBytes = sign1[0], payload = sign1[2], sig = sign1[3];
    if (!Buffer.isBuffer(protectedBytes) || !Buffer.isBuffer(payload) || !Buffer.isBuffer(sig))
      throw new Error('Malformed COSE_Sign1');

    const toBeSigned = cbor.encode(['Signature1', protectedBytes, Buffer.alloc(0), payload]);

    const coseKey = cbor.decode(hexToBuf(bundle.keyHex));
    if (!(coseKey instanceof Map)) throw new Error('Bad COSE_Key');
    const pub = coseKey.get(-2);
    if (!Buffer.isBuffer(pub) || pub.length !== 32) throw new Error('Missing pubkey');

    const ok = nacl.sign.detached.verify(
      new Uint8Array(toBeSigned),
      new Uint8Array(sig),
      new Uint8Array(pub)
    );
    if (!ok) return { ok: false, reason: 'Invalid signature' };

    const want = await payKeyHashFromAddr(address);
    const got  = payKeyHashFromPub(new Uint8Array(pub));
    if (!Buffer.from(want).equals(got)) return { ok: false, reason: 'Pubkey does not match address payment keyhash' };

    if (!Buffer.from(payload).equals(hexToBuf(bundle.payloadHex))) return { ok: false, reason: 'Payload mismatch' };

    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: e?.message || 'Verify error' };
  }
}

async function verifySolana(bundle) {
  const { default: bs58 } = await import('bs58');
  const { default: nacl } = await import('tweetnacl');
  // If payloadUtf8 is not canonical message, we cannot reconstruct.
  // We only verify raw signature over provided payloadUtf8 to match server bundle.
  const payloadUtf8 = bundle.payloadUtf8;
  const sigBase58 = bundle.signatureBase58;
  const pubkeyBase58 = bundle.pubkeyBase58;
  const addressBase58 = bundle.addressBase58 || bundle.address;
  if (!payloadUtf8 || !sigBase58 || !pubkeyBase58 || !addressBase58) {
    return { ok: false, reason: 'Missing fields for Solana bundle' };
  }
  try {
    const msgBytes = new TextEncoder().encode(payloadUtf8);
    const sigBytes = bs58.decode(sigBase58);
    const pubkeyBytes = bs58.decode(pubkeyBase58);
    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!ok) return { ok: false, reason: 'Invalid signature' };
    if (pubkeyBase58 !== addressBase58) return { ok: false, reason: 'Public key does not match address' };
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: e?.message || 'Verify failed' };
  }
}

async function main() {
  let input = process.argv[2];
  if (!input) {
    input = fs.readFileSync(0, 'utf8');
  }
  input = input.trim();
  if (!input) {
    console.error('Provide a JSON bundle as an argument or via stdin');
    process.exit(1);
  }
  let bundle;
  try {
    bundle = JSON.parse(input);
  } catch (e) {
    console.error('Invalid JSON input');
    process.exit(1);
  }

  // Detect format
  const isCardano = !!(bundle.signatureHex || bundle.keyHex || bundle.payloadHex);
  const isSolana = !!(bundle.signatureBase58 || bundle.pubkeyBase58 || bundle.payloadUtf8);

  if (!isCardano && !isSolana) {
    console.log(JSON.stringify({ ok: false, reason: 'Unknown bundle format' }));
    process.exit(0);
  }

  let result;
  if (isCardano) {
    result = await verifyCardano(bundle);
  } else {
    result = await verifySolana(bundle);
  }

  console.log(JSON.stringify(result));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


