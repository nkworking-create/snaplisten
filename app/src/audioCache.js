// Local on-device cache for ElevenLabs mp3 files.
// Server's clips arrive with { hash, url }. We mirror them into
// FileSystem.cacheDirectory using the same hash, so once a sentence
// is played the audio survives without another network hit.

import * as FS from 'expo-file-system/legacy';
import { RELAY_URL } from './config';

const DIR = `${FS.cacheDirectory}snaplisten-audio/`;

async function ensureDir() {
  try {
    const info = await FS.getInfoAsync(DIR);
    if (!info.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true });
  } catch { /* dir may already exist */ }
}

function fullUrl(u) {
  return u.startsWith('http') ? u : `${RELAY_URL}${u}`;
}

// Given a server clip { hash, url }, ensure a local copy exists and return
// its file:// URI for expo-audio to play.
export async function ensureLocal(clip) {
  if (!clip || !clip.hash || !clip.url) throw new Error('invalid clip');
  await ensureDir();
  const local = `${DIR}${clip.hash}.mp3`;
  try {
    const info = await FS.getInfoAsync(local);
    if (info.exists && (info.size || 0) > 0) return local;
  } catch { /* fall through to download */ }
  const r = await FS.downloadAsync(fullUrl(clip.url), local);
  return r.uri;
}

// Clear all cached audio (e.g. when the user opts out of Pro).
export async function clearCache() {
  try { await FS.deleteAsync(DIR, { idempotent: true }); } catch { /* ignore */ }
}
