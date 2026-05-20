import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, useLanguage } from '../i18n';
import { usePlayer, togglePlay, nextSentence, prevSentence, stopPlayback } from '../player';

const FG = '#374151';
const MUTED = '#6b7280';
const SUBTLE = '#9ca3af';

export default function LibraryScreen({ sessions, onOpen, onNew, onRename, onSettings }) {
  useLanguage();
  const player = usePlayer();

  function renameItem(item) {
    if (Alert.prompt) {
      Alert.prompt(
        t('renamePromptTitle'),
        null,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('renameSave'), onPress: (v) => v != null && onRename(item.id, v) },
        ],
        'plain-text',
        item.title,
      );
    } else {
      Alert.alert(t('renameUnsupported'), t('renameUnsupportedMsg'));
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('appTitle')}</Text>
          <Text style={styles.subtitle}>{t('appSubtitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={onSettings}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="settings-outline" size={24} color={FG} />
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('emptyLine1')}</Text>
          <Text style={styles.emptyText}>{t('emptyLine2')}</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, marginTop: 16 }}
          data={sessions}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity style={styles.cardBody} onPress={() => onOpen(item)}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardDate}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => renameItem(item)}
              >
                <Ionicons name="create-outline" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {player.session && (
        <View style={styles.mini}>
          <TouchableOpacity style={styles.miniBody} onPress={() => onOpen(player.session)}>
            <Text style={styles.miniLabel}>{t('nowPlaying')}</Text>
            <Text style={styles.miniTitle} numberOfLines={1}>{player.session.title}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniIcon}
            onPress={prevSentence}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={t('a11y_prev')}
          >
            <Ionicons name="play-skip-back" size={20} color={FG} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniIcon}
            onPress={togglePlay}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={t('a11y_playPause')}
          >
            <Ionicons name={player.speaking ? 'pause' : 'play'} size={22} color={FG} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniIcon}
            onPress={nextSentence}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={t('a11y_next')}
          >
            <Ionicons name="play-skip-forward" size={20} color={FG} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniIcon}
            onPress={stopPlayback}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={t('a11y_stop')}
          >
            <Ionicons name="close" size={20} color={MUTED} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={onNew}>
        <Text style={styles.fabText}>{t('newButton')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: MUTED, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { color: SUBTLE, fontSize: 15 },
  card: {
    backgroundColor: '#f9fafb', borderRadius: 14, padding: 18, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  cardDate: { fontSize: 13, color: SUBTLE, marginTop: 6 },
  renameBtn: { paddingLeft: 14 },
  mini: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  miniBody: { flex: 1, paddingRight: 8 },
  miniLabel: { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniTitle: { fontSize: 15, color: '#111827', fontWeight: '600', marginTop: 2 },
  miniIcon: { paddingHorizontal: 8, paddingVertical: 6 },
  fab: {
    backgroundColor: FG, paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 12,
  },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
