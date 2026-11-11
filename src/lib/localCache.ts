/**
 * Local Cache Utility for browser localStorage serialization.
 * NOTE: This utility only performs Base64 + URI encoding for structured storage.
 * It is NOT cryptographic encryption and must never be used to store passwords,
 * JWTs, session tokens, or other sensitive secrets.
 */

function encodeData(text: string): string {
  try {
    return btoa(encodeURIComponent(text));
  } catch {
    return btoa(text);
  }
}

function decodeData(encodedText: string): string {
  if (!encodedText) return '';
  try {
    return decodeURIComponent(atob(encodedText));
  } catch {
    try {
      return atob(encodedText);
    } catch {
      return '';
    }
  }
}

function sanitizeCachedObject(item: any, key?: string): any {
  if (!item || typeof item !== 'object') return item;
  if (key === 'smartfix_current_user') {
    return {
      id: item.id,
      username: item.username,
      name: item.name,
      role: item.role,
    };
  }
  const { password, token, ...rest } = item;
  return rest;
}

export const localCache = {
  setItem: (key: string, value: any): void => {
    try {
      let sanitizedValue = value;
      if (Array.isArray(value)) {
        sanitizedValue = value.map((item) => sanitizeCachedObject(item));
      } else if (value && typeof value === 'object') {
        sanitizedValue = sanitizeCachedObject(value, key);
      }

      const jsonStr = JSON.stringify(sanitizedValue);
      const encodedStr = encodeData(jsonStr);
      localStorage.setItem(key, encodedStr);
    } catch (err) {
      console.error('Local cache setItem error:', err);
    }
  },

  getItem: <T = any>(key: string): T | null => {
    try {
      const encodedStr = localStorage.getItem(key);
      if (!encodedStr) return null;

      const decodedStr = decodeData(encodedStr);
      if (!decodedStr) return null;

      return JSON.parse(decodedStr) as T;
    } catch (err) {
      console.warn(`Local cache getItem error for key "${key}". Returning fallback.`, err);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error('Local cache removeItem error:', err);
    }
  },

  /**
   * Clears all `smartfix_*` and `ys_cached_*` keys from localStorage while keeping `remember_username`.
   */
  clearSessionCache: (): void => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('smartfix_') || k.startsWith('ys_cached_'))) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch (err) {
      console.error('Local cache clearSessionCache error:', err);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (err) {
      console.error('Local cache clear error:', err);
    }
  },
};
