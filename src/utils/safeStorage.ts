// localStorage can throw (private mode, storage full, blocked site data).
// A failed read or write must never take the app down.

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored. */
export function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[storage] could not save ${key}`, e);
    return false;
  }
}
