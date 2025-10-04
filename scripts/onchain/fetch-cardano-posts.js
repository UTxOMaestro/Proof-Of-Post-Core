#!/usr/bin/env node
/*
  Fetch on-chain posts for a Cardano address using Blockfrost.
  Looks for metadata label 674 with { type: "post", app: "proof-of-post", address, nonce, content }
*/

const https = require('https');

const BF = 'https://cardano-mainnet.blockfrost.io/api/v0';

function getApiKey() {
  // Only read from environment; never fall back to hard-coded keys
  return process.env.BLOCKFROST_API_KEY
    || process.env.BLOCKFROST_KEY
    || process.env.blockfrost_key
    || '';
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function resolveChunked(value) {
  if (Array.isArray(value)) return value.join('');
  if (value == null) return '';
  return String(value);
}

function isValidPostMetadata(md) {
  if (!md || typeof md !== 'object') return false;
  const type = resolveChunked(md.type);
  const app = resolveChunked(md.app);
  const address = resolveChunked(md.address);
  const nonce = resolveChunked(md.nonce);
  const content = resolveChunked(md.content);
  return type === 'post' && app === 'proof-of-post' && !!address && !!nonce && !!content;
}

async function main() {
  const address = process.argv[2];
  if (!address || !address.startsWith('addr')) {
    console.error('Usage: node scripts/onchain/fetch-cardano-posts.js <bech32_address>');
    process.exit(1);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Missing Blockfrost API key. Set BLOCKFROST_API_KEY.');
    process.exit(1);
  }

  const H = { 'project_id': apiKey, 'Content-Type': 'application/json' };

  console.error(`Scanning transactions for address: ${address}`);
  const perPage = 100;
  let page = 1;
  const results = [];

  while (true) {
    const txsUrl = `${BF}/addresses/${encodeURIComponent(address)}/transactions?page=${page}&count=${perPage}&order=desc`;
    let txs;
    try {
      txs = await fetchJson(txsUrl, H);
    } catch (e) {
      console.error(`Error fetching transactions (page ${page}):`, e.message);
      break;
    }
    if (!Array.isArray(txs) || txs.length === 0) break;

    for (const tx of txs) {
      const hash = tx.tx_hash || tx.hash || tx;
      if (!hash) continue;

      // Fetch metadata and basic tx info
      const metaUrl = `${BF}/txs/${encodeURIComponent(hash)}/metadata`;
      const infoUrl = `${BF}/txs/${encodeURIComponent(hash)}`;
      let items = null;
      let info = null;
      try {
        items = await fetchJson(metaUrl, H);
      } catch (e) {
        // ignore and continue
      }
      try {
        info = await fetchJson(infoUrl, H);
      } catch (e) {}

      if (Array.isArray(items) && items.length) {
        const m674 = items.find((it) => String(it && it.label) === '674');
        const md = m674 && (m674.json_metadata || m674.metadata);
        if (isValidPostMetadata(md)) {
          const mdAddress = resolveChunked(md.address);
          if (mdAddress === address) {
            const content = resolveChunked(md.content);
            const nonce = resolveChunked(md.nonce);
            const at = info && typeof info.block_time === 'number' ? new Date(info.block_time * 1000).toISOString() : null;
            results.push({ tx_hash: hash, date: at, content, address: mdAddress, nonce });
          }
        }
      }

      // gentle pacing to respect rate limits
      await sleep(50);
    }

    if (txs.length < perPage) break;
    page += 1;
    // brief pause between pages
    await sleep(150);
  }

  // Sort by date ascending (oldest first)
  results.sort((a, b) => {
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return ta - tb;
  });

  // Print as NDJSON for easy processing
  for (const r of results) {
    console.log(JSON.stringify(r));
  }
  console.error(`Found ${results.length} on-chain posts for ${address}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


