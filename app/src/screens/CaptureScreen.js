import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ocrImage } from '../api';
import { saveSession } from '../storage';

// Split (possibly edited) text into sentences for the loop drill.
function splitSentences(t) {
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [t.trim()];
}

function suggestTitle(t) {
  const first = splitSentences(t)[0] || t.trim();
  return first.slice(0, 40).replace(/\s+/g, ' ');
}

// pick -> ocr -> review (edit text) -> title (name it) -> save (instant).
export default function CaptureScreen({ onDone, onCancel }) {
  const [stage, setStage] = useState('pick');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');

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

  function goToTitle() {
    const clean = text.trim();
    if (!clean) {
      Alert.alert('テキストが空', '保存する英文を入れてね。');
      return;
    }
    Keyboard.dismiss();
    setTitle(suggestTitle(clean));
    setStage('title');
  }

  async function save() {
    try {
      Keyboard.dismiss();
      setStage('saving');
      const session = await saveSession({
        text: text.trim(),
        sentences: splitSentences(text.trim()),
        title: title.trim(),
      });
      onDone(session);
    } catch (e) {
      Alert.alert('保存に失敗', String(e.message || e));
      setStage('title');
    }
  }

  if (stage === 'ocr' || stage === 'saving') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#374151" />
        <Text style={styles.muted}>
          {stage === 'ocr' ? '文字を読み取り中…' : '保存中…'}
        </Text>
      </View>
    );
  }

  if (stage === 'review') {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={goToTitle}>
              <Text style={styles.primaryText}>次へ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  if (stage === 'title') {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flex}>
          <Text style={styles.heading}>タイトルをつけよう</Text>
          <Text style={styles.muted}>ライブラリに表示される名前です。</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="タイトル"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <View style={{ flex: 1 }} />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={() => setStage('review')}>
              <Text style={styles.ghostText}>戻る</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={save}>
              <Text style={styles.primaryText}>保存して聴く</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
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
  editorWrap: { flex: 1, marginVertical: 16 },
  editor: {
    minHeight: 240, fontSize: 18, lineHeight: 28, color: '#111827',
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16,
  },
  titleInput: {
    marginTop: 16, fontSize: 18, color: '#111827',
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
