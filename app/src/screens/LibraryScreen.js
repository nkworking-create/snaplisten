import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, useLanguage } from '../i18n';

export default function LibraryScreen({ sessions, onOpen, onNew, onRename, onSettings }) {
  useLanguage(); // re-render on language change

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
          <Ionicons name="settings-outline" size={24} color="#374151" />
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
                <Ionicons name="create-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        />
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
  subtitle: { fontSize: 15, color: '#6b7280', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { color: '#9ca3af', fontSize: 15 },
  card: {
    backgroundColor: '#f9fafb', borderRadius: 14, padding: 18, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  cardDate: { fontSize: 13, color: '#9ca3af', marginTop: 6 },
  renameBtn: { paddingLeft: 14 },
  fab: {
    backgroundColor: '#374151', paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 12,
  },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
