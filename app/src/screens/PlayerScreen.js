import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { deleteSession } from '../storage';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Calibration: the 1.00 button = the natural "normal" speaking pace.
// Other steps scale relative to it. If "normal" still sounds a touch
// fast/slow on the device, nudge SPEECH_BASE_RATE (the only knob).
const NORMAL_AT = 1.0;
const SPEECH_BASE_RATE = 1.0; // expo-speech rate that sounds normal
const toRate = (displayed) => (displayed / NORMAL_AT) * SPEECH_BASE_RATE;

const FG = '#374151';
const BG = '#f3f4f6';

// Audio is spoken on-device: free, offline, unlimited, instant.
// Repeat ON  + tap sentence -> that sentence repeats.
// Repeat OFF + tap sentence -> plays from there onward.
// "通し再生" -> from the first sentence onward (regardless of repeat).
// The sentence being spoken is always highlighted.
export default function PlayerScreen({ session, onBack, onDeleted, speed, setSpeed }) {
  const sentences = session.sentences || [];
  const [mode, setMode] = useState(null); // active sentence index | null
  const [loop, setLoop] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const loopRef = useRef(loop);
  const speedRef = useRef(speed);
  const behRef = useRef('auto'); // 'auto' (follow repeat toggle) | 'through'
  const tokenRef = useRef(0);    // invalidates stale speech callbacks
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  function stopSpeech() {
    tokenRef.current += 1;
    Speech.stop();
    setSpeaking(false);
  }

  // Stop speaking if we leave the screen.
  useEffect(() => () => { tokenRef.current += 1; Speech.stop(); }, []);

  function speakIndex(i) {
    if (i < 0 || i >= sentences.length) return;
    const myToken = ++tokenRef.current;
    setMode(i);
    setSpeaking(true);
    Speech.stop();
    Speech.speak(sentences[i], {
      language: 'en-US',
      rate: toRate(speedRef.current),
      onDone: () => {
        if (myToken !== tokenRef.current) return; // superseded
        const through = behRef.current === 'through';
        if (!through && loopRef.current) {
          speakIndex(i); // repeat this sentence
        } else if (i + 1 < sentences.length) {
          speakIndex(i + 1); // continue onward
        } else {
          setSpeaking(false);
        }
      },
      onError: () => { if (myToken === tokenRef.current) setSpeaking(false); },
    });
  }

  function tapSentence(i) {
    behRef.current = 'auto';
    speakIndex(i);
  }

  function playAll() {
    behRef.current = 'through';
    speakIndex(0);
  }

  function togglePlay() {
    if (speaking) { stopSpeech(); return; }
    if (mode == null) { playAll(); return; }
    behRef.current = 'auto';
    speakIndex(mode);
  }

  function cycleSpeed() {
    setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
  }

  function confirmDelete() {
    Alert.alert('削除する？', 'このセッションを消します。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          stopSpeech();
          await deleteSession(session.id);
          onDeleted();
        },
      },
    ]);
  }

  function back() {
    stopSpeech();
    onBack();
  }

  if (sentences.length === 0) {
    return (
      <View style={styles.flex}>
        <TouchableOpacity onPress={back}>
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
      <TouchableOpacity onPress={back}>
        <Text style={styles.link}>← ライブラリ</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>文をタップ＝その文を再生</Text>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12 }}>
        {sentences.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.row, i === mode && styles.rowActive]}
            onPress={() => tapSentence(i)}
          >
            <Text style={[styles.sentence, i === mode && styles.sentenceActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.smallBtn} onPress={cycleSpeed}>
          <Text style={styles.smallText}>{speed.toFixed(2)}×</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Ionicons name={speaking ? 'pause' : 'play'} size={30} color="#fff" />
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
