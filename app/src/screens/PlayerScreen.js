import { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteSession } from '../storage';
import { t, useLanguage } from '../i18n';
import {
  usePlayer, tapSentence, playAll, togglePlay,
  setLoop, cycleSpeed, stopPlayback, clearIfDeleted,
  activate,
} from '../player';

const FG = '#374151';
const BG = '#f3f4f6';

export default function PlayerScreen({ session, onBack, onDeleted }) {
  useLanguage();
  const player = usePlayer();
  const sentences = session.sentences || [];

  // Prep the audio path on session open (Pro: batch-synth ElevenLabs into cache;
  // Free: no-op). Failure falls back to device speech silently.
  useEffect(() => { activate(session); }, [session?.id]);

  // "This session is what's currently playing" -> drives highlight + play icon.
  const isMine = player.session?.id === session.id;
  const activeIndex = isMine ? player.index : null;
  const speaking = isMine && player.speaking;

  function onTapSentence(i) {
    tapSentence(session, i);
  }

  function onTogglePlay() {
    if (isMine) togglePlay();
    else playAll(session);
  }

  function onPlayAll() {
    playAll(session);
  }

  function confirmDelete() {
    Alert.alert(t('deleteConfirmTitle'), t('deleteConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteAction'), style: 'destructive',
        onPress: async () => {
          clearIfDeleted(session.id);
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
          <Text style={styles.link}>{t('backToLibrary')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.empty}>{t('noSentences')}</Text>
        </View>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteWrap}>
          <Text style={styles.delete}>{t('deleteSession')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.link}>{t('backToLibrary')}</Text>
      </TouchableOpacity>
      <View style={styles.hintRow}>
        <Text style={styles.hint}>{t('playerHint')}</Text>
        {player.busy ? <ActivityIndicator size="small" color="#9ca3af" /> : null}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12 }}>
        {sentences.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.row, i === activeIndex && styles.rowActive]}
            onPress={() => onTapSentence(i)}
          >
            <Text style={[styles.sentence, i === activeIndex && styles.sentenceActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.smallBtn} onPress={cycleSpeed}>
          <Text style={styles.smallText}>{player.speed.toFixed(2)}×</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={onTogglePlay}>
          <Ionicons name={speaking ? 'pause' : 'play'} size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, player.loop && styles.smallBtnOn]}
          onPress={() => setLoop(!player.loop)}
        >
          <Ionicons name="repeat" size={24} color={player.loop ? '#fff' : FG} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.allBtn} onPress={onPlayAll}>
        <Text style={styles.allText}>{t('playAll')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={confirmDelete} style={styles.deleteWrap}>
        <Text style={styles.delete}>{t('deleteSession')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  link: { color: FG, fontSize: 15 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  hint: { color: '#6b7280', fontSize: 13 },
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
