import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import LibraryScreen from './src/screens/LibraryScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import { listSessions } from './src/storage';

export default function App() {
  const [screen, setScreen] = useState('library'); // 'library' | 'capture' | 'player'
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [speed, setSpeed] = useState(1.0); // 1.0 = natural pace (see PlayerScreen)

  // Play even when the phone's silent switch is on — this is a listening app.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function openSession(session) {
    setActive(session);
    setSpeed(1.0);
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {screen === 'library' && (
        <LibraryScreen
          sessions={sessions}
          onOpen={openSession}
          onNew={() => setScreen('capture')}
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
          speed={speed}
          setSpeed={setSpeed}
          onBack={() => setScreen('library')}
          onDeleted={afterDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
});
