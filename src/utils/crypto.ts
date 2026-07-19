/**
 * Privacy-First Cryptography Module
 * Implements high-grade client-side encryption using the browser's native Web Crypto API (AES-GCM with PBKDF2).
 * Runs completely locally on the user's device (no servers, no external tracking).
 */

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = '';
  const len = array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

/**
 * Encrypts a plaintext string using a user-provided password.
 * Derives an AES-GCM key using PBKDF2 with 100,000 iterations.
 */
export async function encryptData(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const rawData = enc.encode(plaintext);

  // Generate a random 16-byte salt for PBKDF2
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  // Generate a random 12-byte IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Import password as a base key
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the AES-GCM 256-bit key from password + salt
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt the data
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    rawData
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Encode everything to base64
  const saltB64 = uint8ArrayToBase64(salt);
  const ivB64 = uint8ArrayToBase64(iv);
  const ciphertextB64 = uint8ArrayToBase64(ciphertext);

  // Return formatted payload
  return `v1:${saltB64}:${ivB64}:${ciphertextB64}`;
}

/**
 * Decrypts a secure payload using the user-provided password.
 */
export async function decryptData(encryptedPayload: string, password: string): Promise<string> {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported or corrupted backup format.');
  }

  const [, saltB64, ivB64, ciphertextB64] = parts;
  const salt = base64ToUint8Array(saltB64);
  const iv = base64ToUint8Array(ivB64);
  const ciphertext = base64ToUint8Array(ciphertextB64);

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Import password as a base key
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the same AES-GCM key
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt the ciphertext
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    ciphertext
  );

  return dec.decode(decryptedBuffer);
}
