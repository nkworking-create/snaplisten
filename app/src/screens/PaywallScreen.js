import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, useLanguage } from '../i18n';
import {
  usePro, purchase, restore,
  PRODUCT_MONTHLY, PRODUCT_YEARLY,
} from '../pro';

const FG = '#374151';
const BG = '#f3f4f6';
const INK = '#111827';
const MUTED = '#6b7280';
const ACCENT = '#111827';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://nkworking-create.github.io/snaplisten-site/';

export default function PaywallScreen({ onBack, initialPlan = 'monthly', onboarding = false }) {
  useLanguage();
  const pro = usePro();

  const [selected, setSelected] = useState(initialPlan);

  const monthly = useMemo(
    () => findProduct(pro.products, PRODUCT_MONTHLY),
    [pro.products]
  );
  const yearly = useMemo(
    () => findProduct(pro.products, PRODUCT_YEARLY),
    [pro.products]
  );

  const monthlyPrice = monthly?.localizedPrice
    || monthly?.displayPrice
    || t('paywall_monthly_price_fallback');
  const yearlyPrice = yearly?.localizedPrice
    || yearly?.displayPrice
    || t('paywall_yearly_price_fallback');

  async function onStart() {
    const id = selected === 'yearly' ? PRODUCT_YEARLY : PRODUCT_MONTHLY;
    const res = await purchase(id);
    if (res?.ok) {
      Alert.alert(t('paywall_thanks_title'), t('paywall_thanks_msg'));
      onBack?.();
    } else if (res?.error) {
      Alert.alert(t('paywall_failed'), res.error);
    }
  }

  async function onRestore() {
    const res = await restore();
    if (res?.ok) {
      Alert.alert(
        res.restored ? t('paywall_thanks_title') : t('readFail'),
        res.restored ? t('paywall_restored') : t('paywall_no_restore'),
      );
      if (res.restored) onBack?.();
    } else if (res?.error) {
      Alert.alert(t('paywall_failed'), res.error);
    }
  }

  const ctaLabel = selected === 'monthly' ? t('paywall_start_trial') : t('paywall_start');

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack} hitSlop={10}>
        <Text style={styles.link}>
          {onboarding ? t('onboard_later') : t('backToLibrary')}
        </Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.title}>{t('paywall_title')}</Text>
        <Text style={styles.subtitle}>{t('paywall_subtitle')}</Text>

        <View style={styles.benefits}>
          <BenefitRow text={t('paywall_benefit_voice')} />
          <BenefitRow text={t('paywall_benefit_noads')} />
        </View>

        <PlanCard
          active={selected === 'monthly'}
          onPress={() => setSelected('monthly')}
          title={t('paywall_monthly')}
          price={monthlyPrice}
          badge={t('paywall_trial_badge')}
        />
        <PlanCard
          active={selected === 'yearly'}
          onPress={() => setSelected('yearly')}
          title={t('paywall_yearly')}
          price={yearlyPrice}
          badge={t('paywall_yearly_badge')}
          highlight
        />

        <TouchableOpacity
          style={[styles.cta, pro.busy && styles.ctaBusy]}
          onPress={onStart}
          disabled={pro.busy}
        >
          {pro.busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.ctaText}>{ctaLabel}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onRestore} style={styles.restoreBtn} disabled={pro.busy}>
          <Text style={styles.restoreText}>{t('settings_restore')}</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{t('paywall_disclaimer')}</Text>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLink}>{t('paywall_terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.legalLink}>{t('settings_privacy')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function BenefitRow({ text }) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function PlanCard({ active, onPress, title, price, badge, highlight }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.plan,
        active && styles.planActive,
        highlight && styles.planHighlight,
      ]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.planTitle}>{title}</Text>
        <Text style={styles.planPrice}>{price}</Text>
      </View>
      {badge ? (
        <View style={[styles.badge, highlight && styles.badgeAlt]}>
          <Text style={[styles.badgeText, highlight && styles.badgeTextAlt]}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={active ? ACCENT : '#cbd5e1'}
        style={{ marginLeft: 10 }}
      />
    </TouchableOpacity>
  );
}

function findProduct(products, id) {
  if (!products) return null;
  return products.find((p) => p?.productId === id || p?.id === id || p?.sku === id) || null;
}

const styles = StyleSheet.create({
  flex: { flex: 1, padding: 24, paddingTop: 16, backgroundColor: '#ffffff' },
  link: { color: FG, fontSize: 15 },
  title: { fontSize: 28, fontWeight: '800', color: INK, marginTop: 8 },
  subtitle: { fontSize: 15, color: MUTED, marginTop: 6, marginBottom: 22 },

  benefits: { marginBottom: 22 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  benefitText: { color: INK, fontSize: 16, marginLeft: 10 },

  plan: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BG, borderRadius: 14, padding: 16,
    marginBottom: 12,
    borderWidth: 2, borderColor: 'transparent',
  },
  planActive: { borderColor: ACCENT, backgroundColor: '#ffffff' },
  planHighlight: { backgroundColor: '#eef2ff' },
  planTitle: { color: INK, fontSize: 17, fontWeight: '700' },
  planPrice: { color: MUTED, fontSize: 14, marginTop: 2 },

  badge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  badgeAlt: { backgroundColor: '#4f46e5' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  badgeTextAlt: { color: '#fff' },

  cta: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 14,
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  restoreBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  restoreText: { color: FG, fontSize: 15 },

  disclaimer: { color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 18 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  legalLink: { color: FG, fontSize: 12, textDecorationLine: 'underline' },
  legalSep: { color: MUTED, marginHorizontal: 8, fontSize: 12 },
});
