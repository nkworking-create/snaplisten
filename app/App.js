import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import LibraryScreen from './src/screens/LibraryScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { listSessions, renameSession } from './src/storage';
import { initLanguage } from './src/i18n';

export default function App() {
  const [screen, setScreen] = useState('library'); // library | capture | player | settings
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    initLanguage();
    // Audio session: keep playing through the silent switch.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function openSession(session) {
    setActive(session);
    setScreen('player');
  }

  async function afterDelete() {
    await refresh();
    setActive(null);
    setScreen('library');
  }

  async function afterSave(session) {
    await refresh();
    openSession(session);
  }

  async function handleRename(id, title) {
    await renameSession(id, title);
    await refresh();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {screen === 'library' && (
        <LibraryScreen
          sessions={sessions}
          onOpen={openSession}
          onNew={() => setScreen('capture')}
          onRename={handleRename}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'capture' && (
        <CaptureScreen
          onDone={afterSave}
          onCancel={() => setScreen('library')}
        />
      )}
      {screen === 'player' && active && (
        <PlayerScreen
          session={active}
          onBack={() => setScreen('library')}
          onDeleted={afterDelete}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('library')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
});
