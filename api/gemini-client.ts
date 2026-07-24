import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Initialize dotenv to load environment variables
dotenv.config();

/**
 * Dynamic retriever that scans environment variables for any configured Gemini API keys.
 * Captures `GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, `GEMINI_API_KEYS`, as well as any
 * numbered variables such as `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, etc.
 * Cleans surrounding quotes and splits comma-separated key lists if present.
 * 
 * @returns {string[]} List of unique Gemini API keys found.
 */
export function getGeminiApiKeys(): string[] {
  // Re-run dotenv to ensure latest env values are present
  try {
    dotenv.config();
  } catch (e) {
    // Ignore errors if dotenv cannot read file
  }

  const keys: string[] = [];

  const addKey = (raw: string | undefined) => {
    if (!raw || typeof raw !== 'string') return;
    // Handle comma, semicolon, or newline separated keys in a single variable
    const parts = raw.split(/[\n,;]/);
    for (const part of parts) {
      const cleaned = part.trim().replace(/^["']|["']$/g, '').trim();
      if (cleaned.length > 5 && !keys.includes(cleaned)) {
        keys.push(cleaned);
      }
    }
  };

  // 1. Direct standard keys
  addKey(process.env.GEMINI_API_KEY);
  addKey(process.env.VITE_GEMINI_API_KEY);
  addKey(process.env.GEMINI_API_KEYS);
  addKey(process.env.VITE_GEMINI_API_KEYS);
  addKey(process.env.GEMINI_KEY);
  addKey(process.env.GEMINI_KEYS);

  // 2. Scan all environment variables for numbered key variants (e.g. GEMINI_API_KEY_1, VITE_GEMINI_API_KEY_2)
  for (const envKey of Object.keys(process.env)) {
    if (
      envKey.startsWith('GEMINI_API_KEY_') ||
      envKey.startsWith('VITE_GEMINI_API_KEY_') ||
      envKey.startsWith('GEMINI_KEY_')
    ) {
      addKey(process.env[envKey]);
    }
  }

  return keys;
}

// Persistent index tracking the currently active API key across requests
let activeKeyIndex = 0;

/**
 * Executes a Gemini content generation request with automatic API key rotation & model failover.
 * If a key encounters rate limits, quota exhaustion, or temporary errors, it automatically
 * shifts to the next available key. If a model fails across all keys, it falls back to backup models.
 * 
 * @param requestConfig The parameters passed to GoogleGenAI models.generateContent.
 * @returns {Promise<any>} The response object from Gemini.
 */
export async function generateContentWithRotation(requestConfig: any): Promise<any> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('Gemini API key is missing. Please configure GEMINI_API_KEY in your environment.');
  }

  const requestedModel = requestConfig.model || 'gemini-2.5-flash';
  // Candidate models sequence for failover fallback
  const candidateModels = Array.from(
    new Set([requestedModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'])
  );

  const totalKeys = keys.length;
  let lastError: any = null;

  for (const modelName of candidateModels) {
    let attempts = 0;
    const currentConfig = { ...requestConfig, model: modelName };

    while (attempts < totalKeys) {
      const keyIndex = (activeKeyIndex + attempts) % totalKeys;
      const apiKey = keys[keyIndex];

      console.log(
        `[Gemini Rotation] Attempting request using Model '${modelName}' | Key #${keyIndex + 1} of ${totalKeys}`
      );

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const response = await ai.models.generateContent(currentConfig);

        if (response && response.text) {
          // Record successful key index for subsequent calls
          activeKeyIndex = keyIndex;
          return response;
        }

        throw new Error('Empty response returned from Gemini API.');
      } catch (err: any) {
        lastError = err;
        const errorMessage = err?.message || String(err);
        const errorStatus = err?.status || err?.statusCode || 0;

        console.warn(
          `[Gemini Rotation] Request failed using Model '${modelName}' | Key #${keyIndex + 1}: Status ${errorStatus} | Error: ${errorMessage}`
        );

        attempts++;
      }
    }

    console.warn(`[Gemini Rotation] Model '${modelName}' failed across all ${totalKeys} keys. Trying candidate fallback model...`);
  }

  // If we reach this point, all keys and model candidate fallbacks have failed
  throw new Error(
    `All configured Gemini API keys and model fallbacks failed. Last error: ${lastError?.message || 'Quota or connection failure'}`
  );
}
