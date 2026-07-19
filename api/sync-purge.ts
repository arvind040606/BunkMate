import { verifyTokenAndUser } from './auth.js';
import { dbInstance } from './database.js';

const sendJson = (res: any, statusCode: number, payload: any) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(payload));
};

export default async function handler(req: any, res: any) {
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

  // Authenticate user via Authorization Header or body
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const user = await verifyTokenAndUser(token);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized: Session expired.' });
  }

  console.log(`[Sync Purge] Purging all cloud storage for user: ${user.username} (UserId: ${user.userId})`);

  try {
    // Delete all user data from all tables (keep user in users table)
    await dbInstance.run('DELETE FROM subjects WHERE userId = ?', [user.userId]);
    await dbInstance.run('DELETE FROM assignments WHERE userId = ?', [user.userId]);
    await dbInstance.run('DELETE FROM exams WHERE userId = ?', [user.userId]);
    await dbInstance.run('DELETE FROM settings WHERE userId = ?', [user.userId]);
    await dbInstance.run('DELETE FROM sync_deletions WHERE userId = ?', [user.userId]);

    // Broadcast user update to SSE clients
    if (typeof (globalThis as any).broadcastUserUpdate === 'function') {
      (globalThis as any).broadcastUserUpdate(user.userId, user.username);
    }

    return sendJson(res, 200, {
      success: true,
      message: 'All cloud storage purged successfully.'
    });
  } catch (error: any) {
    console.error('[Sync Purge Error] Execution failure:', error);
    return sendJson(res, 500, { error: 'Failed to purge cloud storage.' });
  }
}
