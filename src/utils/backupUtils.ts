/**
 * Simple Base64-based backup utilities.
 * We've removed the encryption layer for easier community editing of backup files.
 */

export function encodeBackup(plaintext: string): string {
  // Use btoa for Base64 encoding. Since we're dealing with UTF-8 strings, 
  // we first encode to a byte string to handle special characters.
  const byteString = unescape(encodeURIComponent(plaintext));
  return btoa(byteString);
}

export function decodeBackup(base64: string): string {
  try {
    const byteString = atob(base64);
    return decodeURIComponent(escape(byteString));
  } catch (err) {
    throw new Error('INVALID_BACKUP_FORMAT');
  }
}
