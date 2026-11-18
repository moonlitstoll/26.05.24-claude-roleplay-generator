// Opening the app without internet: registers public/sw.js and asks the browser to keep saved data.

const READY_MARK = '/__offline-ready'; // same value as public/sw.js

export const OFFLINE_MESSAGE = '인터넷 연결이 필요해요';

// false only when the device is certainly disconnected, so AI features are never blocked by a guess.
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export const offlineSupported = () =>
  process.env.NODE_ENV === 'production'
  && typeof navigator !== 'undefined'
  && 'serviceWorker' in navigator
  && typeof caches !== 'undefined';

export function registerOfflineShell() {
  if (!offlineSupported()) return;
  const url = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID || 'local')}`;
  const register = () => navigator.serviceWorker.register(url).catch(e => console.warn('[offline] register failed', e));
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

// Asks the browser not to clear saved scripts and audio when the device runs low on space.
// Chrome decides on its own without a prompt; a refusal just leaves things as they were.
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isOfflineReady() {
  try {
    if (!offlineSupported()) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) return false;
    return !!(await caches.match(READY_MARK));
  } catch {
    return false;
  }
}
