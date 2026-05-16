import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Sessions are stored in two parts:
//   - metadata list  -> AsyncStorage (small JSON)
//   - the mp3 audio   -> a real file on disk (so replay is offline + instant)

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

// Save a new session: write the mp3 to disk, add metadata to the index.
export async function saveSession({ text, sentences, audioBase64 }) {
  await ensureDir();
  const id = String(Date.now());
  const audioUri = `${AUDIO_DIR}${id}.mp3`;
  await FileSystem.writeAsStringAsync(audioUri, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const title =
    (text || '').trim().slice(0, 48).replace(/\s+/g, ' ') || 'Untitled';

  const session = {
    id,
    title,
    text: text || '',
    sentences: sentences || [],
    audioUri,
    createdAt: Date.now(),
  };

  const list = await listSessions();
  await writeIndex([session, ...list]);
  return session;
}

export async function deleteSession(id) {
  const list = await listSessions();
  const target = list.find((s) => s.id === id);
  if (target?.audioUri) {
    await FileSystem.deleteAsync(target.audioUri, { idempotent: true });
  }
  await writeIndex(list.filter((s) => s.id !== id));
}
