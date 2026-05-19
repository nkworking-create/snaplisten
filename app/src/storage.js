import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Sessions are stored in two parts:
//   - metadata list   -> AsyncStorage (small JSON)
//   - one audio file PER SENTENCE -> real files on disk
// Per-sentence files are what make the "loop one sentence" drill work,
// and replay stays offline + instant after the first save.
// Extension follows the provider: Gemini -> wav, ElevenLabs -> mp3.

const INDEX_KEY = 'snaplisten.sessions';
const AUDIO_DIR = `${FileSystem.documentDirectory}snaplisten/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
}

export async function listSessions() {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const list = raw ? JSON.parse(raw) : [];
  // Newest first.
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

async function writeIndex(list) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

// Save a new session: write one audio file per sentence clip, index it.
// clips: [{ text, audioBase64, mimeType }]
export async function saveSession({ text, clips }) {
  await ensureDir();
  const id = String(Date.now());

  const stored = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const ext = c.mimeType && c.mimeType.includes('wav') ? 'wav' : 'mp3';
    const uri = `${AUDIO_DIR}${id}_${i}.${ext}`;
    await FileSystem.writeAsStringAsync(uri, c.audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    stored.push({ text: c.text, uri });
  }

  const title =
    (text || '').trim().slice(0, 48).replace(/\s+/g, ' ') || 'Untitled';

  const session = {
    id,
    title,
    text: text || '',
    sentences: stored.map((s) => s.text),
    clips: stored,
    createdAt: Date.now(),
  };

  const list = await listSessions();
  await writeIndex([session, ...list]);
  return session;
}

export async function deleteSession(id) {
  const list = await listSessions();
  const target = list.find((s) => s.id === id);
  for (const c of target?.clips || []) {
    await FileSystem.deleteAsync(c.uri, { idempotent: true });
  }
  await writeIndex(list.filter((s) => s.id !== id));
}
