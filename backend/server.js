// SnapListen relay server.
// Keeps API keys server-side so they are never shipped inside the mobile app.
//   POST /register -> issues a per-install token (light auth gate)
//   POST /ocr      -> image -> Gemini Flash -> clean English sentences
//   POST /tts      -> text  -> Gemini TTS (free default) or ElevenLabs (paid)
//
// Abuse guard (the financial safety net — kept FULL from day one):
//   1. light auth gate : app-secret to register, signed token on every call
//   2. hard caps        : per-install daily quota + per-IP burst limit
//   3. input caps       : max image size, max TTS text length
//   4. control          : per-install usage logs + instant block list
// The auth gate is intentionally "light" for launch; swap to App Attest
// later (see README). Caps + logging are what actually bound the cost.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1); // Render/!proxies: get the real client IP
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';
const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'gemini').toLowerCase();
const PORT = process.env.PORT || 8787;

// --- abuse guard config -----------------------------------------------
const APP_SECRET = process.env.APP_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const OCR_DAILY = Number(process.env.OCR_DAILY || 60);
const TTS_DAILY = Number(process.env.TTS_DAILY || 60);
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 8 * 1024 * 1024);
const MAX_TTS_CHARS = Number(process.env.MAX_TTS_CHARS || 1500);
const BLOCKED = new Set(
  (process.env.BLOCKED_INSTALLS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- abuse guard: per-install daily quota (in-memory) ------------------
// In-memory is fine at launch scale (single Render instance). It resets
// on restart/redeploy — acceptable now; move to a store when traffic grows.
const usage = new Map(); // installId -> { date, ocr, tts }
const today = () => new Date().toISOString().slice(0, 10);

function consume(installId, kind) {
  const limit = kind === 'ocr' ? OCR_DAILY : TTS_DAILY;
  let u = usage.get(installId);
  if (!u || u.date !== today()) {
    u = { date: today(), ocr: 0, tts: 0 };
    usage.set(installId, u);
  }
  if (u[kind] >= limit) return { ok: false, count: u[kind], limit };
  u[kind] += 1;
  return { ok: true, count: u[kind], limit };
}

// Per-IP burst backstop (protects /register and the paid endpoints).
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 8,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'too_many_registrations' },
});
const callLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'rate_limited' },
});

// Auth gate: every /ocr and /tts call must carry a token we issued.
function requireToken(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'unauthorized' });
  try {
    const { installId } = jwt.verify(m[1], JWT_SECRET);
    if (!installId || BLOCKED.has(installId))
      return res.status(403).json({ error: 'blocked' });
    req.installId = installId;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

app.post('/register', registerLimiter, (req, res) => {
  if (APP_SECRET && req.headers['x-app-secret'] !== APP_SECRET)
    return res.status(401).json({ error: 'bad_app_secret' });
  const installId = String(req.body?.installId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(installId))
    return res.status(400).json({ error: 'bad_install_id' });
  const token = jwt.sign({ installId }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token });
});

// --- OCR ---------------------------------------------------------------
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

app.post('/ocr', callLimiter, requireToken, async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
  if (mimeType && !String(mimeType).startsWith('image/'))
    return res.status(400).json({ error: 'not_an_image' });
  if (Buffer.byteLength(imageBase64, 'base64') > MAX_IMAGE_BYTES)
    return res.status(413).json({ error: 'image_too_large' });

  const gate = consume(req.installId, 'ocr');
  if (!gate.ok) return res.status(429).json({ error: 'daily_limit', scope: 'ocr', limit: gate.limit });
  console.log(`ocr  install=${req.installId.slice(0, 8)} ${gate.count}/${gate.limit}`);

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

// --- TTS ---------------------------------------------------------------
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

async function callGeminiTts(text) {
  const model = 'gemini-2.5-flash-preview-tts';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: `Read this aloud clearly, at a natural, easy-to-follow pace:\n\n${text}` }] },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } } },
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

app.post('/tts', callLimiter, requireToken, async (req, res) => {
  const clean = (req.body?.text || '').trim();
  if (!clean) return res.status(400).json({ error: 'text is required' });
  if (clean.length > MAX_TTS_CHARS)
    return res.status(413).json({ error: 'text_too_long', max: MAX_TTS_CHARS });

  const provider = (req.body?.provider || TTS_PROVIDER).toLowerCase();
  if (provider === 'elevenlabs' && !ELEVENLABS_API_KEY)
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set on server' });
  if (provider !== 'elevenlabs' && !GEMINI_API_KEY)
    return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });

  const gate = consume(req.installId, 'tts');
  if (!gate.ok) return res.status(429).json({ error: 'daily_limit', scope: 'tts', limit: gate.limit });
  console.log(`tts  install=${req.installId.slice(0, 8)} ${gate.count}/${gate.limit} provider=${provider}`);

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
  if (!APP_SECRET) console.warn('  ! APP_SECRET not set — registration is OPEN (set it before public launch)');
  if (!process.env.JWT_SECRET) console.warn('  ! JWT_SECRET not set — using a random one (tokens reset on restart)');
});
