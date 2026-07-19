import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import { Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateContentWithRotation, getGeminiApiKeys } from './api/gemini-client.js';
import { createHash } from 'crypto';
import authHandler, { verifyToken, verifyTokenAndUser } from './api/auth.js';
import syncHandler from './api/sync.js';
import syncPurgeHandler from './api/sync-purge.js';
import friendsHandler from './api/friends.js';

// In-memory cache for structured timetable parsing to save operational API costs
const parseCache = new Map<string, any>();

function getRequestHash(text?: string, imageBase64?: string): string {
  const hash = createHash('sha256');
  if (text) hash.update(text);
  if (imageBase64) hash.update(imageBase64);
  return hash.digest('hex');
}

const app = express();
const PORT = 3000;

// Increase payload limit to support base64 image uploads for timetable photos
app.use(express.json({ limit: '12mb' }));

// Allow local frontend dev servers to call API endpoints with preflight
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  next();
});
app.options('/api/*', (_req, res) => {
  res.sendStatus(204);
});

// Verify Gemini API keys availability on startup
const keys = getGeminiApiKeys();
if (keys.length === 0) {
  console.warn('WARNING: No GEMINI_API_KEYS are defined in the environment. AI Timetable parsing will be unavailable.');
} else {
  console.log(`Successfully loaded ${keys.length} Gemini API key(s) for local development.`);
}

// In-Memory IP-based Rate Limiter (sliding window)
interface RateLimitRecord {
  timestamps: number[];
}
const rateLimits = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 100; // Max 100 requests per 10 minutes per IP

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown-ip').split(',')[0].trim();
  const now = Date.now();
  
  let record = rateLimits.get(ip);
  if (!record) {
    record = { timestamps: [] };
    rateLimits.set(ip, record);
  }
  
  // Filter out expired timestamps
  record.timestamps = record.timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  
  if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const earliestAllowed = record.timestamps[0] + RATE_LIMIT_WINDOW_MS;
    const retryAfterSeconds = Math.ceil((earliestAllowed - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({ 
      error: `Too many requests. Please wait another ${Math.ceil((earliestAllowed - now) / 60000)} minutes before trying again.` 
    });
    return;
  }
  
  record.timestamps.push(now);
  next();
}

// Request Validation Middleware
function validateParseRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const { text, imageBase64, imageMimeType, collegeStartTime, collegeEndTime } = req.body;

  if (!text && !imageBase64) {
    res.status(400).json({ error: 'Please provide either copy-pasted timetable text or a timetable image.' });
    return;
  }

  // Validate text input if provided
  if (text !== undefined) {
    if (typeof text !== 'string') {
      res.status(400).json({ error: 'Timetable text must be a string.' });
      return;
    }
    if (text.length > 50000) {
      res.status(400).json({ error: 'Timetable text content is too large (max 50,000 characters).' });
      return;
    }
  }

  // Validate image input if provided
  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Image data must be a base64 encoded string.' });
      return;
    }
    if (imageBase64.length > 20000000) {
      res.status(400).json({ error: 'Image size is too large (max 20MB).' });
      return;
    }
  }

  // Validate MIME type if provided
  if (imageMimeType !== undefined) {
    if (typeof imageMimeType !== 'string' || !imageMimeType.startsWith('image/')) {
      res.status(400).json({ error: 'Invalid image mime type. Must be an image format.' });
      return;
    }
  }

  // Validate timings if provided
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (collegeStartTime !== undefined && collegeStartTime !== '') {
    if (typeof collegeStartTime !== 'string' || !timeRegex.test(collegeStartTime)) {
      res.status(400).json({ error: 'College start time must be in HH:MM format.' });
      return;
    }
  }
  if (collegeEndTime !== undefined && collegeEndTime !== '') {
    if (typeof collegeEndTime !== 'string' || !timeRegex.test(collegeEndTime)) {
      res.status(400).json({ error: 'College end time must be in HH:MM format.' });
      return;
    }
  }

  next();
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Parser API Endpoint protected with rate limiting and request validation
app.post('/api/parse-timetable', rateLimiter, validateParseRequest, async (req, res) => {
  try {
    const { text, imageBase64, imageMimeType, collegeStartTime, collegeEndTime, userProfile } = req.body;

    const startStr = collegeStartTime || '09:00';
    const endStr = collegeEndTime || '17:00';

    // Check request cache - include userProfile JSON to prevent cross-contamination of cache between batches
    const cacheKey = getRequestHash(text, imageBase64) + `:${startStr}:${endStr}:${JSON.stringify(userProfile || {})}`;
    if (parseCache.has(cacheKey)) {
      console.log('Bunkmate Cache: Returning cached structured timetable response.');
      res.json(parseCache.get(cacheKey));
      return;
    }

    const systemInstruction = `You are an expert academic schedule parsing assistant. Your task is to analyze the provided college timetable data (either copy-pasted text, OR an image containing a weekly schedule/timetable) and extract a highly accurate structured list of subjects, course names, days, and times.

The general college timings provided by the user are ${startStr} to ${endStr}.

CRITICAL PARSING AND SCHEDULING RULES FOR MAXIMUM ACCURACY:

1. UNDERSTAND THE GRID STRUCTURE:
   - Identify the Day headers (usually rows or columns, e.g. Monday, Tuesday...) and the Period/Timing headers (e.g. 09:00 - 09:50, 09:50 - 10:40).
   - Trace each grid cell carefully. For any given class, verify the exact day (row) and period timing (column) it belongs to. Do NOT shift classes into neighboring slots or wrong days.
   - If the timetable image contains vertical or horizontal gridlines, use them to align text elements with their respective day and time header.

2. MAP CODES TO OFFICIAL NAMES USING LEGEND:
   - Carefully examine the bottom, sides, or top of the timetable for a code/acronym mapping table (legend).
   - ALWAYS map short acronyms, abbreviation tokens, or subject codes (e.g., "DS", "OS", "RDBMS", "WD", "AGCS-21401", "AGCS-21407") to their full official names in the legend (e.g. "Discrete Structures", "Operating Systems", "Relational Database Management Systems", "Web Development", "Programming in Python Lab").
   - Set the extracted official name as the subject's 'name', and use the code (e.g. 'AGCS-21401') as the 'code'.

3. MERGED LAB & LECTURE TIME PERIODS:
   - Identify vertically or horizontally merged blocks (e.g., labs running across multiple periods like Lecture 2 & Lecture 3).
   - For these blocks, combine the duration of all covered periods (e.g., if period 2 is 09:50 AM - 10:40 AM and period 3 is 10:40 AM - 11:30 AM, the lab has a duration of 100 minutes starting at 09:50 AM).

4. SPLIT GROUP SLOTS (G1/G2/A/B):
   - Timetables often split a single slot into multiple columns/rows for different student groups (e.g. "Python G1" on the left and "RDBMS G2" on the right in the same cell).
   - If a student profile is provided with a specific group/batch, output ONLY the classes matching that group/batch. Otherwise, extract both classes.

5. WEEKDAY MAPPING:
   - Map weekdays and weekend days correctly:
     - Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6.

6. ACCURATE TIMINGS IN 24-HOUR FORMAT:
   - Extract the exact start time and duration (in minutes) for each lecture based on the period times listed (e.g. 09:00 AM - 09:50 AM is a 50-minute class starting at 09:00).
   - Convert all start times strictly to 24-hour "HH:MM" format (e.g., "09:00", "09:50", "14:30", "16:15"). Do NOT append AM/PM to the output string.

7. SUBJECT DETAILS & STYLING:
   - Extract room numbers/classroom codes (e.g. "MB301", "PL-1 Lab") and teacher/professor names (e.g. "AS-RT", "CS-GoK").
   - Assign distinct nice modern accent colors chosen from: '#6366f1' (Indigo), '#10b981' (Emerald), '#ef4444' (Rose), '#f59e0b' (Amber), '#3b82f6' (Blue), '#8b5cf6' (Violet), '#ec4899' (Pink), '#06b6d4' (Cyan).
   - Default 'targetPercentage' to 75.`;

    let profileContext = '';
    if (userProfile) {
      profileContext = `
STUDENT PROFILE DETAILS (Use this to filter split slots/batches/groups/courses):
- Course Name: ${userProfile.course || 'Not specified'}
- Major/Branch: ${userProfile.major || 'Not specified'}
- Semester: ${userProfile.semester || 'Not specified'}
- Section: ${userProfile.section || 'Not specified'}
- Group / Batch: ${userProfile.group || 'Not specified'}
- College Name: ${userProfile.collegeName || 'Not specified'}

CRITICAL ACTIONABLE GROUP AND BATCH FILTERING RULES:
The timetable data might contain split classes for multiple student groups (e.g., "Batch A", "Batch B", "G1", "G2", "Section A", "Section B").
You MUST strictly filter the returned schedule list to match the student's profile above:
1. If a slot contains different lectures or labs for different groups/batches, and the student's group is "${userProfile.group || ''}", include ONLY the class corresponding to that group. Exclude classes designated for other groups.
2. If a slot is split by section, and the student's section is "${userProfile.section || ''}", include ONLY the classes for this section.
3. If no specific group or section filter matches, or if it applies to all students, extract it normally.
`;
    }

    const promptText = `Parse the provided academic timetable and return a structured list of subjects and classes.
General College Hours: ${startStr} to ${endStr}.
${profileContext}
${text ? `Copy-pasted Text Content:\n"""\n${text}\n"""` : 'Timetable is provided in the attached image.'}`;

    let response;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        subjects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'The official course title or class name (e.g., Computer Networks).' },
              code: { type: Type.STRING, description: 'Unique subject code (e.g. CS-301) or a custom clean acronym of 3-4 letters.' },
              room: { type: Type.STRING, description: 'Classroom number or lecture hall name (e.g. Room 405) if shown.' },
              teacher: { type: Type.STRING, description: 'Teacher or professor name if shown.' },
              color: { type: Type.STRING, description: 'Hex color chosen from the provided list.' },
              targetPercentage: { type: Type.INTEGER, description: 'Target attendance percentage, always default to 75.' },
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayOfWeek: { type: Type.INTEGER, description: '0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday.' },
                    time: { type: Type.STRING, description: 'Class start time strictly in 24-hour "HH:MM" format (e.g., "09:50", "14:30"). Do NOT include AM/PM.' },
                    duration: { type: Type.INTEGER, description: 'Duration of the class in minutes (e.g., 50 or 60).' }
                  },
                  required: ['dayOfWeek', 'time']
                },
                description: 'The list of scheduled lectures/classes for this course.'
              }
            },
            required: ['name', 'code', 'color', 'targetPercentage', 'schedule']
          }
        }
      },
      required: ['subjects']
    };

    const requestConfig = {
      model: 'gemini-2.5-flash',
      contents: imageBase64 ? {
        parts: [
          {
            inlineData: {
              mimeType: imageMimeType || 'image/png',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            }
          },
          {
            text: promptText
          }
        ]
      } : promptText,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema
      }
    };

    response = await generateContentWithRotation(requestConfig);
    const textResult = response.text;
    if (!textResult) {
      throw new Error('No parsing results returned from the AI model.');
    }

    const parsedData = JSON.parse(textResult.trim());
    parseCache.set(cacheKey, parsedData);
    res.json(parsedData);
  } catch (error: any) {
    console.error('AI Timetable Parser Error:', error);
    
    if (
      error?.message &&
      (error.message.includes('All configured Gemini API keys have failed') ||
        error.message.includes('Gemini API key is missing'))
    ) {
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please wait a few minutes and try again.',
        error: 'AI service is temporarily unavailable. Please wait a few minutes and try again.'
      });
    }

    res.status(500).json({ error: error.message || 'Failed to parse your timetable using AI.' });
  }
});

app.post('/api/auth', async (req, res) => {
  await authHandler(req, res);
});

interface SSEClient {
  id: string;
  userId: string;
  res: any;
}
let sseClients: SSEClient[] = [];

(globalThis as any).isUserOnline = (userId: string): boolean => {
  return sseClients.some(c => c.userId === userId);
};

app.get('/api/sync-events', async (req, res) => {
  const token = req.query.token as string;
  const user = await verifyTokenAndUser(token || '');
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end('Unauthorized');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = `${user.userId}-${Date.now()}`;
  const newClient: SSEClient = { id: clientId, userId: user.userId, res };
  sseClients.push(newClient);

  console.log(`[SSE Connected] User: ${user.username} (ClientId: ${clientId}) | Active: ${sseClients.length}`);

  // Send connected event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Keep-alive heartbeat every 15s to prevent timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // client disconnected
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c.id !== clientId);
    console.log(`[SSE Disconnected] User: ${user.username} (ClientId: ${clientId}) | Active: ${sseClients.length}`);
  });
});

(globalThis as any).broadcastUserUpdate = (userId: string, username?: string) => {
  const payload = JSON.stringify({ type: 'sync_update', userId, username });
  console.log(`[SSE Broadcast] Notifying all clients of update from userId: ${userId} (${username || 'unknown'})`);
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.warn(`[SSE Broadcast] Failed to write to client ${client.id}:`, err);
    }
  });
};

app.post('/api/sync', async (req, res) => {
  await syncHandler(req, res);
});

app.post('/api/sync-purge', async (req, res) => {
  await syncPurgeHandler(req, res);
});

app.post('/api/friends', async (req, res) => {
  await friendsHandler(req, res);
});

// Start Express Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BunkMate Server running on:`);
    console.log(`  > Local:    http://localhost:${PORT}`);
    console.log(`  > Loopback: http://127.0.0.1:${PORT}`);
  });
}

startServer();
