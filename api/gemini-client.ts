import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Initialize dotenv in non-production environments to load local .env variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * Dynamic retriever that scans environment variables for any configured Gemini API keys.
 * Captures the default `GEMINI_API_KEY` as well as any numbered variables such as
 * `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, etc.
 * 
 * @returns {string[]} List of unique Gemini API keys found.
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];

  // 1. Check primary default key
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }

  // 2. Try sequential indices (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
  let index = 1;
  while (true) {
    const key = process.env[`GEMINI_API_KEY_${index}`];
    if (key) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
      index++;
    } else {
      break;
    }
  }

  // 3. Fallback: scan all environment variables to catch non-sequential numbered keys
  for (const envKey of Object.keys(process.env)) {
    if (envKey.startsWith('GEMINI_API_KEY_')) {
      const keyVal = process.env[envKey];
      if (keyVal && !keys.includes(keyVal)) {
        keys.push(keyVal);
      }
    }
  }

  return keys;
}

// Persistent index tracking the currently active API key across requests
let activeKeyIndex = 0;

/**
 * Executes a Gemini content generation request with automatic API key failover/rotation.
 * If a rate limit or quota exceeded error is returned by a key, it automatically switches
 * to the next available key and retries the request.
 * 
 * @param requestConfig The parameters passed to GoogleGenAI models.generateContent.
 * @returns {Promise<any>} The response object from Gemini.
 */
export async function generateContentWithRotation(requestConfig: any): Promise<any> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('Gemini API key is missing. Please configure GEMINI_API_KEY in your environment.');
  }

  const totalKeys = keys.length;
  let attempts = 0;

  while (attempts < totalKeys) {
    // Calculate the index of the key to use for this attempt (starts at activeKeyIndex)
    const keyIndex = (activeKeyIndex + attempts) % totalKeys;
    const apiKey = keys[keyIndex];

    // Masked logging - only log the key index, never the actual key value
    console.log(`[Gemini Rotation] Attempting request using Key #${keyIndex + 1} of ${totalKeys}`);

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent(requestConfig);
      
      // If we succeed, save this key index as the active one for future requests
      activeKeyIndex = keyIndex;
      return response;
    } catch (err: any) {
      const errorMessage = err?.message || '';
      const errorStatus = err?.status || err?.statusCode || 0;

      console.warn(
        `[Gemini Rotation] Request failed using Key #${keyIndex + 1}: Status ${errorStatus} | Error: ${errorMessage}`
      );

      // Quota / rate limit errors identification
      const isQuotaOrRateLimit =
        errorStatus === 429 ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('Rate limit exceeded') ||
        errorMessage.includes('Daily quota exceeded') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('exhausted') ||
        errorMessage.includes('429');

      if (isQuotaOrRateLimit) {
        console.warn(`[Gemini Rotation] Key #${keyIndex + 1} is rate-limited or quota exhausted. Rotating keys...`);
        attempts++;
      } else {
        // For standard error types (e.g., prompt issues, server hiccups), still rotate/retry to maximize success,
        // but log them as general errors.
        console.warn(`[Gemini Rotation] Encountered general failure on Key #${keyIndex + 1}. Attempting failover to next key.`);
        attempts++;
      }
    }
  }

  // If we reach this point, all keys have failed
  throw new Error('All configured Gemini API keys have failed or exhausted their quota.');
}
