import AsyncStorage from '@react-native-async-storage/async-storage';
import { RELAY_URL, APP_SECRET } from './config';

// Anonymous, account-free identity:
//   - a stable random install id (generated once, kept on device)
//   - a signed token the server issues for that install id
// The token is sent on every /ocr and /tts call so the relay only
// answers our app, and can meter usage per install.

const ID_KEY = 'snaplisten.installId';
const TOKEN_KEY = 'snaplisten.token';

function randomId(len = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function getInstallId() {
  let id = await AsyncStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(ID_KEY, id);
  }
  return id;
}

async function register() {
  const installId = await getInstallId();
  const res = await fetch(`${RELAY_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-secret': APP_SECRET },
    body: JSON.stringify({ installId }),
  });
  if (!res.ok) throw new Error('登録に失敗しました。通信環境を確認してね。');
  const { token } = await res.json();
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

// Return a usable token, registering on first run.
export async function ensureToken() {
  const cached = await AsyncStorage.getItem(TOKEN_KEY);
  return cached || register();
}

// Drop the stored token and get a fresh one (used when it expires/invalid).
export async function refreshToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  return register();
}
