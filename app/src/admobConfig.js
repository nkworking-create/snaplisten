// AdMob IDs.
// These are NOT secrets — they ship inside the binary and are visible to
// anyone who decompiles the app. So storing them in source is fine.
//
// Replace the placeholder values once you have your real AdMob app and
// banner unit (apps.admob.com -> Apps -> SnapListen -> Ad units).
//
// In development builds (__DEV__) we always use Google's TestIds so we
// never accidentally rack up impressions on the real unit during testing.

export const ADMOB = {
  // From AdMob -> Apps -> SnapListen -> "App ID" (format: ca-app-pub-XXX~XXX).
  iosAppId: 'ca-app-pub-9314100420710496~8153092846',
  androidAppId: 'ca-app-pub-3940256099942544~3347511713', // placeholder until Android ship

  // From AdMob -> Apps -> SnapListen -> Ad units -> Banner (format: ca-app-pub-XXX/XXX).
  iosBannerUnitId: 'ca-app-pub-9314100420710496/8282075038',
  androidBannerUnitId: 'ca-app-pub-3940256099942544/6300978111', // placeholder until Android ship
};
