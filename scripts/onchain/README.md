On-chain Posts Fetcher (Cardano)

This CLI scans transactions for a Cardano bech32 address using Blockfrost and extracts on-chain posts authored by that address.

What it looks for
- Metadata label: 674
- JSON keys: type, app, address, nonce, content
- Required values: type="post", app="proof-of-post"
- Strings may be chunked (arrays of 64-char strings); the tool stitches them back together

Security and prerequisites
- You MUST provide a Blockfrost mainnet API key via environment variable. No defaults are embedded in code.
- Supported env var names (checked in this order):
  - BLOCKFROST_API_KEY (preferred)
  - BLOCKFROST_KEY
  - blockfrost_key

Install
```bash
# from repo root
npm install
```

Usage
```bash
export BLOCKFROST_API_KEY=your_blockfrost_key
node scripts/onchain/fetch-cardano-posts.js <bech32_address>
# Example
node scripts/onchain/fetch-cardano-posts.js addr1...
```

Output
- NDJSON lines: one JSON object per post with fields `tx_hash`, `date` (ISO), `content`, `address`, `nonce`.

Notes
- Filters posts where `metadata.address` exactly matches the provided bech32 address.
- Paginates transactions and rate-limits metadata fetches to respect Blockfrost limits.

