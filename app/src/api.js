import { RELAY_URL } from './config';

// Send an image to the relay; get back clean English text + sentences.
export async function ocrImage(imageBase64, mimeType = 'image/jpeg') {
  const res = await fetch(`${RELAY_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `OCR failed (${res.status})`);
  }
  return res.json(); // { text, sentences }
}

// Send text to the relay; get back mp3 audio as base64.
export async function synthesize(text) {
  const res = await fetch(`${RELAY_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `TTS failed (${res.status})`);
  }
  return res.json(); // { audioBase64, mimeType }
}
