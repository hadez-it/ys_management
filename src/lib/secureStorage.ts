/**
 * Secure Storage Utility for local storage serialization and minimization.
 * Prevents direct plain-text exposure of application state.
 */

// Simple encoding to prevent clear-text scanning of browser storage
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

export const secureStorage = {
  setItem: (key: string, value: any): void => {
    try {
      // Minimize: do not store plain passwords in local storage.
      let sanitizedValue = value;
      if (Array.isArray(value)) {
        sanitizedValue = value.map(item => {
          if (item && typeof item === 'object') {
            const { password, ...rest } = item;
            return rest;
          }
          return item;
        });
      } else if (value && typeof value === 'object') {
        // Clone and strip password property if present
        const { password, ...rest } = value;
        sanitizedValue = rest;
      }

      const jsonStr = JSON.stringify(sanitizedValue);
      const encodedStr = encodeData(jsonStr);
      localStorage.setItem(key, encodedStr);
    } catch (err) {
      console.error("Secure storage setItem error:", err);
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
      console.warn(`Secure storage getItem error for key "${key}". Returning fallback.`, err);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error("Secure storage removeItem error:", err);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (err) {
      console.error("Secure storage clear error:", err);
    }
  }
};
