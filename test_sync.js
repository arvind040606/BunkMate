import syncHandler from './api/sync.js';
import authHandler from './api/auth.js';
import { dbInstance } from './api/database.js';

// Setup mock request and response
function createMockReqRes(method, headers, body) {
  let resPayload = null;
  let resStatus = 200;

  const req = {
    method,
    headers,
    body,
    on: (event, callback) => {
      // Mock stream events for JSON body if not pre-parsed
    }
  };

  const res = {
    statusCode: 200,
    setHeader: (name, value) => {},
    end: (data) => {
      resPayload = data ? JSON.parse(data) : null;
    }
  };

  return { req, res, getResult: () => ({ status: res.statusCode, payload: resPayload }) };
}

async function run() {
  console.log('--- Testing Sync Endpoint directly ---');
  try {
    const testUsername = `sync_test_${Date.now()}`;
    const testPassword = 'password123';

    // 1. Register a test user
    console.log(`Registering user ${testUsername}...`);
    const { req: regReq, res: regRes, getResult: getRegResult } = createMockReqRes('POST', {}, {
      action: 'register',
      username: testUsername,
      password: testPassword,
      securityQuestion: 'Favorite color?',
      securityAnswer: 'blue'
    });
    await authHandler(regReq, regRes);
    const regResult = getRegResult();
    console.log('Registration Result:', regResult);
    if (regResult.status !== 200 || !regResult.payload.success) {
      throw new Error('Registration failed');
    }

    const { token, userId } = regResult.payload;

    // 2. Perform Sync with subject and attendance
    console.log('Syncing a new subject and attendance record...');
    const syncBody = {
      lastSynced: 0,
      localSubjectCount: 1,
      changes: [
        {
          table: 'subjects',
          recordId: 'test-subj-1',
          updatedAt: Date.now(),
          payload: {
            name: 'Advanced Systems Programming',
            code: 'CS-401',
            color: '#3b82f6',
            targetPercentage: 75,
            schedule: [
              { id: 'sch-1', dayOfWeek: 1, time: '10:00', duration: 90 }
            ]
          }
        },
        {
          table: 'attendance',
          recordId: 'test-att-1',
          updatedAt: Date.now(),
          payload: {
            subjectId: 'test-subj-1',
            date: '2026-07-20',
            status: 'attended',
            timestamp: Date.now()
          }
        }
      ]
    };

    const { req: syncReq, res: syncRes, getResult: getSyncResult } = createMockReqRes(
      'POST',
      { authorization: `Bearer ${token}` },
      syncBody
    );

    await syncHandler(syncReq, syncRes);
    const syncResult = getSyncResult();
    console.log('Sync Result:', syncResult);
    if (syncResult.status !== 200 || !syncResult.payload.success) {
      throw new Error('Sync failed');
    }

    // 3. Verify records exist on Supabase
    console.log('Verifying records exist on Supabase...');
    const { data: subData } = await dbInstance.supabase.from('subjects').select('*').eq('userId', userId);
    console.log('Subjects on Supabase:', subData);

    const { data: attData } = await dbInstance.supabase.from('attendance').select('*').eq('userId', userId);
    console.log('Attendance on Supabase:', attData);

    const { data: ttData } = await dbInstance.supabase.from('timetable').select('*').eq('userId', userId);
    console.log('Timetable on Supabase:', ttData);

    // 4. Clean up test records
    console.log('Cleaning up...');
    await dbInstance.supabase.from('attendance').delete().eq('userId', userId);
    await dbInstance.supabase.from('timetable').delete().eq('userId', userId);
    await dbInstance.supabase.from('subjects').delete().eq('userId', userId);
    await dbInstance.supabase.from('users').delete().eq('id', userId);
    console.log('Cleanup done!');

  } catch (err) {
    console.error('Test failed:', err);
  }
}

run();
