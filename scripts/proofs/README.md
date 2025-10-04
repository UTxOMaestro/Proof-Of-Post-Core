Proof Bundle Verifier

This CLI verifies signature bundles copied from the app's “Copy proof bundle” action.

Supported formats
- Cardano (CIP-8):
  {
    "addressHex": "<addr hex or bech32>",
    "payloadHex": "<hex of canonical message>",
    "signatureHex": "<COSE_Sign1 hex>",
    "keyHex": "<COSE_Key hex>"
  }

- Solana:
  {
    "addressBase58": "<address>",
    "payloadUtf8": "<canonical message>",
    "signatureBase58": "<signature>",
    "pubkeyBase58": "<pubkey>"
  }

Install
```bash
# from repo root
npm install
```

Usage
```bash
# Cardano (argument)
node scripts/proofs/verify-bundle.js '{"addressHex":"...","payloadHex":"...","signatureHex":"...","keyHex":"..."}'

# Solana (stdin)
cat bundle.json | node scripts/proofs/verify-bundle.js
```

Output
- Prints a single JSON object: `{ ok: boolean, reason: string | null }`

Dependencies
- Cardano: `cbor`, `tweetnacl`, `blakejs`, `@emurgo/cardano-serialization-lib-nodejs`
- Solana: `tweetnacl`, `bs58`

Notes
- The Cardano verifier confirms the COSE_Sign1 signature and that the provided COSE_Key's payment key hash matches the supplied address.
- The Solana verifier checks the detached signature and that `pubkeyBase58` equals `addressBase58`.

