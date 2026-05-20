import { useEffect, useState } from 'react';
import * as Speech from 'expo-speech';

// Player state lives at the module level so audio survives screen
// navigation. Components subscribe via usePlayer().

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// 1.00 button = natural pace. Tune SPEECH_BASE_RATE by ear if needed.
const NORMAL_AT = 1.0;
const SPEECH_BASE_RATE = 1.0;
const toRate = (displayed) => (displayed / NORMAL_AT) * SPEECH_BASE_RATE;

let state = {
  session: null,
  index: null,
  speaking: false,
  loop: true,
  speed: 1.0,
  behavior: 'auto', // 'auto' (respects loop) | 'through' (play to end)
};

let token = 0;
const listeners = new Set();
function notify() {
  for (const fn of listeners) fn(state);
}
function patch(p) {
  state = { ...state, ...p };
  notify();
}

export function getState() { return state; }

export function usePlayer() {
  const [, set] = useState(state);
  useEffect(() => {
    listeners.add(set);
    return () => { listeners.delete(set); };
  }, []);
  return state;
}

function speakAt(session, i) {
  if (!session || !session.sentences || i < 0 || i >= session.sentences.length) return;
  const myToken = ++token;
  Speech.stop();
  patch({ session, index: i, speaking: true });
  Speech.speak(session.sentences[i], {
    language: 'en-US',
    rate: toRate(state.speed),
    onDone: () => {
      if (myToken !== token) return;
      const cur = state;
      if (cur.behavior !== 'through' && cur.loop) {
        speakAt(cur.session, i);
      } else if (i + 1 < cur.session.sentences.length) {
        speakAt(cur.session, i + 1);
      } else {
        patch({ speaking: false });
      }
    },
    onError: () => { if (myToken === token) patch({ speaking: false }); },
  });
}

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
    Speech.stop();
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
  Speech.stop();
  patch({ session: null, index: null, speaking: false, behavior: 'auto' });
}

export function setLoop(v) { patch({ loop: !!v }); }
export function setSpeed(v) { patch({ speed: v }); }
export function cycleSpeed() {
  const i = SPEEDS.indexOf(state.speed);
  patch({ speed: SPEEDS[(i + 1) % SPEEDS.length] });
}

// Stop and clear if the deleted session was the playing one.
export function clearIfDeleted(id) {
  if (state.session && state.session.id === id) stopPlayback();
}
