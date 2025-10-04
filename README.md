## Proof-Of-Post Core

Minimal, CLI-first tools that power Proof-Of-Post.

### Quickstart
```bash
git clone git@github.com:UTxOMaestro/Proof-Of-Post-Core.git
cd Proof-Of-Post-Core
npm install
```

### Tools
- Cardano on-chain posts fetcher: `scripts/onchain/fetch-cardano-posts.js`
  - Docs: `scripts/onchain/README.md`
  - Requires Blockfrost API key via `BLOCKFROST_API_KEY` (no defaults embedded)

- Signature proof bundle verifier: `scripts/proofs/verify-bundle.js`
  - Docs: `scripts/proofs/README.md`
  - Verifies Cardano (CIP-8) and Solana bundles


