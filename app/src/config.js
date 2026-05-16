import Constants from 'expo-constants';

// Where the relay backend lives.
//
// During development the phone must reach your PC over the LAN — "localhost"
// from the phone means the phone itself, not your computer. So by default we
// reuse the IP that Expo's dev server is already running on and just swap the
// port to the backend's port (8787).
//
// If you deploy the backend (e.g. to Render), set MANUAL_RELAY_URL to that
// public https URL and it will be used instead.

const MANUAL_RELAY_URL = ''; // e.g. 'https://snaplisten-relay.onrender.com'
const BACKEND_PORT = 8787;

function devRelayUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:${BACKEND_PORT}`;
  return `http://localhost:${BACKEND_PORT}`;
}

export const RELAY_URL = MANUAL_RELAY_URL || devRelayUrl();
