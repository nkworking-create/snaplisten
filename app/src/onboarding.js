import AsyncStorage from '@react-native-async-storage/async-storage';

// First-launch state: were we already shown the welcome paywall once?
// Persists across reinstalls because AsyncStorage is per-install... actually
// it's per-app-data, so deleting the app resets it. Good enough.

const KEY = 'snaplisten.onboarded.v1';

export async function hasOnboarded() {
  try { return (await AsyncStorage.getItem(KEY)) === 'true'; }
  catch { return false; }
}

export async function markOnboarded() {
  try { await AsyncStorage.setItem(KEY, 'true'); } catch { /* ignore */ }
}
