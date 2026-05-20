import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ocrImage } from '../api';
import { saveSession } from '../storage';
import { t, useLanguage } from '../i18n';

function splitSentences(text) {
  const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

function suggestTitle(text) {
  const first = splitSentences(text)[0] || text.trim();
  return first.slice(0, 40).replace(/\s+/g, ' ');
}

// pick -> ocr -> review (edit text) -> title (name it) -> save (instant).
export default function CaptureScreen({ onDone, onCancel }) {
  useLanguage();
  const [stage, setStage] = useState('pick');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');

  async function handleImage(asset) {
    try {
      setStage('ocr');
      const result = await ocrImage(asset.base64, asset.mimeType || 'image/jpeg');
      if (!result.text) {
        Alert.alert(t('notFoundTitle'), t('notFoundMsg'));
        setStage('pick');
        return;
      }
      setText(result.text);
      setStage('review');
    } catch (e) {
      Alert.alert(t('readFail'), String(e.message || e));
      setStage('pick');
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('cameraPermNeeded'), t('cameraPermAsk'));
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
      Alert.alert(t('emptyTextTitle'), t('emptyTextMsg'));
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
      Alert.alert(t('saveFail'), String(e.message || e));
      setStage('title');
    }
  }

  if (stage === 'ocr' || stage === 'saving') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#374151" />
        <Text style={styles.muted}>
          {stage === 'ocr' ? t('ocrLoading') : t('saving')}
        </Text>
      </View>
    );
  }

  if (stage === 'review') {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flex}>
          <Text style={styles.heading}>{t('review_heading')}</Text>
          <ScrollView style={styles.editorWrap} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.editor}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              placeholder={t('placeholder_text')}
            />
          </ScrollView>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={() => setStage('pick')}>
              <Text style={styles.ghostText}>{t('redo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={goToTitle}>
              <Text style={styles.primaryText}>{t('next')}</Text>
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
          <Text style={styles.heading}>{t('title_heading')}</Text>
          <Text style={styles.muted}>{t('title_subtitle')}</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t('titlePlaceholder')}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <View style={{ flex: 1 }} />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={() => setStage('review')}>
              <Text style={styles.ghostText}>{t('back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={save}>
              <Text style={styles.primaryText}>{t('saveAndListen')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // stage === 'pick'
  return (
    <View style={styles.flex}>
      <Text style={styles.heading}>{t('pick_heading')}</Text>
      <View style={{ height: 24 }} />
      <TouchableOpacity style={[styles.btn, styles.primary]} onPress={takePhoto}>
        <Text style={styles.primaryText}>{t('takePhoto')}</Text>
      </TouchableOpacity>
      <View style={{ height: 12 }} />
      <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={pickPhoto}>
        <Text style={styles.secondaryText}>{t('pickPhoto')}</Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
      <TouchableOpacity onPress={onCancel}>
        <Text style={styles.link}>{t('cancelLink')}</Text>
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
