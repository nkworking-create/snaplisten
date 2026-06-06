// Server-side entitlement map: installId → { proUntil, originalTransactionId, productId }.
// File-backed best-effort persistence. When lost, clients re-verify on next launch
// via the Restore path, so this is a cache, not the source of truth.

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'entitlements.json');

let store = {};
try {
  if (fs.existsSync(STORE_PATH)) store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
} catch (e) { console.warn('entitlements: load failed', e?.message); }

let saveQueued = false;
function queueSave() {
  if (saveQueued) return;
  saveQueued = true;
  setTimeout(() => {
    saveQueued = false;
    try { fs.writeFileSync(STORE_PATH, JSON.stringify(store), 'utf8'); }
    catch (e) { console.warn('entitlements: save failed', e?.message); }
  }, 250);
}

function setEntitlement(installId, { proUntil, originalTransactionId, productId }) {
  if (!installId) return;
  store[installId] = {
    proUntil: Number(proUntil) || 0,
    originalTransactionId,
    productId,
    updatedAt: Date.now(),
  };
  queueSave();
}

function getEntitlement(installId) {
  const e = store[installId];
  if (!e) return null;
  if (!e.proUntil || e.proUntil < Date.now()) return null; // expired
  return e;
}

function isPro(installId) {
  return !!getEntitlement(installId);
}

function clearEntitlement(installId) {
  delete store[installId];
  queueSave();
}

// Monthly char cap on Pro voice synthesis. Cap is per calendar month (UTC).
// Cache hits don't consume — only NEW ElevenLabs chars do.
function consumeProChars(installId, chars) {
  const cap = Number(process.env.PRO_MONTHLY_CHARS || 20000);
  const e = store[installId];
  if (!e) return { ok: false, error: 'not_pro' };
  if (!e.proUntil || e.proUntil < Date.now()) return { ok: false, error: 'not_pro' };
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (!e.usage || e.usage.month !== month) e.usage = { month, chars: 0 };
  if (e.usage.chars + chars > cap) {
    return { ok: false, error: 'pro_quota', count: e.usage.chars, cap };
  }
  e.usage.chars += chars;
  queueSave();
  return { ok: true, count: e.usage.chars, cap };
}

module.exports = { setEntitlement, getEntitlement, isPro, clearEntitlement, consumeProChars };
