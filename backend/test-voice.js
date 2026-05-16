// Quick voice check — no app, no server needed.
//   1) put your ElevenLabs key in backend/.env  (ELEVENLABS_API_KEY=...)
//   2) run:  npm run voice
//   3) open the voice-samples folder and play the mp3s
//
// Generates the SAME sentence in a few good English voices so you can
// pick the one for the app. Uses eleven_multilingual_v2 — exactly what
// the real app uses, so what you hear == what users will hear.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const API_KEY = process.env.ELEVENLABS_API_KEY;

// A sentence with statements, a contrast and a pause — good for judging prosody.
const SAMPLE_TEXT =
  "Learning a new language is hard at first. But every day, it gets a little easier. " +
  "Keep going — you're closer than you think.";

// Classic, clear English voices. Order = my pick for a learning app.
const VOICES = [
  { name: 'Rachel', id: '21m00Tcm4TlvDq8ikWAM', note: 'US female, calm & clear' },
  { name: 'Adam',   id: 'pNInz6obpgDQGcFmaJgB', note: 'US male, deep' },
  { name: 'Antoni', id: 'ErXwobaYiN019PkySvjV', note: 'US male, warm' },
  { name: 'Bella',  id: 'EXAVITQu4vr4xnSDxMaL', note: 'US female, soft' },
];

const OUT_DIR = path.join(__dirname, 'voice-samples');

async function generate(voice) {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: SAMPLE_TEXT,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${detail.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT_DIR, `${voice.name}.mp3`);
  fs.writeFileSync(file, buf);
  return file;
}

(async () => {
  if (!API_KEY) {
    console.error(
      '\n  ELEVENLABS_API_KEY が見つかりません。\n\n' +
      '  1) https://elevenlabs.io で無料アカウントを作る（無料枠で十分テストできる）\n' +
      '  2) backend\\.env を作って次の行を入れる:\n' +
      '       ELEVENLABS_API_KEY=ここに貼る\n' +
      '  3) もう一度  npm run voice\n'
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n台詞: "${SAMPLE_TEXT}"\n`);

  for (const v of VOICES) {
    process.stdout.write(`  ${v.name} (${v.note}) ... `);
    try {
      await generate(v);
      console.log('OK');
    } catch (e) {
      console.log(`失敗: ${e.message}`);
    }
  }

  console.log(`\n完成 → ${OUT_DIR}`);
  console.log('そのフォルダの mp3 を再生して、好きな声を選んで教えて。\n');

  // Best-effort: open the folder on Windows so you can just click-play.
  if (process.platform === 'win32') {
    exec(`explorer "${OUT_DIR}"`, () => {});
  }
})();
