import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { deleteSession, attachClip } from '../storage';
import { synthesize } from '../api';

const SPEEDS = [0.75, 1.0, 1.25];

// Full passage audio is made once at save (offline, instant).
// A single sentence's audio is made the first time you tap it, then
// cached on disk. Tap a sentence -> it loops (the repetition drill).
export default function PlayerScreen({ session, onBack, onDeleted, speed, setSpeed }) {
  const sentences = session.sentences || [];
  const [clips, setClips] = useState(session.clips || {});
  const [mode, setMode] = useState('full'); // 'full' | sentence index
  const [loop, setLoop] = useState(true);
  const [busy, setBusy] = useState(null); // index being generated

  const player = useAudioPlayer(session.audioUri || null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => { player.setPlaybackRate(speed); }, [speed, player]);

  // Loop the current sentence when it ends (the drill).
  useEffect(() => {
    if (!status?.didJustFinish) return;
    if (typeof mode === 'number' && loop) {
      player.seekTo(0);
      player.play();
    }
  }, [status?.didJustFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  function start(uri, nextMode) {
    setMode(nextMode);
    player.replace(uri);
    player.setPlaybackRate(speed);
    player.seekTo(0);
    player.play();
  }

  function playFull() {
    if (!session.audioUri) return;
    start(session.audioUri, 'full');
  }

  async function tapSentence(i) {
    if (busy !== null) return;
    let uri = clips[i];
    if (!uri) {
      try {
        setBusy(i);
        const { audioBase64, mimeType } = await synthesize(sentences[i]);
        uri = await attachClip(session.id, i, audioBase64, mimeType);
        setClips((p) => ({ ...p, [i]: uri }));
      } catch (e) {
        Alert.alert('音声の作成に失敗', String(e.message || e));
        return;
      } finally {
        setBusy(null);
      }
    }
    start(uri, i);
  }

  function togglePlay() {
    if (status?.playing) player.pause();
    else {
      if (status?.didJustFinish) player.seekTo(0);
      player.play();
    }
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

  if (!session.audioUri) {
    return (
      <View style={styles.flex}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.link}>← ライブラリ</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.empty}>音声がありません。撮り直して保存してね。</Text>
        </View>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteWrap}>
          <Text style={styles.delete}>このセッションを削除</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.link}>← ライブラリ</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>文をタップ＝その文を繰り返し練習（初回だけ少し待つ）</Text>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12 }}>
        {sentences.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.row, i === mode && styles.rowActive]}
            onPress={() => tapSentence(i)}
            disabled={busy !== null}
          >
            <Text style={[styles.sentence, i === mode && styles.sentenceActive]}>
              {s}
            </Text>
            {busy === i && (
              <ActivityIndicator size="small" color="#4f46e5" style={{ marginTop: 6 }} />
            )}
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

      <TouchableOpacity style={styles.allBtn} onPress={playFull}>
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
  empty: { color: '#9ca3af', fontSize: 16, textAlign: 'center' },
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
