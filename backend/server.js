// SnapListen relay server.
// Keeps API keys server-side so they are never shipped inside the mobile app.
//   POST /ocr  -> image (base64) -> Gemini Flash -> clean English sentences
//   POST /tts  -> text           -> Gemini TTS (free, default)
//                                    or ElevenLabs (premium, paid tier)
//
// The TTS provider is the hybrid lever: free users get Gemini voice,
// paid users get ElevenLabs. Default is Gemini; switch per request with
// { provider: 'elevenlabs' } or globally with TTS_PROVIDER in .env.

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
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';
const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'gemini').toLowerCase();
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
        return res.json(await callGemini(model, imageBase64, mimeType));
      } catch (err) {
        lastErr = err;
        await sleep(400 * (attempt + 1));
      }
    }
  }
  console.error('OCR failed:', lastErr?.message);
  return res.status(502).json({ error: 'OCR failed', detail: lastErr?.message });
});

// --- TTS: shared helpers ----------------------------------------------
// Gemini TTS returns raw PCM. Wrap it in a 44-byte WAV header so the
// phone can play it directly (no audio library / no transcoding needed).
function wavFromPcm(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Free path: Gemini TTS.
async function callGeminiTts(text) {
  const model = 'gemini-2.5-flash-preview-tts';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `Read this aloud clearly, at a natural, easy-to-follow pace:\n\n${text}` },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } },
        },
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini TTS ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error('Gemini TTS returned no audio');
  const mime = part?.inlineData?.mimeType || 'audio/L16;rate=24000';
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000;
  const wav = wavFromPcm(Buffer.from(b64, 'base64'), rate);
  return { audioBase64: wav.toString('base64'), mimeType: 'audio/wav' };
}

// Premium path: ElevenLabs (used by the paid tier later).
async function callElevenLabs(text, voiceId) {
  const voice = voiceId || ELEVENLABS_VOICE_ID;
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`ElevenLabs ${r.status}: ${detail.slice(0, 300)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return { audioBase64: buf.toString('base64'), mimeType: 'audio/mpeg' };
}

app.post('/tts', async (req, res) => {
  const clean = (req.body?.text || '').trim();
  if (!clean) return res.status(400).json({ error: 'text is required' });

  const provider = (req.body?.provider || TTS_PROVIDER).toLowerCase();
  if (provider === 'elevenlabs' && !ELEVENLABS_API_KEY)
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set on server' });
  if (provider !== 'elevenlabs' && !GEMINI_API_KEY)
    return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out =
        provider === 'elevenlabs'
          ? await callElevenLabs(clean, req.body?.voiceId)
          : await callGeminiTts(clean);
      return res.json(out);
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
  console.log(`SnapListen relay on http://localhost:${PORT}  (TTS: ${TTS_PROVIDER})`);
  if (!GEMINI_API_KEY) console.warn('  ! GEMINI_API_KEY missing — /ocr and Gemini /tts will fail');
});
