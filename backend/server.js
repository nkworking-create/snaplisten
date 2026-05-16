// SnapListen relay server.
// Keeps API keys server-side so they are never shipped inside the mobile app.
// Two jobs:
//   POST /ocr  -> image (base64)        -> Gemini Flash -> clean English sentences
//   POST /tts  -> text                  -> ElevenLabs   -> mp3 audio (base64)

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
// Images arrive as base64 JSON, so allow a generous body size.
app.use(express.json({ limit: '20mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const PORT = process.env.PORT || 8787;

// Models proven in the tango-app stack: try the strong one, fall back to lite.
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OCR_PROMPT = [
  'You are an OCR engine for an English listening app.',
  'Extract ONLY the English text shown in this image.',
  'Fix obvious OCR artifacts (broken words, stray symbols, hyphenated line breaks).',
  'Ignore page numbers, running headers/footers, watermarks and UI chrome.',
  'Split the result into natural sentences suitable for reading aloud.',
  'Respond with JSON ONLY in this exact shape:',
  '{"text": "<full cleaned text>", "sentences": ["sentence 1", "sentence 2"]}',
  'If there is no readable English text, return {"text": "", "sentences": []}.',
].join(' ');

// --- OCR ---------------------------------------------------------------
async function callGemini(model, imageBase64, mimeType) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: OCR_PROMPT },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Last resort: pull the first {...} block out of the response.
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { text: raw.trim(), sentences: [] };
  }
  const text = (parsed.text || '').trim();
  let sentences = Array.isArray(parsed.sentences)
    ? parsed.sentences.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (sentences.length === 0 && text) sentences = [text];
  return { text, sentences };
}

app.post('/ocr', async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await callGemini(model, imageBase64, mimeType);
        return res.json(result);
      } catch (err) {
        lastErr = err;
        await sleep(400 * (attempt + 1));
      }
    }
  }
  console.error('OCR failed:', lastErr?.message);
  return res.status(502).json({ error: 'OCR failed', detail: lastErr?.message });
});

// --- TTS ---------------------------------------------------------------
app.post('/tts', async (req, res) => {
  const { text, voiceId } = req.body || {};
  if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set on server' });
  const clean = (text || '').trim();
  if (!clean) return res.status(400).json({ error: 'text is required' });

  const voice = voiceId || ELEVENLABS_VOICE_ID;
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`;

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`ElevenLabs ${r.status}: ${detail.slice(0, 300)}`);
      }
      const buf = Buffer.from(await r.arrayBuffer());
      return res.json({ audioBase64: buf.toString('base64'), mimeType: 'audio/mpeg' });
    } catch (err) {
      lastErr = err;
      await sleep(400 * (attempt + 1));
    }
  }
  console.error('TTS failed:', lastErr?.message);
  return res.status(502).json({ error: 'TTS failed', detail: lastErr?.message });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`SnapListen relay listening on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.warn('  ! GEMINI_API_KEY missing — /ocr will fail');
  if (!ELEVENLABS_API_KEY) console.warn('  ! ELEVENLABS_API_KEY missing — /tts will fail');
});
