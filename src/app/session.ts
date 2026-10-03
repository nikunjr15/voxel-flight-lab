/**
 * Per-tab memory for small choices: whether the visitor has been through the
 * loader, and whether they chose sound. sessionStorage can be missing or can
 * throw (private modes, blocked storage, sandboxed frames); every access is
 * wrapped, and a failure simply means the choice is not remembered.
 */
const PREFIX = 'vfl.';

export const session = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.sessionStorage.setItem(PREFIX + key, value);
    } catch {
      // Not remembered; nothing else depends on it.
    }
  },
};
