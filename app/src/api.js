import { RELAY_URL } from './config';
import { ensureToken, refreshToken } from './auth';

// Turn a server error payload into a message worth showing the user.
function friendly(status, err) {
  const code = err.error;
  if (code === 'daily_limit' && err.scope === 'ocr')
    return '今日の読み取り上限に達しました。また明日試してね。';
  if (code === 'daily_limit' && err.scope === 'tts')
    return '今日の音声作成の上限に達しました。また明日試してね。';
  if (code === 'rate_limited') return 'アクセスが集中しています。少し待ってからもう一度。';
  if (code === 'too_many_registrations') return '登録の試行が多すぎます。少し待ってね。';
  if (code === 'image_too_large') return '画像が大きすぎます。別の写真で試してね。';
  if (code === 'text_too_long') return 'テキストが長すぎます。短くしてね。';
  if (code === 'not_an_image') return '画像ファイルを選んでね。';
  if (code === 'blocked') return 'このデバイスはブロックされています。';
  if (status === 401) return '認証に失敗しました。アプリを再起動してみて。';
  return err.detail || err.error || `通信エラー (${status})`;
}

// POST with our install token. Retries once if the token went stale.
async function authedPost(path, payload) {
  let token = await ensureToken();

  const send = (t) =>
    fetch(`${RELAY_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(payload),
    });

  let res = await send(token);
  if (res.status === 401) {
    token = await refreshToken();
    res = await send(token);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(friendly(res.status, err));
  }
  return res.json();
}

// Image -> clean English text + sentences.
export function ocrImage(imageBase64, mimeType = 'image/jpeg') {
  return authedPost('/ocr', { imageBase64, mimeType }); // { text, sentences }
}

// Text -> audio (base64) + its mimeType.
export function synthesize(text) {
  return authedPost('/tts', { text }); // { audioBase64, mimeType }
}

// Sentences -> one audio clip each, so the app can loop a single sentence.
export function synthesizeSentences(texts) {
  return authedPost('/tts-batch', { texts }); // { clips: [{ text, audioBase64, mimeType }] }
}
