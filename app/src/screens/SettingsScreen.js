import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { t, useLanguage, setLanguage, getLang } from '../i18n';

const FG = '#374151';
const BG = '#f3f4f6';
const MUTED = '#6b7280';
const SUBTLE = '#9ca3af';

export default function SettingsScreen({ onBack }) {
  useLanguage(); // re-render on language change
  const lang = getLang();
  const version = Constants.expoConfig?.version || '1.0.0';

  function comingSoon() {
    Alert.alert(t('comingSoonTitle'), t('comingSoonMsg'));
  }

  function LanguageRow({ code, label }) {
    const active = code === lang;
    return (
      <TouchableOpacity style={styles.row} onPress={() => setLanguage(code)}>
        <Text style={styles.rowLabel}>{label}</Text>
        {active && <Ionicons name="checkmark" size={20} color={FG} />}
      </TouchableOpacity>
    );
  }

  function LinkRow({ label, value, onPress }) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value !== undefined ? (
          <Text style={styles.rowValue}>{value}</Text>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={18} color={SUBTLE} />
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.link}>{t('backToLibrary')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('settings_title')}</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionLabel}>{t('settings_language')}</Text>
        <View style={styles.card}>
          <LanguageRow code="en" label={t('lang_en')} />
          <View style={styles.sep} />
          <LanguageRow code="ja" label={t('lang_ja')} />
        </View>

        <Text style={styles.sectionLabel}>{t('settings_pro')}</Text>
        <View style={styles.card}>
          <Text style={styles.teaser}>{t('settings_proTeaser')}</Text>
          <TouchableOpacity style={styles.upgrade} onPress={comingSoon}>
            <Text style={styles.upgradeText}>{t('settings_upgrade')}</Text>
          </TouchableOpacity>
          <View style={styles.sep} />
          <LinkRow label={t('settings_restore')} onPress={comingSoon} />
        </View>

        <Text style={styles.sectionLabel}>{t('settings_about')}</Text>
        <View style={styles.card}>
          <LinkRow label={t('settings_version')} value={version} />
          <View style={styles.sep} />
          <LinkRow label={t('settings_privacy')} onPress={comingSoon} />
          <View style={styles.sep} />
          <LinkRow label={t('settings_contact')} onPress={comingSoon} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16 },
  link: { color: FG, fontSize: 15 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: 16 },
  sectionLabel: {
    fontSize: 12, color: MUTED, marginTop: 18, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  card: { backgroundColor: BG, borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowLabel: { color: '#111827', fontSize: 16 },
  rowValue: { color: MUTED, fontSize: 15 },
  sep: { height: 1, backgroundColor: '#e5e7eb' },
  teaser: { color: MUTED, fontSize: 14, padding: 16, lineHeight: 20 },
  upgrade: {
    backgroundColor: FG, marginHorizontal: 16, marginBottom: 14,
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  upgradeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
