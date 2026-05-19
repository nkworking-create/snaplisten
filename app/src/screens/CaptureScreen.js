import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ocrImage, synthesize } from '../api';
import { saveSession, attachClip, deleteSession } from '../storage';

// Split (possibly edited) text into sentences (used for the loop drill).
function splitSentences(t) {
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [t.trim()];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Generate every sentence's audio up front, one at a time, pausing and
// retrying on rate limits. Slow but it always finishes — after this,
// playback is fully offline and never stutters, no matter how much you loop.
async function prepareAudio(session, list, onProgress) {
  const backoff = [6000, 12000, 25000, 45000];
  for (let i = 0; i < list.length; i++) {
    let done = false;
    for (let attempt = 0; attempt < 5 && !done; attempt++) {
      try {
        const { audioBase64, mimeType } = await synthesize(list[i]);
        await attachClip(session.id, i, audioBase64, mimeType);
        done = true;
      } catch (e) {
        const rateLimited = e.status === 429 || e.code === 'tts_quota';
        if (rateLimited && attempt < 4) {
          await sleep(backoff[attempt]);
          continue;
        }
        throw e;
      }
    }
    onProgress(i + 1, list.length);
    if (i < list.length - 1) await sleep(800); // gentle spacing
  }
}

// Step 1: pick/take a photo -> OCR.
// Step 2: review & edit the recognized English.
// Step 3: save -> generate audio -> open the player.

export default function CaptureScreen({ onDone, onCancel }) {
  const [stage, setStage] = useState('pick'); // pick | ocr | review | saving | preparing
  const [text, setText] = useState('');
  const [sentences, setSentences] = useState([]);
  const [prog, setProg] = useState({ done: 0, total: 0 });

  async function handleImage(asset) {
    try {
      setStage('ocr');
      const result = await ocrImage(asset.base64, asset.mimeType || 'image/jpeg');
      if (!result.text) {
        Alert.alert('英文が見つからなかった', 'もう一度、はっきり写った写真で試して。');
        setStage('pick');
        return;
      }
      setText(result.text);
      setSentences(result.sentences || []);
      setStage('review');
    } catch (e) {
      Alert.alert('読み取り失敗', String(e.message || e));
      setStage('pick');
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('カメラ権限が必要', '設定からカメラを許可してね。');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], base64: true, quality: 0.7,
    });
    if (!r.canceled) handleImage(r.assets[0]);
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], base64: true, quality: 0.7,
    });
    if (!r.canceled) handleImage(r.assets[0]);
  }

  async function save() {
    const clean = text.trim();
    if (!clean) {
      Alert.alert('テキストが空', '保存する英文を入れてね。');
      return;
    }
    let session = null;
    try {
      setStage('saving');
      const list = splitSentences(clean);
      session = await saveSession({ text: clean, sentences: list });
      setProg({ done: 0, total: list.length });
      setStage('preparing');
      await prepareAudio(session, list, (done, total) => setProg({ done, total }));
      onDone(session);
    } catch (e) {
      if (session) await deleteSession(session.id); // remove the half-made one
      Alert.alert(
        '音声の準備に失敗',
        '通信環境を確認して、もう一度試してね。\n' + String(e.message || e),
      );
      setStage('review');
    }
  }

  if (stage === 'ocr' || stage === 'saving' || stage === 'preparing') {
    const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#374151" />
        {stage === 'preparing' ? (
          <>
            <Text style={styles.muted}>
              音声を準備中…  {prog.done} / {prog.total}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.caption}>
              一度きりの準備です。終わると、何度リピートしても{'\n'}
              止まらずオフラインで再生できます。
            </Text>
          </>
        ) : (
          <Text style={styles.muted}>
            {stage === 'ocr' ? '文字を読み取り中…' : '保存中…'}
          </Text>
        )}
      </View>
    );
  }

  if (stage === 'review') {
    return (
      <View style={styles.flex}>
        <Text style={styles.heading}>読み取り結果（直せるよ）</Text>
        <ScrollView style={styles.editorWrap} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.editor}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            placeholder="認識された英文がここに出ます"
          />
        </ScrollView>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={() => setStage('pick')}>
            <Text style={styles.ghostText}>やり直す</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={save}>
            <Text style={styles.primaryText}>保存して聴く</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // stage === 'pick'
  return (
    <View style={styles.flex}>
      <Text style={styles.heading}>英文を取り込む</Text>
      <View style={{ height: 24 }} />
      <TouchableOpacity style={[styles.btn, styles.primary]} onPress={takePhoto}>
        <Text style={styles.primaryText}>カメラで撮る</Text>
      </TouchableOpacity>
      <View style={{ height: 12 }} />
      <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={pickPhoto}>
        <Text style={styles.secondaryText}>写真から選ぶ</Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
      <TouchableOpacity onPress={onCancel}>
        <Text style={styles.link}>← ライブラリに戻る</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  muted: { fontSize: 15, color: '#6b7280' },
  barTrack: {
    width: 220, height: 8, borderRadius: 4, backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#374151' },
  caption: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },
  editorWrap: { flex: 1, marginVertical: 16 },
  editor: {
    minHeight: 240, fontSize: 18, lineHeight: 28, color: '#111827',
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  primary: { backgroundColor: '#374151' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: '#f3f4f6' },
  secondaryText: { color: '#374151', fontSize: 16, fontWeight: '700' },
  ghost: { backgroundColor: '#f3f4f6' },
  ghostText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  link: { color: '#374151', fontSize: 15, textAlign: 'center' },
});
