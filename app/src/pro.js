import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyReceipt, getProStatus } from './api';

// expo-iap is a native module; in Expo Go it can't load. Wrap in try/catch
// and run with a dev fallback so the Paywall UI still works for testing.
let IAP = null;
try { IAP = require('expo-iap'); } catch { /* not available — dev/Expo Go */ }

export const PRODUCT_MONTHLY = 'app.snaplisten.pro.monthly';
export const PRODUCT_YEARLY = 'app.snaplisten.pro.yearly';
const PRODUCT_IDS = [PRODUCT_MONTHLY, PRODUCT_YEARLY];

const ENTITLEMENT_KEY = 'snaplisten.pro.v1';

let state = {
  isPro: false,
  products: [],
  ready: false,
  busy: false,
  native: !!IAP, // false in Expo Go → dev fallback
};
const listeners = new Set();
function notify() { for (const fn of listeners) fn(state); }
function patch(p) { state = { ...state, ...p }; notify(); }

export function getState() { return state; }
export function isPro() { return state.isPro; }

export function usePro() {
  const [, set] = useState(state);
  useEffect(() => {
    listeners.add(set);
    return () => listeners.delete(set);
  }, []);
  return state;
}

let purchaseSub = null;
let errorSub = null;

export async function initPro() {
  // 1) Restore cached entitlement so Pro works offline / on cold start.
  try {
    const cached = await AsyncStorage.getItem(ENTITLEMENT_KEY);
    if (cached === 'true') patch({ isPro: true });
  } catch { /* ignore */ }

  // 2) Sync with the server (source of truth). Falls back silently if offline.
  try {
    const status = await getProStatus();
    if (typeof status?.entitled === 'boolean') await setPro(!!status.entitled);
  } catch { /* offline / not reachable — keep cached state */ }

  // 3) If native IAP is unavailable (Expo Go), stop here.
  if (!IAP) { patch({ ready: true }); return; }

  try {
    await IAP.initConnection();

    // Subscribe to purchase lifecycle events.
    if (IAP.purchaseUpdatedListener) {
      purchaseSub = IAP.purchaseUpdatedListener(async (purchase) => {
        await handlePurchase(purchase);
      });
    }
    if (IAP.purchaseErrorListener) {
      errorSub = IAP.purchaseErrorListener(() => {
        patch({ busy: false });
      });
    }

    // 3) Fetch product info.
    const subs = await IAP.getSubscriptions({ skus: PRODUCT_IDS });
    patch({ products: subs || [] });

    // 4) Silent restore so prior subscribers stay Pro.
    const available = await IAP.getAvailablePurchases();
    if (available && available.length > 0) {
      const ok = await verifyWithBackend(available);
      if (ok) await setPro(true);
    }
  } catch (e) {
    console.warn('pro.init failed:', e?.message);
  } finally {
    patch({ ready: true });
  }
}

export async function shutdownPro() {
  try { purchaseSub?.remove?.(); } catch { /* ignore */ }
  try { errorSub?.remove?.(); } catch { /* ignore */ }
  try { await IAP?.endConnection?.(); } catch { /* ignore */ }
}

export async function purchase(productId) {
  if (!IAP) {
    // Dev fallback (Expo Go): grant locally so the UI can be exercised.
    await setPro(true);
    return { ok: true, dev: true };
  }
  patch({ busy: true });
  try {
    await IAP.requestSubscription({ sku: productId });
    // Result is delivered via purchaseUpdatedListener.
    return { ok: true };
  } catch (e) {
    patch({ busy: false });
    return { ok: false, error: e?.message };
  }
}

export async function restore() {
  if (!IAP) {
    // Dev fallback: pretend restore succeeded only if we already had Pro cached.
    return { ok: true, restored: state.isPro, dev: true };
  }
  patch({ busy: true });
  try {
    const available = await IAP.getAvailablePurchases();
    if (!available || available.length === 0) {
      await setPro(false);
      return { ok: true, restored: false };
    }
    const ok = await verifyWithBackend(available);
    if (ok) await setPro(true);
    return { ok, restored: ok };
  } catch (e) {
    return { ok: false, error: e?.message };
  } finally {
    patch({ busy: false });
  }
}

async function handlePurchase(purchase) {
  try {
    const ok = await verifyWithBackend([purchase]);
    if (ok) await setPro(true);
    // Acknowledge to Apple so it stops re-delivering.
    if (IAP?.finishTransaction) {
      try { await IAP.finishTransaction({ purchase, isConsumable: false }); } catch { /* ignore */ }
    }
  } catch (e) {
    console.warn('pro.handlePurchase failed:', e?.message);
  } finally {
    patch({ busy: false });
  }
}

async function setPro(v) {
  patch({ isPro: !!v });
  try { await AsyncStorage.setItem(ENTITLEMENT_KEY, v ? 'true' : 'false'); } catch { /* ignore */ }
}

// Send each purchase to the backend; the server queries Apple and either
// records this install as Pro or returns entitled:false. We return true
// only when the server confirms — never trust the client alone.
async function verifyWithBackend(purchases) {
  for (const p of (purchases || [])) {
    const transactionId =
      p?.transactionId
      || p?.transactionIdIOS
      || p?.id
      || null;
    const originalTransactionId =
      p?.originalTransactionIdentifierIOS
      || p?.originalTransactionIdIOS
      || p?.originalTransactionId
      || null;
    if (!transactionId && !originalTransactionId) continue;
    try {
      const r = await verifyReceipt({ transactionId, originalTransactionId });
      if (r?.entitled) return true;
    } catch (e) {
      console.warn('verifyReceipt failed:', e?.message);
    }
  }
  return false;
}
