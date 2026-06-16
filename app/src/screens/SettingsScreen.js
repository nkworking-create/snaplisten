import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { t, useLanguage, setLanguage, getLang } from '../i18n';
import { usePro, restore } from '../pro';
import { usePlayer, setVoicePref } from '../player';

const FG = '#374151';
const BG = '#f3f4f6';
const MUTED = '#6b7280';
const SUBTLE = '#9ca3af';
const PRIVACY_URL = 'https://nkworking-create.github.io/snaplisten-site/';

export default function SettingsScreen({ onBack, onOpenPaywall }) {
  useLanguage(); // re-render on language change
  const lang = getLang();
  const pro = usePro();
  const player = usePlayer();
  const version = Constants.expoConfig?.version || '1.0.0';
  const naturalOn = pro.isPro && player.voicePref !== 'device';

  async function onRestore() {
    const res = await restore();
    if (res?.ok) {
      Alert.alert(
        res.restored ? t('paywall_thanks_title') : t('readFail'),
        res.restored ? t('paywall_restored') : t('paywall_no_restore'),
      );
    } else if (res?.error) {
      Alert.alert(t('paywall_failed'), res.error);
    }
  }

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
          {pro.isPro ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('paywall_title')}</Text>
              <View style={styles.proPill}>
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={styles.proPillText}>Pro</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.row} onPress={onOpenPaywall}>
              <Text style={styles.rowLabel}>{t('settings_upgrade')}</Text>
              <Ionicons name="chevron-forward" size={18} color={SUBTLE} />
            </TouchableOpacity>
          )}
          <View style={styles.sep} />
          <TouchableOpacity style={styles.row} onPress={onRestore} disabled={pro.busy}>
            <Text style={styles.rowLabel}>{t('settings_restore')}</Text>
            <Ionicons name="refresh" size={18} color={SUBTLE} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>{t('settings_voice')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>{t('settings_voice_natural')}</Text>
              <Text style={styles.rowSub}>{t('settings_voice_natural_sub')}</Text>
            </View>
            {pro.isPro ? (
              <Switch
                value={naturalOn}
                onValueChange={(on) => setVoicePref(on ? 'natural' : 'device')}
              />
            ) : (
              <TouchableOpacity onPress={onOpenPaywall} hitSlop={10}>
                <Ionicons name="lock-closed" size={18} color={SUBTLE} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('settings_about')}</Text>
        <View style={styles.card}>
          <LinkRow label={t('settings_version')} value={version} />
          <View style={styles.sep} />
          <LinkRow label={t('settings_privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
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
  rowTextWrap: { flex: 1, paddingRight: 12 },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 3, lineHeight: 16 },
  rowValue: { color: MUTED, fontSize: 15 },
  sep: { height: 1, backgroundColor: '#e5e7eb' },
  proPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  proPillText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
});
