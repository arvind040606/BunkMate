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

  // Authenticate user via Authorization Header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const user = await verifyTokenAndUser(token);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized: User does not exist or session expired.' });
  }

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

  const { lastSynced = 0, changes = [] } = body;

  const serverSyncTime = Date.now();
  console.log(`[Sync Request] User: ${user.username} (UserId: ${user.userId}) | lastSynced: ${lastSynced} | changes count: ${changes.length}`);

  try {
    // Check if user has 0 subjects on server but client has > 0 subjects locally and thinks it is already synced
    if (dbInstance.isPersistent && lastSynced > 0 && (!changes || changes.length === 0)) {
      const localSubjectCount = body.localSubjectCount !== undefined ? Number(body.localSubjectCount) : 0;
      if (localSubjectCount > 0) {
        const serverSubjectCount = await dbInstance.query('SELECT COUNT(*) as count FROM subjects WHERE userId = ?', [user.userId]);
        const subjectCount = serverSubjectCount[0]?.count || 0;
        if (subjectCount === 0) {
          console.log(`[Sync Self-Heal] User ${user.username} has 0 subjects on server but client has ${localSubjectCount} subjects and lastSynced is ${lastSynced}. Requesting sync reset.`);
          return sendJson(res, 200, {
            success: true,
            syncTime: serverSyncTime,
            changes: [],
            resetSync: true
          });
        }
      }
    }

    // 1. Process outbound client changes (Uploads)
    let attendanceUploaded = 0;
    let attendanceSkipped = 0;

    if (Array.isArray(changes)) {
      // Sort changes so 'subjects' are processed FIRST before dependent tables (attendance, timetable, etc.)
      const tableOrder: Record<string, number> = {
        'subjects': 1,
        'timetable': 2,
        'attendance': 3,
        'exams': 4,
        'assignments': 5,
        'settings': 6
      };
      const sortedChanges = [...changes].sort((a, b) => {
        const orderA = tableOrder[a.table] || 99;
        const orderB = tableOrder[b.table] || 99;
        return orderA - orderB;
      });

      for (const change of sortedChanges) {
        const { table, recordId, payload, updatedAt, isDeleted } = change;
        if (
          ['subjects', 'attendance', 'assignments', 'exams', 'settings', 'timetable'].includes(table) &&
          recordId &&
          typeof updatedAt === 'number'
        ) {
          console.log(`  -> Processing table: ${table} | recordId: ${recordId} | isDeleted: ${!!isDeleted} | updatedAt: ${updatedAt} | serverSyncTime: ${serverSyncTime}`);
          if (isDeleted) {
            await dbInstance.deleteRecord(user.userId, table, recordId, updatedAt, serverSyncTime);
          } else if (payload) {
            const res = await dbInstance.upsertRecord(user.userId, table, recordId, payload, updatedAt, serverSyncTime);
            if (table === 'attendance') {
              if (res && (res as any).skipped) {
                attendanceSkipped++;
              } else {
                attendanceUploaded++;
              }
            }
          }
        } else {
          console.warn(`  -> Ignored invalid client change:`, change);
        }
      }
      console.log(`[Sync Upload Summary] User: ${user.username} | Total changes: ${changes.length} | Attendance uploaded: ${attendanceUploaded} | Attendance skipped: ${attendanceSkipped}`);
    }

    // 2. Fetch server-side changes since lastSynced (Downloads)
    const serverChanges = await dbInstance.getChanges(user.userId, lastSynced);

    console.log(`[Sync Success] User: ${user.username} | returning ${serverChanges.length} server changes | syncTime: ${serverSyncTime}`);

    if (changes && changes.length > 0 && typeof (globalThis as any).broadcastUserUpdate === 'function') {
      (globalThis as any).broadcastUserUpdate(user.userId, user.username);
    }

    return sendJson(res, 200, {
      success: true,
      syncTime: serverSyncTime,
      changes: serverChanges,
      attendanceUploaded,
      attendanceSkipped,
      databaseMode: dbInstance.usingSupabase ? 'supabase' : 'ephemeral'
    });
  } catch (error: any) {
    console.error('[Sync Error] Sync execution failure:', error);
    return sendJson(res, 500, { error: 'Sync failed due to internal storage coordinator error.' });
  }
}
