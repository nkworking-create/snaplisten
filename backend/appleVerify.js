// App Store Server API client.
// Docs: https://developer.apple.com/documentation/appstoreserverapi
//
// We query Apple directly using a signed ES256 JWT, so the response is
// trusted by virtue of TLS + Apple authentication — no signed-payload
// verification needed on top.

const jwt = require('jsonwebtoken');

const KEY_ID = process.env.APPLE_KEY_ID || '';
const ISSUER_ID = process.env.APPLE_ISSUER_ID || '';
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'app.snaplisten';
const PRIVATE_KEY_B64 = process.env.APPLE_PRIVATE_KEY_BASE64 || '';

const PROD = 'https://api.storekit.itunes.apple.com';
const SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

function privateKeyPem() {
  if (!PRIVATE_KEY_B64) throw new Error('APPLE_PRIVATE_KEY_BASE64 not set');
  return Buffer.from(PRIVATE_KEY_B64, 'base64').toString('utf8');
}

function makeJwt() {
  return jwt.sign({}, privateKeyPem(), {
    algorithm: 'ES256',
    expiresIn: '20m',
    issuer: ISSUER_ID,
    audience: 'appstoreconnect-v1',
    subject: BUNDLE_ID,
    keyid: KEY_ID,
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  });
}

function decodeJwsPayload(jws) {
  const parts = String(jws).split('.');
  if (parts.length !== 3) throw new Error('invalid signed payload');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

async function tryFetch(base, path, token) {
  return fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

// Look up a single transaction by its ID. Returns decoded payload
// (productId, expiresDate, originalTransactionId, etc).
async function getTransactionInfo(transactionId) {
  if (!transactionId) throw new Error('transactionId required');
  const token = makeJwt();
  const p = `/inApps/v1/transactions/${encodeURIComponent(transactionId)}`;
  // Try production first; fall back to sandbox (TestFlight / StoreKit testing use sandbox).
  for (const base of [PROD, SANDBOX]) {
    const r = await tryFetch(base, p, token);
    if (r.ok) {
      const j = await r.json();
      return decodeJwsPayload(j.signedTransactionInfo);
    }
    if (r.status !== 404 && r.status !== 401) {
      const detail = await r.text().catch(() => '');
      throw new Error(`Apple ${r.status}: ${detail.slice(0, 200)}`);
    }
  }
  throw new Error('transaction_not_found');
}

// Look up the current subscription state by the ORIGINAL transaction id.
// Returns the latest transaction payload (up-to-date expiresDate after renewals).
async function getLatestSubscriptionTx(originalTransactionId) {
  if (!originalTransactionId) throw new Error('originalTransactionId required');
  const token = makeJwt();
  const p = `/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
  for (const base of [PROD, SANDBOX]) {
    const r = await tryFetch(base, p, token);
    if (r.ok) {
      const j = await r.json();
      let latest = null;
      for (const grp of j.data || []) {
        for (const item of grp.lastTransactions || []) {
          const pl = decodeJwsPayload(item.signedTransactionInfo);
          if (!latest || (pl.expiresDate || 0) > (latest.expiresDate || 0)) latest = pl;
        }
      }
      if (latest) return latest;
    }
    if (r.status !== 404 && r.status !== 401) {
      const detail = await r.text().catch(() => '');
      throw new Error(`Apple ${r.status}: ${detail.slice(0, 200)}`);
    }
  }
  throw new Error('subscription_not_found');
}

function isAppleConfigured() {
  return !!(KEY_ID && ISSUER_ID && PRIVATE_KEY_B64);
}

module.exports = {
  getTransactionInfo,
  getLatestSubscriptionTx,
  isAppleConfigured,
  APPLE_BUNDLE_ID: BUNDLE_ID,
};
