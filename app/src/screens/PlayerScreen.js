import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { deleteSession, attachClip } from '../storage';
import { synthesize } from '../api';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const FG = '#374151';
const BG = '#f3f4f6';

// Every sentence's audio is made the first time it's played, then cached.
// Repeat ON  + tap sentence  -> that sentence loops (drill).
// Repeat OFF + tap sentence  -> plays from there onward through the rest.
// The currently-playing sentence is always highlighted.
export default function PlayerScreen({ session, onBack, onDeleted, speed, setSpeed }) {
  const sentences = session.sentences || [];
  const [clips, setClips] = useState(session.clips || {});
  const [mode, setMode] = useState(null); // active sentence index | null
  const [loop, setLoop] = useState(true);
  const [busy, setBusy] = useState(null); // index being generated

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Refs so the "sentence finished" handler reads the latest values.
  const modeRef = useRef(null);
  const behRef = useRef('loop'); // 'loop' | 'through'
  const clipsRef = useRef(clips);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  useEffect(() => { player.setPlaybackRate(speed); }, [speed, player]);

  async function ensureClip(i) {
    const have = clipsRef.current[i];
    if (have) return have;
    setBusy(i);
    try {
      const { audioBase64, mimeType } = await synthesize(sentences[i]);
      const uri = await attachClip(session.id, i, audioBase64, mimeType);
      clipsRef.current = { ...clipsRef.current, [i]: uri };
      setClips(clipsRef.current);
      return uri;
    } finally {
      setBusy(null);
    }
  }

  async function play(i, behavior) {
    if (i < 0 || i >= sentences.length) return;
    let uri;
    try {
      uri = await ensureClip(i);
    } catch (e) {
      Alert.alert('音声の作成に失敗', String(e.message || e));
      return;
    }
    behRef.current = behavior;
    modeRef.current = i;
    setMode(i);
    player.replace(uri);
    player.setPlaybackRate(speed);
    player.seekTo(0);
    player.play();
  }

  // When a sentence finishes: loop it, or continue to the next one.
  useEffect(() => {
    if (!status?.didJustFinish) return;
    const i = modeRef.current;
    if (typeof i !== 'number') return;
    if (behRef.current === 'loop') {
      player.seekTo(0);
      player.play();
    } else if (i + 1 < sentences.length) {
      play(i + 1, 'through');
    }
  }, [status?.didJustFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  function tapSentence(i) {
    if (busy !== null) return;
    play(i, loop ? 'loop' : 'through');
  }

  function playAll() {
    if (busy !== null) return;
    play(0, 'through');
  }

  function togglePlay() {
    if (status?.playing) { player.pause(); return; }
    if (modeRef.current === null) { playAll(); return; }
    if (status?.didJustFinish) player.seekTo(0);
    player.play();
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

  if (sentences.length === 0) {
    return (
      <View style={styles.flex}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.link}>← ライブラリ</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.empty}>文がありません。撮り直してね。</Text>
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
      <Text style={styles.hint}>文をタップ＝その文を再生（初回だけ少し待つ）</Text>

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
              <ActivityIndicator size="small" color={FG} style={{ marginTop: 6 }} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.smallBtn} onPress={cycleSpeed}>
          <Text style={styles.smallText}>{speed.toFixed(2)}×</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Ionicons name={status?.playing ? 'pause' : 'play'} size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, loop && styles.smallBtnOn]}
          onPress={() => setLoop((v) => !v)}
        >
          <Ionicons name="repeat" size={24} color={loop ? '#fff' : FG} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.allBtn} onPress={playAll}>
        <Text style={styles.allText}>最初から通し再生</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={confirmDelete} style={styles.deleteWrap}>
        <Text style={styles.delete}>このセッションを削除</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  link: { color: FG, fontSize: 15 },
  hint: { color: '#6b7280', fontSize: 13, marginTop: 10 },
  list: { flex: 1, marginTop: 6 },
  empty: { color: '#9ca3af', fontSize: 16, textAlign: 'center' },
  row: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8 },
  rowActive: { backgroundColor: BG },
  sentence: { fontSize: 19, lineHeight: 30, color: '#374151' },
  sentenceActive: { color: '#111827', fontWeight: '600' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 28, paddingVertical: 14,
  },
  playBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: FG,
    alignItems: 'center', justifyContent: 'center',
  },
  smallBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  smallBtnOn: { backgroundColor: FG },
  smallText: { color: FG, fontSize: 16, fontWeight: '700' },
  allBtn: {
    paddingVertical: 14, borderRadius: 14, backgroundColor: BG,
    alignItems: 'center',
  },
  allText: { color: FG, fontSize: 15, fontWeight: '600' },
  deleteWrap: { alignItems: 'center', paddingVertical: 10 },
  delete: { color: '#ef4444', fontSize: 14 },
});
