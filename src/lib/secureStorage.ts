/**
 * Secure Storage Utility for local storage encryption and minimization.
 * Prevents plain-text data exposure in browser storage.
 */

const SECURE_KEY = "YS_SVC_SECURE_STORAGE_KEY_2026";

// Simple XOR cipher + Base64 encoding for client-side local storage obfuscation/encryption
function encrypt(text: string): string {
  const textChars = Array.from(text);
  const keyChars = Array.from(SECURE_KEY);
  const encrypted = textChars.map((char, index) => {
    const keyChar = keyChars[index % keyChars.length];
    return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
  }).join('');
  
  // Convert to Base64 to ensure safe characters for localStorage
  try {
    return btoa(encodeURIComponent(encrypted));
  } catch {
    return btoa(encrypted);
  }
}

function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  let decoded = '';
  try {
    decoded = decodeURIComponent(atob(cipherText));
  } catch {
    try {
      decoded = atob(cipherText);
    } catch {
      return '';
    }
  }

  const textChars = Array.from(decoded);
  const keyChars = Array.from(SECURE_KEY);
  return textChars.map((char, index) => {
    const keyChar = keyChars[index % keyChars.length];
    return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
  }).join('');
}

export const secureStorage = {
  setItem: (key: string, value: any): void => {
    try {
      // Minimize: do not store tokens or any sensitive password information in local storage.
      let sanitizedValue = value;
      if (value && typeof value === 'object') {
        // Clone and strip sensitive token property if present
        const { token, password, ...rest } = value;
        sanitizedValue = rest;
      }

      const jsonStr = JSON.stringify(sanitizedValue);
      const encryptedStr = encrypt(jsonStr);
      localStorage.setItem(key, encryptedStr);
    } catch (err) {
      console.error("Secure storage setItem error:", err);
    }
  },

  getItem: <T = any>(key: string): T | null => {
    try {
      const encryptedStr = localStorage.getItem(key);
      if (!encryptedStr) return null;
      
      const decryptedStr = decrypt(encryptedStr);
      if (!decryptedStr) return null;
      
      return JSON.parse(decryptedStr) as T;
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
