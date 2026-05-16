import { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { deleteSession } from '../storage';

const SPEEDS = [0.75, 1.0, 1.25];

export default function PlayerScreen({ session, onBack, onDeleted, speed, setSpeed }) {
  const player = useAudioPlayer({ uri: session.audioUri });
  const status = useAudioPlayerStatus(player);

  // Keep playback rate in sync with the chosen speed.
  useEffect(() => {
    player.setPlaybackRate(speed);
  }, [speed, player]);

  function togglePlay() {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= (status.duration || 0)) {
        player.seekTo(0);
      }
      player.play();
    }
  }

  function replay() {
    player.seekTo(0);
    player.play();
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  }

  function confirmDelete() {
    Alert.alert('削除する？', 'このセッションと音声を消します。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          player.pause();
          await deleteSession(session.id);
          onDeleted();
        },
      },
    ]);
  }

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.link}>← ライブラリ</Text>
      </TouchableOpacity>

      <ScrollView style={styles.textWrap} contentContainerStyle={{ paddingVertical: 20 }}>
        <Text style={styles.passage}>{session.text}</Text>
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.speedBtn} onPress={cycleSpeed}>
          <Text style={styles.speedText}>{speed.toFixed(2)}×</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Text style={styles.playIcon}>{status.playing ? '❚❚' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.speedBtn} onPress={replay}>
          <Text style={styles.speedText}>↺</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={confirmDelete} style={styles.deleteWrap}>
        <Text style={styles.delete}>このセッションを削除</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  link: { color: '#4f46e5', fontSize: 15 },
  textWrap: { flex: 1, marginTop: 8 },
  passage: { fontSize: 22, lineHeight: 36, color: '#111827' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 28, paddingVertical: 18,
  },
  playBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 30, fontWeight: '700' },
  speedBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  speedText: { color: '#4f46e5', fontSize: 18, fontWeight: '700' },
  deleteWrap: { alignItems: 'center', paddingVertical: 8 },
  delete: { color: '#ef4444', fontSize: 14 },
});
