let quickBase64: any = null;
try {
  quickBase64 = require('react-native-quick-base64');
} catch (e) {
  // Safe fallback if module or JSI bindings are not loaded natively
}

export const base64Encode = (str: string): string => {
  if (quickBase64 && typeof quickBase64.fromByteArray === 'function') {
    try {
      const buf = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        buf[i] = str.charCodeAt(i);
      }
      return quickBase64.fromByteArray(buf);
    } catch (e) {
      // Fallback if JSI bindings throw runtime exceptions
    }
  }

  // Pure-JS character shifting fallback encoder
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let i = 0; i < str.length; i += 3) {
    const char1 = str.charCodeAt(i);
    const char2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
    const char3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;

    const byte1 = char1 >> 2;
    const byte2 = ((char1 & 3) << 4) | (isNaN(char2) ? 0 : char2 >> 4);
    const byte3 = isNaN(char2) ? 64 : ((char2 & 15) << 2) | (isNaN(char3) ? 0 : char3 >> 6);
    const byte4 = isNaN(char3) ? 64 : char3 & 63;

    encoded += chars[byte1] + chars[byte2] + (byte3 === 64 ? '=' : chars[byte3]) + (byte4 === 64 ? '=' : chars[byte4]);
  }
  return encoded;
};
