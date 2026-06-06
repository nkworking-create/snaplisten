import { useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';
import { isPro } from './pro';
import { synthesizeVoice } from './api';
import { ensureLocal } from './audioCache';

// Player state lives at module level so audio survives screen navigation.
// Components subscribe via usePlayer().

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// 1.00 button = natural pace for the device TTS. Tune SPEECH_BASE_RATE by ear.
const NORMAL_AT = 1.0;
const SPEECH_BASE_RATE = 1.0;
const toSpeechRate = (displayed) => (displayed / NORMAL_AT) * SPEECH_BASE_RATE;

let state = {
  session: null,
  index: null,
  speaking: false,
  loop: false,
  speed: 1.0,
  behavior: 'auto',  // 'auto' (respects loop) | 'through' (play to end)
  busy: false,       // synthesizing or downloading for the session
  mode: 'speech',    // 'speech' = device TTS | 'audio' = ElevenLabs mp3
};

let token = 0;
const listeners = new Set();
function notify() { for (const fn of listeners) fn(state); }
function patch(p) { state = { ...state, ...p }; notify(); }

export function getState() { return state; }

export function usePlayer() {
  const [, set] = useState(state);
  useEffect(() => {
    listeners.add(set);
    return () => { listeners.delete(set); };
  }, []);
  return state;
}

// --- session activation: choose path + pre-synth Pro voices ---
let activeSessionId = null;
let activeClips = null; // [{ text, hash, url }]

// Called when the PlayerScreen opens a session. Free users go straight to
// the speech path. Pro users get one batched ElevenLabs call up front
// (subsequent listens hit cache and play instantly).
export async function activate(session) {
  if (!session) {
    activeSessionId = null; activeClips = null;
    patch({ mode: 'speech' });
    return;
  }
  if (!isPro()) {
    activeSessionId = session.id; activeClips = null;
    patch({ mode: 'speech' });
    return;
  }
  if (activeSessionId === session.id && activeClips) {
    patch({ mode: 'audio' });
    return;
  }
  patch({ busy: true });
  try {
    const r = await synthesizeVoice(session.sentences);
    activeSessionId = session.id;
    activeClips = (r && Array.isArray(r.clips)) ? r.clips : null;
    patch({ mode: activeClips ? 'audio' : 'speech' });
  } catch (e) {
    console.warn('voice synth failed, falling back to speech:', e?.message);
    activeSessionId = session.id;
    activeClips = null;
    patch({ mode: 'speech' });
  } finally {
    patch({ busy: false });
  }
}

// --- audio playback engine (Pro path) ---
let audio = null;
let audioSub = null;

async function stopAudio() {
  try { audioSub?.remove?.(); } catch { /* ignore */ }
  audioSub = null;
  try { audio?.pause?.(); } catch { /* ignore */ }
  try { audio?.remove?.(); } catch { /* ignore */ }
  audio = null;
}

async function startAudioClip(uri, onFinish) {
  await stopAudio();
  audio = createAudioPlayer(uri);
  try { audio.playbackRate = state.speed; } catch { /* some platforms ignore */ }
  audio.play();
  try {
    audioSub = audio.addListener('playbackStatusUpdate', (s) => {
      if (s?.didJustFinish) onFinish?.();
    });
  } catch { /* if listener API differs we just won't auto-advance */ }
}

// --- main playback dispatcher ---
async function speakAt(session, i) {
  if (!session || !session.sentences || i < 0 || i >= session.sentences.length) return;
  const myToken = ++token;
  // Defensively stop both engines so paths can't double up.
  try { Speech.stop(); } catch { /* ignore */ }
  await stopAudio();
  patch({ session, index: i, speaking: true });

  const useAudio = state.mode === 'audio' && activeClips && activeClips[i];

  if (useAudio) {
    try {
      const local = await ensureLocal(activeClips[i]);
      if (myToken !== token) return;
      await startAudioClip(local, () => handleDone(session, i, myToken));
      return;
    } catch (e) {
      console.warn('audio play failed, falling back to speech:', e?.message);
      // fall through to device speech
    }
  }

  Speech.speak(session.sentences[i], {
    language: 'en-US',
    rate: toSpeechRate(state.speed),
    onDone: () => handleDone(session, i, myToken),
    onError: () => { if (myToken === token) patch({ speaking: false }); },
  });
}

function handleDone(session, i, myToken) {
  if (myToken !== token) return;
  const cur = state;
  if (cur.behavior !== 'through' && cur.loop) {
    speakAt(cur.session, i);
  } else if (i + 1 < cur.session.sentences.length) {
    speakAt(cur.session, i + 1);
  } else {
    patch({ speaking: false });
  }
}

// --- public controls (signatures unchanged) ---
export function tapSentence(session, i) {
  state.behavior = 'auto';
  speakAt(session, i);
}

export function playAll(session) {
  state.behavior = 'through';
  speakAt(session, 0);
}

export function togglePlay() {
  if (state.speaking) {
    token += 1;
    try { Speech.stop(); } catch { /* ignore */ }
    stopAudio();
    patch({ speaking: false });
    return;
  }
  if (!state.session) return;
  if (state.index == null) {
    state.behavior = 'through';
    speakAt(state.session, 0);
  } else {
    state.behavior = 'auto';
    speakAt(state.session, state.index);
  }
}

export function nextSentence() {
  if (!state.session) return;
  const n = (state.index ?? -1) + 1;
  if (n < state.session.sentences.length) speakAt(state.session, n);
}

export function prevSentence() {
  if (!state.session) return;
  const p = (state.index ?? 0) - 1;
  if (p >= 0) speakAt(state.session, p);
}

export function stopPlayback() {
  token += 1;
  try { Speech.stop(); } catch { /* ignore */ }
  stopAudio();
  patch({ session: null, index: null, speaking: false, behavior: 'auto' });
}

export function setLoop(v) { patch({ loop: !!v }); }

export function setSpeed(v) {
  patch({ speed: v });
  try { if (audio) audio.playbackRate = v; } catch { /* ignore */ }
}

export function cycleSpeed() {
  const i = SPEEDS.indexOf(state.speed);
  const v = SPEEDS[(i + 1) % SPEEDS.length];
  patch({ speed: v });
  try { if (audio) audio.playbackRate = v; } catch { /* ignore */ }
}

export function clearIfDeleted(id) {
  if (state.session && state.session.id === id) stopPlayback();
}
