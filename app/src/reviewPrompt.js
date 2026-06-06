import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Trigger Apple's in-app rating prompt after meaningful engagement.
// - Counts each time the user successfully saves a session.
// - Prompts after the 3rd save.
// - Throttled: only one prompt per app version.
// iOS additionally enforces "max 3 prompts per 365 days per user".

const SESSIONS_KEY = 'snaplisten.sessionsSaved';
const ASKED_KEY = 'snaplisten.reviewAskedForVersion';
const TRIGGER_AT = 3;

export async function recordSessionAndMaybeAsk() {
  try {
    const count = Number((await AsyncStorage.getItem(SESSIONS_KEY)) || '0') + 1;
    await AsyncStorage.setItem(SESSIONS_KEY, String(count));
    if (count < TRIGGER_AT) return;

    const version = Constants.expoConfig?.version || '0';
    const already = await AsyncStorage.getItem(ASKED_KEY);
    if (already === version) return;

    if (!(await StoreReview.hasAction())) return;
    await StoreReview.requestReview();
    await AsyncStorage.setItem(ASKED_KEY, version);
  } catch { /* silent — never block the save flow */ }
}
