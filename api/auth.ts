import { randomBytes, pbkdf2Sync, createHmac, randomUUID } from 'crypto';
import { dbInstance } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bunkmate_super_secret_dev_key';

// HMAC-based stateless token generator (no JWT dependency)
export function generateToken(userId: string, username: string): string {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = `${userId}:${username}:${expiry}`;
  const signature = createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [userId, username, expiryStr, signature] = parts;
    if (Date.now() > Number(expiryStr)) return null;

    const payload = `${userId}:${username}:${expiryStr}`;
    const expectedSignature = createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    if (signature !== expectedSignature) return null;

    return { userId, username };
  } catch {
    return null;
  }
}

export async function verifyTokenAndUser(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const user = verifyToken(token);
    if (!user) return null;
    let dbUser = await dbInstance.getUserById(user.userId);
    if (!dbUser) {
      // If we are using local SQLite fallback in Vercel serverless environment, the user might
      // have registered on a different instance. Since the token signature is valid and secure,
      // we can trust it and auto-register the user on this instance's local database.
      if (!dbInstance.usingSupabase && !process.env.TURSO_DATABASE_URL) {
        console.warn(`[Auth] User ${user.username} not found in this instance database. Provisioning local record.`);
        await dbInstance.query(
          'INSERT OR IGNORE INTO users (id, username, passwordHash, salt, createdAt) VALUES (?, ?, ?, ?, ?)',
          [user.userId, user.username, 'external_session', 'external_session', Date.now()]
        );
        dbUser = await dbInstance.getUserById(user.userId);
      }
    }
    if (!dbUser) return null;
    return user;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

const sendJson = (res: any, statusCode: number, payload: any) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(payload));
};

// IP-based Rate Limiter for Authentication (prevent brute-force attempts)
const rateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 100;

const rateLimiter = (req: any): boolean => {
  const rawIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
  const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';
  const now = Date.now();
  
  const timestamps = rateLimits.get(ip) || [];
  const activeTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  activeTimestamps.push(now);
  rateLimits.set(ip, activeTimestamps);
  return true;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.end();
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    // Rate Limiting Check
    if (!rateLimiter(req)) {
      return sendJson(res, 429, { error: 'Too many authentication attempts. Please try again after 10 minutes.' });
    }

    // Parse action from URL or body
    let body: any = {};
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      try {
        const raw = await new Promise<string>((resolve, reject) => {
          let data = '';
          req.on('data', (chunk: any) => data += chunk.toString());
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        body = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON request' });
      }
    }

    const { action, username, password } = body;

    if (action !== 'change-password' && action !== 'get-security-question' && action !== 'recover-password') {
      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return sendJson(res, 400, { error: 'Username and password are required strings.' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
      }
    } else {
      if (!username || typeof username !== 'string') {
        return sendJson(res, 400, { error: 'Username is required.' });
      }
    }

    const cleanUsername = username.trim().toLowerCase();
    if (action === 'register' || action === 'login' || action === 'get-security-question' || action === 'recover-password') {
      if (cleanUsername.length < 3 || cleanUsername.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
        return sendJson(res, 400, { error: 'Username must be 3-20 alphanumeric characters, underscores, or hyphens.' });
      }
    }

    if (action === 'get-security-question') {
      const user = await dbInstance.getUserByUsername(cleanUsername);
      if (user && user.securityQuestion) {
        return sendJson(res, 200, { success: true, question: user.securityQuestion });
      } else {
        // Return a realistic fake question to prevent user enumeration attacks and data harvesting
        return sendJson(res, 200, { success: true, question: 'What is your high school name?' });
      }
    }

    if (action === 'recover-password') {
      const { securityAnswer, newPassword } = body;
      if (!securityAnswer || !newPassword || typeof securityAnswer !== 'string' || typeof newPassword !== 'string') {
        return sendJson(res, 400, { error: 'Security answer and new password are required.' });
      }
      if (newPassword.length < 6) {
        return sendJson(res, 400, { error: 'New password must be at least 6 characters.' });
      }

      const user = await dbInstance.getUserByUsername(cleanUsername);
      if (!user || !user.securityAnswerHash || !user.securityAnswerSalt) {
        // Uniform error response to mitigate brute-force and confirmation attacks
        return sendJson(res, 400, { error: 'Verification failed. Security answer is incorrect.' });
      }

      const verifiedHash = hashPassword(securityAnswer.trim().toLowerCase(), user.securityAnswerSalt);
      if (verifiedHash !== user.securityAnswerHash) {
        return sendJson(res, 400, { error: 'Verification failed. Security answer is incorrect.' });
      }

      // Answer matches! Perform password update
      const newSalt = randomBytes(16).toString('hex');
      const newPasswordHash = hashPassword(newPassword, newSalt);
      await dbInstance.run('UPDATE users SET passwordHash = ?, salt = ? WHERE id = ?', [newPasswordHash, newSalt, user.id]);
      console.log(`[Auth Recovery] Password reset successfully for user: ${user.username}`);
      return sendJson(res, 200, { success: true, message: 'Password reset successfully. You can now log in.' });
    }

    if (action === 'register') {
      const { securityQuestion, securityAnswer } = body;
      if (!securityQuestion || !securityAnswer || typeof securityQuestion !== 'string' || typeof securityAnswer !== 'string') {
        return sendJson(res, 400, { error: 'Security question and answer are required for account recovery.' });
      }
      if (securityQuestion.trim().length < 5 || securityAnswer.trim().length < 2) {
        return sendJson(res, 400, { error: 'Please choose a valid security question and a descriptive answer.' });
      }

      const exists = await dbInstance.getUserByUsername(cleanUsername);
      if (exists) {
        return sendJson(res, 400, { error: 'Username is already taken.' });
      }

      const salt = randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      
      const securityAnswerSalt = randomBytes(16).toString('hex');
      const securityAnswerHash = hashPassword(securityAnswer.trim().toLowerCase(), securityAnswerSalt);
      
      const userId = randomUUID();

      try {
        await dbInstance.addUser(
          userId, 
          cleanUsername, 
          passwordHash, 
          salt,
          securityQuestion.trim(),
          securityAnswerHash,
          securityAnswerSalt
        );
      } catch (err: any) {
        console.error('[Registration Error] DB insert failed:', err);
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
          return sendJson(res, 400, { error: 'Username is already taken.' });
        }
        return sendJson(res, 500, { error: 'Failed to create user account. Please try a different username.' });
      }

      const token = generateToken(userId, cleanUsername);
      return sendJson(res, 200, { 
        success: true, 
        token, 
        userId, 
        username: cleanUsername,
        databaseMode: dbInstance.usingSupabase ? 'supabase' : 'ephemeral'
      });
    } 
    
    if (action === 'login') {
      const user = await dbInstance.getUserByUsername(cleanUsername);
      if (!user) {
        return sendJson(res, 400, { error: 'Invalid username or password.' });
      }

      const checkHash = hashPassword(password, user.salt);
      if (checkHash !== user.passwordHash) {
        return sendJson(res, 400, { error: 'Invalid username or password.' });
      }

      const token = generateToken(user.id, user.username);
      return sendJson(res, 200, { 
        success: true, 
        token, 
        userId: user.id, 
        username: user.username,
        databaseMode: dbInstance.usingSupabase ? 'supabase' : 'ephemeral'
      });
    }

    if (action === 'delete') {
      const authHeader = req.headers.authorization || '';
      const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      const requestToken = body.token || headerToken;
      
      const verified = await verifyTokenAndUser(requestToken);
      if (!verified) {
        return sendJson(res, 401, { error: 'Unauthorized: Session expired or invalid.' });
      }

      const user = await dbInstance.getUserById(verified.userId);
      if (!user) {
        return sendJson(res, 404, { error: 'User not found.' });
      }

      const checkHash = hashPassword(password, user.salt);
      if (checkHash !== user.passwordHash) {
        return sendJson(res, 400, { error: 'Incorrect password. Account deletion aborted.' });
      }

      // Delete the user from the users table (cascades automatically delete settings, subjects, timetable, etc.)
      await dbInstance.run('DELETE FROM users WHERE id = ?', [user.id]);
      console.log(`[Auth Delete] User deleted: ${user.username} (UserId: ${user.id})`);

      return sendJson(res, 200, { success: true, message: 'Account deleted successfully.' });
    }

    if (action === 'change-password') {
      const authHeader = req.headers.authorization || '';
      const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      const requestToken = body.token || headerToken;
      
      const verified = await verifyTokenAndUser(requestToken);
      if (!verified) {
        return sendJson(res, 401, { error: 'Unauthorized: Session expired or invalid.' });
      }

      const { oldPassword, newPassword } = body;
      if (!oldPassword || !newPassword) {
        return sendJson(res, 400, { error: 'Both current password and new password are required.' });
      }
      if (newPassword.length < 6) {
        return sendJson(res, 400, { error: 'New password must be at least 6 characters.' });
      }

      const user = await dbInstance.getUserById(verified.userId);
      if (!user) {
        return sendJson(res, 404, { error: 'User not found.' });
      }

      const checkHash = hashPassword(oldPassword, user.salt);
      if (checkHash !== user.passwordHash) {
        return sendJson(res, 400, { error: 'Current password is incorrect.' });
      }

      const newSalt = randomBytes(16).toString('hex');
      const newPasswordHash = hashPassword(newPassword, newSalt);

      const { securityQuestion, securityAnswer } = body;
      if (securityQuestion && securityAnswer) {
        if (securityQuestion.trim().length < 5 || securityAnswer.trim().length < 2) {
          return sendJson(res, 400, { error: 'Please choose a valid security question and a descriptive answer.' });
        }
        const securityAnswerSalt = randomBytes(16).toString('hex');
        const securityAnswerHash = hashPassword(securityAnswer.trim().toLowerCase(), securityAnswerSalt);
        await dbInstance.run(
          'UPDATE users SET passwordHash = ?, salt = ?, securityQuestion = ?, securityAnswerHash = ?, securityAnswerSalt = ? WHERE id = ?',
          [newPasswordHash, newSalt, securityQuestion.trim(), securityAnswerHash, securityAnswerSalt, user.id]
        );
      } else {
        await dbInstance.run('UPDATE users SET passwordHash = ?, salt = ? WHERE id = ?', [newPasswordHash, newSalt, user.id]);
      }
      console.log(`[Auth ChangePassword] Password updated for user: ${user.username} (UserId: ${user.id})`);

      // Generate a new session token because password changed
      const token = generateToken(user.id, user.username);
      return sendJson(res, 200, { success: true, token, message: 'Password updated successfully.' });
    }

    return sendJson(res, 400, { error: 'Invalid auth action specified.' });
  } catch (error: any) {
    console.error('[Auth Error] Execution failure:', error);
    return sendJson(res, 500, { error: 'Internal server error in authentication service.' });
  }
}
