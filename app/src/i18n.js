import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Minimal i18n. Default language is English; Japanese is opt-in via settings.
// Adding another language = add another block to STRINGS.

const STORAGE_KEY = 'snaplisten.lang.v2'; // bumped: forget pre-fix 'en' preferences
const DEFAULT_LANG = 'ja';

const STRINGS = {
  en: {
    appTitle: 'SnapListen',
    appSubtitle: 'Snap any English. Listen. Repeat.',

    emptyLine1: 'No sessions yet.',
    emptyLine2: 'Tap the button below to add English.',
    newButton: '+  New  (Camera / Photos)',

    pick_heading: 'Add English text',
    takePhoto: 'Take a photo',
    pickPhoto: 'Choose from photos',
    cancelLink: '← Back to library',

    cameraPermNeeded: 'Camera permission needed',
    cameraPermAsk: 'Allow Camera in Settings.',

    ocrLoading: 'Reading text…',
    notFoundTitle: 'No English text found',
    notFoundMsg: 'Try a clearer photo.',
    readFail: 'Recognition failed',

    review_heading: 'Recognized text (edit if needed)',
    placeholder_text: 'The recognized English will appear here.',
    redo: 'Redo',
    next: 'Next',

    title_heading: 'Give it a title',
    title_subtitle: 'The name shown in your library.',
    titlePlaceholder: 'Title',
    back: 'Back',
    saveAndListen: 'Save & Listen',
    emptyTextTitle: 'Text is empty',
    emptyTextMsg: 'Enter some English text to save.',
    saving: 'Saving…',
    saveFail: 'Save failed',

    backToLibrary: '← Library',
    playerHint: 'Tap a sentence to play it',
    noSentences: 'No sentences. Take a photo again.',
    playAll: 'Play from the beginning',
    deleteSession: 'Delete this session',

    deleteConfirmTitle: 'Delete this session?',
    deleteConfirmMsg: 'It will be removed.',
    cancel: 'Cancel',
    deleteAction: 'Delete',

    renamePromptTitle: 'Rename',
    renameSave: 'Save',
    renameUnsupported: 'Not supported',
    renameUnsupportedMsg: 'Renaming is not available on this device.',

    settings_title: 'Settings',
    settings_language: 'Language',
    settings_pro: 'Pro',
    settings_proTeaser: 'Coming soon: natural human voices.',
    settings_upgrade: 'Upgrade to Pro',
    settings_restore: 'Restore purchases',
    settings_about: 'About',
    settings_version: 'Version',
    settings_privacy: 'Privacy policy',
    settings_contact: 'Contact',
    comingSoonTitle: 'Coming soon',
    comingSoonMsg: 'This will be available in a future update.',

    nowPlaying: 'Now playing',
    a11y_prev: 'Previous sentence',
    a11y_next: 'Next sentence',
    a11y_playPause: 'Play / pause',
    a11y_stop: 'Stop',

    lang_en: 'English',
    lang_ja: '日本語',

    paywall_title: 'Upgrade to Pro',
    paywall_subtitle: 'More natural voices. No ads.',
    paywall_benefit_voice: 'Listen with natural human voices',
    paywall_benefit_noads: 'No ads',
    paywall_monthly: 'Monthly',
    paywall_yearly: 'Yearly',
    paywall_monthly_price_fallback: '¥480 / month',
    paywall_yearly_price_fallback: '¥3,800 / year',
    paywall_trial_badge: '7-day free trial',
    paywall_yearly_badge: 'Save 33%',
    paywall_start: 'Start subscription',
    paywall_start_trial: 'Start free trial',
    paywall_terms: 'Terms of Use',
    paywall_disclaimer: 'Subscription auto-renews at the listed price unless canceled at least 24 hours before the period ends. Manage or cancel anytime in iPhone Settings → Apple ID → Subscriptions. Free trials end automatically if canceled before the last 24 hours.',
    paywall_thanks_title: 'Thanks for subscribing!',
    paywall_thanks_msg: 'Pro is now active. Enjoy natural voices and ad-free listening.',
    paywall_restored: 'Purchases restored.',
    paywall_no_restore: 'No active purchases found.',
    paywall_failed: 'Purchase could not be completed.',
  },
  ja: {
    appTitle: 'SnapListen',
    appSubtitle: '撮った英文を、聴いて繰り返す。',

    emptyLine1: 'まだセッションがありません。',
    emptyLine2: '下のボタンから英文を取り込もう。',
    newButton: '＋  新規（撮る / 選ぶ）',

    pick_heading: '英文を取り込む',
    takePhoto: 'カメラで撮る',
    pickPhoto: '写真から選ぶ',
    cancelLink: '← ライブラリに戻る',

    cameraPermNeeded: 'カメラ権限が必要',
    cameraPermAsk: '設定からカメラを許可してね。',

    ocrLoading: '文字を読み取り中…',
    notFoundTitle: '英文が見つからなかった',
    notFoundMsg: 'もう一度、はっきり写った写真で試して。',
    readFail: '読み取り失敗',

    review_heading: '読み取り結果（直せるよ）',
    placeholder_text: '認識された英文がここに出ます',
    redo: 'やり直す',
    next: '次へ',

    title_heading: 'タイトルをつけよう',
    title_subtitle: 'ライブラリに表示される名前です。',
    titlePlaceholder: 'タイトル',
    back: '戻る',
    saveAndListen: '保存して聴く',
    emptyTextTitle: 'テキストが空',
    emptyTextMsg: '保存する英文を入れてね。',
    saving: '保存中…',
    saveFail: '保存に失敗',

    backToLibrary: '← ライブラリ',
    playerHint: '文をタップ＝その文を再生',
    noSentences: '文がありません。撮り直してね。',
    playAll: '最初から通し再生',
    deleteSession: 'このセッションを削除',

    deleteConfirmTitle: '削除する？',
    deleteConfirmMsg: 'このセッションを消します。',
    cancel: 'やめる',
    deleteAction: '削除',

    renamePromptTitle: 'タイトルを変更',
    renameSave: '保存',
    renameUnsupported: '未対応',
    renameUnsupportedMsg: 'この端末ではタイトル変更に未対応です。',

    settings_title: '設定',
    settings_language: '言語',
    settings_pro: 'Pro',
    settings_proTeaser: '近日公開：自然な人間の声',
    settings_upgrade: 'Proにアップグレード',
    settings_restore: '購入を復元',
    settings_about: 'このアプリについて',
    settings_version: 'バージョン',
    settings_privacy: 'プライバシーポリシー',
    settings_contact: 'お問い合わせ',
    comingSoonTitle: '近日公開',
    comingSoonMsg: '今後のアップデートで対応予定です。',

    nowPlaying: '再生中',
    a11y_prev: '前の文',
    a11y_next: '次の文',
    a11y_playPause: '再生 / 一時停止',
    a11y_stop: '停止',

    lang_en: 'English',
    lang_ja: '日本語',

    paywall_title: 'Proにアップグレード',
    paywall_subtitle: '自然な声で。広告なしで。',
    paywall_benefit_voice: '自然な人間の声で聴ける',
    paywall_benefit_noads: '広告を表示しない',
    paywall_monthly: '月額',
    paywall_yearly: '年額',
    paywall_monthly_price_fallback: '月額 ¥480',
    paywall_yearly_price_fallback: '年額 ¥3,800',
    paywall_trial_badge: '7日間無料',
    paywall_yearly_badge: '33% OFF',
    paywall_start: 'サブスクリプションを開始',
    paywall_start_trial: '無料トライアルを開始',
    paywall_terms: '利用規約',
    paywall_disclaimer: 'サブスクリプションは、期間終了の24時間以上前にキャンセルしない限り、自動的に同額で更新されます。iPhoneの「設定 → Apple ID → サブスクリプション」からいつでも管理・解約できます。無料トライアルは、終了の24時間前までに解約すれば料金は発生しません。',
    paywall_thanks_title: 'ご購読ありがとうございます',
    paywall_thanks_msg: 'Proが有効になりました。自然な声と広告非表示でお楽しみください。',
    paywall_restored: '購入を復元しました。',
    paywall_no_restore: '復元できる購入が見つかりませんでした。',
    paywall_failed: '購入を完了できませんでした。',
  },
};

let currentLang = DEFAULT_LANG;
const listeners = new Set();

export async function initLanguage() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  currentLang = (stored === 'en' || stored === 'ja') ? stored : DEFAULT_LANG;
  listeners.forEach((fn) => fn(currentLang));
}

export function getLang() { return currentLang; }

export async function setLanguage(lang) {
  currentLang = lang === 'ja' ? 'ja' : 'en';
  await AsyncStorage.setItem(STORAGE_KEY, currentLang);
  listeners.forEach((fn) => fn(currentLang));
}

export function t(key) {
  const dict = STRINGS[currentLang] || STRINGS.en;
  return dict[key] ?? STRINGS.en[key] ?? key;
}

// Hook: re-renders the component whenever the language changes.
export function useLanguage() {
  const [lang, setLang] = useState(currentLang);
  useEffect(() => {
    listeners.add(setLang);
    return () => listeners.delete(setLang);
  }, []);
  return lang;
}
