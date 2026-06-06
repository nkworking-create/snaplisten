// Bottom banner shown only to Free users.
// - Hides entirely when user is Pro
// - Hides entirely when the native AdMob module isn't loaded (Expo Go)
// - Always non-personalized (no ATT prompt required)
// - Uses Google's TestIds in __DEV__ so test builds never bill the real unit

import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { usePro } from '../pro';
import { ADMOB } from '../admobConfig';

let RNGMA = null;
try { RNGMA = require('react-native-google-mobile-ads'); } catch { /* native not present */ }

// In Expo Go the JS loads but the native bridge isn't there, so the BannerAd
// would crash on first render. Skip cleanly.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function AdBanner() {
  const pro = usePro();
  if (pro.isPro) return null;
  if (isExpoGo) return null;
  if (!RNGMA?.BannerAd) return null;

  const { BannerAd, BannerAdSize, TestIds } = RNGMA;
  const realUnit = Platform.OS === 'ios' ? ADMOB.iosBannerUnitId : ADMOB.androidBannerUnitId;
  const unitId = __DEV__ ? TestIds.BANNER : realUnit;

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#ffffff' }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}
