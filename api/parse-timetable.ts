import dotenv from 'dotenv';
import { Type } from '@google/genai';
import { generateContentWithRotation } from './gemini-client.js';
import { createHash } from 'crypto';

// In-memory cache for structured timetable parsing to save operational API costs
const parseCache = new Map<string, any>();

function getRequestHash(text?: string, imageBase64?: string): string {
  const hash = createHash('sha256');
  if (text) hash.update(text);
  if (imageBase64) hash.update(imageBase64);
  return hash.digest('hex');
}

type ParsedRequestBody = {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  collegeStartTime?: string;
  collegeEndTime?: string;
  userProfile?: {
    displayName?: string;
    course?: string;
    major?: string;
    semester?: string;
    section?: string;
    group?: string;
    collegeName?: string;
  };
};

type JsonResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

const sendJson = (res: any, statusCode: number, payload: Record<string, unknown>) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
};

const sendNoContent = (res: any) => {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end();
};

const getRequestBody = async (req: any): Promise<ParsedRequestBody> => {
  if (req.body && typeof req.body !== 'string') {
    return req.body;
  }

  const raw = req.body && typeof req.body === 'string'
    ? req.body
    : await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer | string) => { data += chunk.toString(); });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON body. Please send valid JSON formatted request data.');
  }
};


const validateParseRequest = (body: ParsedRequestBody) => {
  const { text, imageBase64, imageMimeType, collegeStartTime, collegeEndTime } = body;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!text && !imageBase64) {
    return 'Please provide either copy-pasted timetable text or a timetable image.';
  }

  if (text !== undefined) {
    if (typeof text !== 'string') {
      return 'Timetable text must be a string.';
    }
    if (text.length > 50000) {
      return 'Timetable text content is too large (max 50,000 characters).';
    }
  }

  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== 'string') {
      return 'Image data must be a base64 encoded string.';
    }
    if (imageBase64.length > 20000000) {
      return 'Image size is too large (max 20MB).';
    }
  }

  if (imageMimeType !== undefined) {
    if (typeof imageMimeType !== 'string' || !imageMimeType.startsWith('image/')) {
      return 'Invalid image mime type. Must be an image format.';
    }
  }

  if (collegeStartTime !== undefined && collegeStartTime !== '') {
    if (typeof collegeStartTime !== 'string' || !timeRegex.test(collegeStartTime)) {
      return 'College start time must be in HH:MM format.';
    }
  }

  if (collegeEndTime !== undefined && collegeEndTime !== '') {
    if (typeof collegeEndTime !== 'string' || !timeRegex.test(collegeEndTime)) {
      return 'College end time must be in HH:MM format.';
    }
  }

  return null;
};

const createPrompt = (text: string | undefined, startStr: string, endStr: string, userProfile?: any) => {
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
1. If a slot contains different lectures or labs for different groups/batches, and the student's Target Group is "${userProfile.group || ''}", include ONLY the class corresponding to that group.
2. FUZZY ALIAS MATCHING: Treat abbreviations equivalently! If Target Group is "G1", you MUST extract "Group 1", "Batch 1", "B1", "G-1", etc. If it is "Batch B", extract "G-B", "B2", "Group B", etc. Understand the INTENT of the target group.
3. If a slot is split by section, and the student's section is "${userProfile.section || ''}", include ONLY the classes for this section.
4. If no specific group or section filter matches, extract the slot normally.
`;
  }

  const content = text
    ? `Copy-pasted Text Content:\n"""\n${text}\n"""`
    : 'Timetable is provided in the attached image.';

  return `Parse the provided academic timetable and return a structured list of subjects and classes.
General College Hours: ${startStr} to ${endStr}.

MULTI-STAGE PARSING DIRECTIVE:
Stage 1: Image enhancement (Internal) - Deskew, contrast correction, and perspective visualization.
Stage 2: OCR - Extract every table cell. Preserve merged cells accurately.
Stage 3: AI Understanding - Understand Days, Time slots, Subjects, Teachers, Rooms, Groups, Labs, Tutorials, Sections, and Merged lectures.

${profileContext}
${content}`;
};

const createResponseSchema = () => ({
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
                time: { type: Type.STRING, description: 'Class start time in "HH:MM AM/PM" or "HH:MM" 24-hr format.' },
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
});

const createSystemInstruction = (startStr: string, endStr: string) => `You are an advanced Academic Timetable Intelligence Engine. Your task is to analyze college timetables and achieve 98%+ accuracy on extraction by understanding the timetable like a human.

General College Hours: ${startStr} to ${endStr}.

CRITICAL PARSING AND SCHEDULING RULES:

1. CONSECUTIVE THEORY LECTURES (DO NOT MERGE):
   - VERY IMPORTANT: If the SAME theory/tutorial subject appears twice in one day in consecutive periods (e.g., "Operating Systems" from 09:00-10:00 and "Operating Systems" from 10:00-11:00), DO NOT merge them!
   - These are TWO DIFFERENT lectures. You MUST create two separate schedule entries in the array (each with their respective start times and durations). Each lecture contributes individually to attendance.

2. DOUBLE LABS (MERGE):
   - Labs remain independent and must NEVER be merged with theory. "Python Lab" is a separate subject from "Python Theory".
   - IF a Lab occupies consecutive periods (e.g., "Python Lab" from 09:00-10:00 and 10:00-11:00), STORE IT AS ONE LAB SESSION.
   - For consecutive labs, merge the duration (e.g., one schedule entry at 09:00 with a duration of 120 minutes).

3. SMART NORMALIZATION (THEORY + TUTORIAL):
   - Treat Theory, Tutorial, and Lecture as ONE SUBJECT.
   - Normalize names: "Programming in Python", "Programming in Python Tutorial", "Programming in Python Theory" -> "Programming in Python".
   - Do NOT merge Labs into this. Keep Labs completely independent.

4. BREAK DETECTION & IGNORING:
   - Automatically ignore all entries related to Lunch, Break, Recess, Tea Break, Library, or empty periods.

5. GROUP & SECTION DETECTION:
   - Detect groups (G1, G2, Batch A, etc.) and sections (CSE1, ECE, MBA).
   - If user profile provides a specific group or section, filter out all other groups/sections for that time slot. If no group is selected, extract them and append the group name to the subject name (e.g., "Python (G1)").

6. VALIDATION & TIMING:
   - Extract exact start times and calculate durations accurately based on time period columns.
   - Ensure you capture AM/PM correctly.
   - Detect and repair overlapping classes or impossible timings (e.g. if period 3 says 11:60, repair to 12:00).
   - Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6. Never shift classes to incorrect days.

7. MAPPING CODES:
   - Use the legend at the bottom of the timetable to map acronyms to official full names.

8. SUBJECT DETAILS & STYLING:
   - Extract Teacher and Room. 
   - Assign distinct nice modern accent colors chosen from: '#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'.
   - Default targetPercentage to 75.`;

const rateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

const rateLimiter = (req: any) => {
  const rawIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
  const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown-ip';
  const now = Date.now();

  const timestamps = rateLimits.get(ip) || [];
  const fresh = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

  if (fresh.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimits.set(ip, fresh);
    const earliestAllowed = fresh[0] + RATE_LIMIT_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((earliestAllowed - now) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Too many requests. Please wait another ${Math.ceil((earliestAllowed - now) / 60000)} minutes before trying again.`
    };
  }

  fresh.push(now);
  rateLimits.set(ip, fresh);
  return { allowed: true };
};

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return sendNoContent(res);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed. Use POST to submit timetable data.' });
  }

  try {
    const rateLimitResult = rateLimiter(req);
    if (!rateLimitResult.allowed) {
      res.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds));
      return sendJson(res, 429, { error: rateLimitResult.message });
    }

    const body = await getRequestBody(req);
    const validationError = validateParseRequest(body);
    if (validationError) {
      return sendJson(res, 400, { error: validationError });
    }

    const { text, imageBase64, imageMimeType, collegeStartTime, collegeEndTime, userProfile } = body;
    const startStr = collegeStartTime || '09:00';
    const endStr = collegeEndTime || '17:00';

    // Check request cache - include userProfile JSON to prevent cross-contamination of cache between batches
    const cacheKey = getRequestHash(text, imageBase64) + `:${startStr}:${endStr}:${JSON.stringify(userProfile || {})}`;
    if (parseCache.has(cacheKey)) {
      console.log('Bunkmate Cache: Returning cached structured timetable response.');
      return sendJson(res, 200, parseCache.get(cacheKey));
    }

    const promptText = createPrompt(text, startStr, endStr, userProfile);
    const systemInstruction = createSystemInstruction(startStr, endStr);

    const requestConfig = {
      model: 'gemini-2.5-flash',
      contents: imageBase64 ? {
        parts: [
          {
            inlineData: {
              mimeType: imageMimeType || 'image/png',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            text: promptText,
          },
        ],
      } : promptText,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: createResponseSchema(),
      },
    };

    const response = await generateContentWithRotation(requestConfig);
    const textResult = response?.text;

    if (!textResult || typeof textResult !== 'string') {
      throw new Error('Gemini returned an unexpected response format.');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(textResult.trim());
    } catch (error) {
      throw new Error('Gemini returned invalid JSON. Please try again with clearer timetable data.');
    }

    // Save to cache
    parseCache.set(cacheKey, parsedData);

    return sendJson(res, 200, parsedData);
  } catch (error: any) {
    console.error('API parse-timetable error:', error?.message || error);
    
    // Check if error is due to all keys failing or keys missing
    if (
      error?.message &&
      (error.message.includes('All configured Gemini API keys have failed') ||
        error.message.includes('Gemini API key is missing'))
    ) {
      return sendJson(res, 503, {
        success: false,
        message: 'AI service is temporarily unavailable. Please wait a few minutes and try again.',
        error: 'AI service is temporarily unavailable. Please wait a few minutes and try again.'
      });
    }

    return sendJson(res, 500, {
      error: error?.message || 'Failed to parse timetable due to an internal server error.',
    });
  }
}
