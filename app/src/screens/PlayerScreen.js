import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { deleteSession } from '../storage';

const SPEEDS = [0.75, 1.0, 1.25];

// One audio clip per sentence. Tap a sentence to drill it on loop;
// the loop toggle off + play walks through the whole passage.
export default function PlayerScreen({ session, onBack, onDeleted, speed, setSpeed }) {
  const clips = session.clips || [];
  const [index, setIndex] = useState(0);
  const [loop, setLoop] = useState(true);

  const player = useAudioPlayer(clips[0] ? { uri: clips[0].uri } : null);
  const status = useAudioPlayerStatus(player);

  const playAt = useCallback((i) => {
    if (i < 0 || i >= clips.length) return;
    setIndex(i);
    player.replace({ uri: clips[i].uri });
    player.setPlaybackRate(speed);
    player.play();
  }, [clips, player, speed]);

  // Keep speed in sync.
  useEffect(() => { player.setPlaybackRate(speed); }, [speed, player]);

  // When a sentence ends: repeat it (loop) or move to the next one.
  useEffect(() => {
    if (!status?.didJustFinish) return;
    if (loop) {
      player.seekTo(0);
      player.play();
    } else if (index + 1 < clips.length) {
      playAt(index + 1);
    }
  }, [status?.didJustFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePlay() {
    if (status?.playing) player.pause();
    else {
      if (status?.didJustFinish) player.seekTo(0);
      player.play();
    }
  }

  function playAll() {
    setLoop(false);
    playAt(0);
  }

  function cycleSpeed() {
    setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
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

      <Text style={styles.hint}>文をタップ＝その文を繰り返し練習</Text>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12 }}>
        {clips.length === 0 && (
          <Text style={styles.empty}>音声がありません。撮り直して保存してね。</Text>
        )}
        {clips.map((c, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.row, i === index && styles.rowActive]}
            onPress={() => playAt(i)}
          >
            <Text style={[styles.sentence, i === index && styles.sentenceActive]}>
              {c.text}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.smallBtn} onPress={cycleSpeed}>
          <Text style={styles.smallText}>{speed.toFixed(2)}×</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Text style={styles.playIcon}>{status?.playing ? '❚❚' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.smallBtn, loop && styles.smallBtnOn]}
          onPress={() => setLoop((v) => !v)}
        >
          <Text style={[styles.smallText, loop && styles.smallTextOn]}>🔁</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.allBtn} onPress={playAll}>
        <Text style={styles.allText}>▶ 最初から通し再生</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={confirmDelete} style={styles.deleteWrap}>
        <Text style={styles.delete}>このセッションを削除</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  link: { color: '#4f46e5', fontSize: 15 },
  hint: { color: '#6b7280', fontSize: 13, marginTop: 10 },
  list: { flex: 1, marginTop: 6 },
  empty: { color: '#9ca3af', fontSize: 15, textAlign: 'center', marginTop: 40 },
  row: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8 },
  rowActive: { backgroundColor: '#eef2ff' },
  sentence: { fontSize: 19, lineHeight: 30, color: '#374151' },
  sentenceActive: { color: '#111827', fontWeight: '600' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 28, paddingVertical: 14,
  },
  playBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 30, fontWeight: '700' },
  smallBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  smallBtnOn: { backgroundColor: '#4f46e5' },
  smallText: { color: '#4f46e5', fontSize: 18, fontWeight: '700' },
  smallTextOn: { color: '#fff' },
  allBtn: {
    paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  allText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  deleteWrap: { alignItems: 'center', paddingVertical: 10 },
  delete: { color: '#ef4444', fontSize: 14 },
});
