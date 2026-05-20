import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Minimal i18n. Default language is English; Japanese is opt-in via settings.
// Adding another language = add another block to STRINGS.

const STORAGE_KEY = 'snaplisten.lang';
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
  },
};

let currentLang = DEFAULT_LANG;
const listeners = new Set();

export async function initLanguage() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  currentLang = stored === 'ja' ? 'ja' : 'en';
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
