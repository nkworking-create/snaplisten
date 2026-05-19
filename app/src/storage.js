import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// A session stores:
//   - metadata + sentence text  -> AsyncStorage (small JSON)
//   - per-sentence audio clips   -> made lazily the first time a sentence
//                                   is played, then cached on disk forever
// Saving makes NO audio (instant, zero requests). Audio is generated one
// sentence at a time as it's played, so we always know which sentence is
// active (for highlighting) and never burst the TTS rate limit.

const INDEX_KEY = 'snaplisten.sessions';
const AUDIO_DIR = `${FileSystem.documentDirectory}snaplisten/`;

const extOf = (mimeType) => (mimeType && mimeType.includes('wav') ? 'wav' : 'mp3');

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
}

export async function listSessions() {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

async function writeIndex(list) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

// Save: just metadata + sentences. No audio yet (instant, no network).
export async function saveSession({ text, sentences }) {
  const id = String(Date.now());
  const title =
    (text || '').trim().slice(0, 48).replace(/\s+/g, ' ') || 'Untitled';

  const session = {
    id,
    title,
    text: text || '',
    sentences: sentences || [],
    clips: {}, // sentence index -> audio file uri, filled on demand
    createdAt: Date.now(),
  };

  await writeIndex([session, ...(await listSessions())]);
  return session;
}

// Write one sentence's audio and remember it on the session. Returns its uri.
export async function attachClip(sessionId, index, audioBase64, mimeType) {
  await ensureDir();
  const uri = `${AUDIO_DIR}${sessionId}_s${index}.${extOf(mimeType)}`;
  await FileSystem.writeAsStringAsync(uri, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const list = await listSessions();
  for (const s of list) {
    if (s.id === sessionId) {
      s.clips = { ...(s.clips || {}), [index]: uri };
      break;
    }
  }
  await writeIndex(list);
  return uri;
}

export async function deleteSession(id) {
  const list = await listSessions();
  const target = list.find((s) => s.id === id);
  if (target) {
    for (const uri of Object.values(target.clips || {}))
      await FileSystem.deleteAsync(uri, { idempotent: true });
  }
  await writeIndex(list.filter((s) => s.id !== id));
}
