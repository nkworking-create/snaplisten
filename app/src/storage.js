import AsyncStorage from '@react-native-async-storage/async-storage';

// Sessions are just text now. Audio is spoken on-device (expo-speech)
// at play time, so there are no audio files to store or clean up.

const INDEX_KEY = 'snaplisten.sessions';

export async function listSessions() {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

async function writeIndex(list) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export async function saveSession({ text, sentences }) {
  const id = String(Date.now());
  const title =
    (text || '').trim().slice(0, 48).replace(/\s+/g, ' ') || 'Untitled';

  const session = {
    id,
    title,
    text: text || '',
    sentences: sentences || [],
    createdAt: Date.now(),
  };

  await writeIndex([session, ...(await listSessions())]);
  return session;
}

export async function deleteSession(id) {
  const list = await listSessions();
  await writeIndex(list.filter((s) => s.id !== id));
}
