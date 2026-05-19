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

function autoTitle(text) {
  return (text || '').trim().slice(0, 48).replace(/\s+/g, ' ') || 'Untitled';
}

export async function saveSession({ text, sentences, title }) {
  const id = String(Date.now());
  const session = {
    id,
    title: (title || '').trim() || autoTitle(text),
    text: text || '',
    sentences: sentences || [],
    createdAt: Date.now(),
  };

  await writeIndex([session, ...(await listSessions())]);
  return session;
}

export async function renameSession(id, title) {
  const list = await listSessions();
  const s = list.find((x) => x.id === id);
  if (s) {
    s.title = (title || '').trim() || autoTitle(s.text);
    await writeIndex(list);
  }
}

export async function deleteSession(id) {
  const list = await listSessions();
  await writeIndex(list.filter((s) => s.id !== id));
}
