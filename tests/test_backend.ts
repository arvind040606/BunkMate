import assert from 'assert';
import path from 'path';
import fs from 'fs';
import authHandler from '../api/auth.js';
import syncHandler from '../api/sync.js';
import friendsHandler from '../api/friends.js';
import { dbInstance } from '../api/database.js';

// Setup Mock HTTP wrappers
class MockRequest {
  public method: string;
  public url: string;
  public headers: Record<string, string>;
  public body: any;

  constructor(method: string, url: string, headers: Record<string, string> = {}, body: any = null) {
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }
}

class MockResponse {
  public statusCode: number = 200;
  public headers: Record<string, string> = {};
  public bodyData: string = '';

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  end(data?: string) {
    if (data) this.bodyData = data;
  }

  json() {
    try {
      return JSON.parse(this.bodyData);
    } catch (e) {
      throw new Error(`Failed to parse body as JSON: "${this.bodyData}"`);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting BunkMate Backend Integration Tests...\n');

  // Reset database state for testing
  const pathsToClean = [
    path.join('/tmp', 'bunkmate_backend_db.json'),
    path.join('/tmp', 'bunkmate_backend.sqlite'),
    path.join(process.cwd(), 'bunkmate_backend.sqlite')
  ];
  for (const p of pathsToClean) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (e) {
        // Ignore locked file errors
      }
    }
  }
  // Force dbInstance to reload to clean state
  (dbInstance as any).cache = null;

  // -------------------------------------------------------------
  // Test 1: User Registration
  // -------------------------------------------------------------
  console.log('🧪 Test 1: Register User A ("alice")');
  const regReqAlice = new MockRequest('POST', '/api/auth', {}, {
    action: 'register',
    username: 'alice',
    password: 'password123'
  });
  const regResAlice = new MockResponse();
  await authHandler(regReqAlice, regResAlice);
  
  const regAliceJson = regResAlice.json();
  assert.strictEqual(regResAlice.statusCode, 200);
  assert.strictEqual(regAliceJson.success, true);
  assert.ok(regAliceJson.token);
  assert.strictEqual(regAliceJson.username, 'alice');
  const aliceToken = regAliceJson.token;
  const aliceUserId = regAliceJson.userId;
  console.log('   ✅ Alice registered successfully. Token generated.');

  // Register User B ("bob")
  console.log('🧪 Test 2: Register User B ("bob")');
  const regReqBob = new MockRequest('POST', '/api/auth', {}, {
    action: 'register',
    username: 'bob',
    password: 'securePassword'
  });
  const regResBob = new MockResponse();
  await authHandler(regReqBob, regResBob);
  
  const regBobJson = regResBob.json();
  assert.strictEqual(regResBob.statusCode, 200);
  assert.strictEqual(regBobJson.success, true);
  const bobToken = regBobJson.token;
  console.log('   ✅ Bob registered successfully.');

  // -------------------------------------------------------------
  // Test 2: Authentication & Duplicate user checks
  // -------------------------------------------------------------
  console.log('🧪 Test 3: Prevent duplicate registrations');
  const regDup = new MockRequest('POST', '/api/auth', {}, {
    action: 'register',
    username: 'alice',
    password: 'newpassword'
  });
  const regDupRes = new MockResponse();
  await authHandler(regDup, regDupRes);
  assert.strictEqual(regDupRes.statusCode, 400);
  assert.ok(regDupRes.json().error.includes('already taken'));
  console.log('   ✅ Correctly blocked duplicate username registration.');

  console.log('🧪 Test 4: User Login validation');
  const loginReq = new MockRequest('POST', '/api/auth', {}, {
    action: 'login',
    username: 'alice',
    password: 'password123'
  });
  const loginRes = new MockResponse();
  await authHandler(loginReq, loginRes);
  assert.strictEqual(loginRes.statusCode, 200);
  assert.ok(loginRes.json().token);
  console.log('   ✅ Alice logged in successfully with valid credentials.');

  // -------------------------------------------------------------
  // Test 3: Synchronization (Uploads & Delta Downloads)
  // -------------------------------------------------------------
  console.log('🧪 Test 5: Upload initial subjects via Delta Sync');
  const syncTime1 = Date.now();
  const syncReqUpload = new MockRequest('POST', '/api/sync', {
    authorization: `Bearer ${aliceToken}`
  }, {
    lastSynced: 0,
    changes: [
      {
        table: 'subjects',
        recordId: 'sub-math-101',
        payload: JSON.stringify({ name: 'Mathematics', color: '#4f46e5', initialPresent: 5, initialAbsent: 1 }),
        updatedAt: syncTime1
      }
    ]
  });
  const syncResUpload = new MockResponse();
  await syncHandler(syncReqUpload, syncResUpload);

  assert.strictEqual(syncResUpload.statusCode, 200);
  const syncUploadJson = syncResUpload.json();
  assert.strictEqual(syncUploadJson.success, true);
  assert.ok(syncUploadJson.syncTime);
  console.log('   ✅ Synced Alice\'s changes without errors.');

  console.log('🧪 Test 6: Verify Delta Sync cursor retrieves updates');
  const syncReqDownload = new MockRequest('POST', '/api/sync', {
    authorization: `Bearer ${aliceToken}`
  }, {
    lastSynced: syncTime1 - 1000 // Query since just before upload
  });
  const syncResDownload = new MockResponse();
  await syncHandler(syncReqDownload, syncResDownload);

  assert.strictEqual(syncResDownload.statusCode, 200);
  const syncDownloadJson = syncResDownload.json();
  assert.strictEqual(syncDownloadJson.changes.length, 1);
  assert.strictEqual(syncDownloadJson.changes[0].recordId, 'sub-math-101');
  assert.strictEqual(syncDownloadJson.changes[0].payload.name, 'Mathematics');
  console.log('   ✅ Successfully retrieved Alice\'s subject via delta download query.');

  // -------------------------------------------------------------
  // Test 4: Social / Friends system & Gated Stats
  // -------------------------------------------------------------
  console.log('🧪 Test 7: Send friend request from Alice to Bob');
  const fReq = new MockRequest('POST', '/api/friends', {
    authorization: `Bearer ${aliceToken}`
  }, {
    action: 'request',
    friendUsername: 'bob'
  });
  const fRes = new MockResponse();
  await friendsHandler(fReq, fRes);
  assert.strictEqual(fRes.statusCode, 200);
  assert.strictEqual(fRes.json().success, true);
  console.log('   ✅ Friend request sent.');

  console.log('🧪 Test 8: Accept request by Bob');
  const fAccept = new MockRequest('POST', '/api/friends', {
    authorization: `Bearer ${bobToken}`
  }, {
    action: 'respond',
    friendUsername: 'alice',
    accept: true
  });
  const fAcceptRes = new MockResponse();
  await friendsHandler(fAccept, fAcceptRes);
  assert.strictEqual(fAcceptRes.statusCode, 200);
  assert.strictEqual(fAcceptRes.json().success, true);
  console.log('   ✅ Friend request accepted.');

  console.log('🧪 Test 9: Get Alice\'s stats (Bob queries Alice)');
  // Bob queries Alice
  const statsReq = new MockRequest('POST', '/api/friends', {
    authorization: `Bearer ${bobToken}`
  }, {
    action: 'stats',
    friendUsername: 'alice'
  });
  const statsRes = new MockResponse();
  await friendsHandler(statsReq, statsRes);
  assert.strictEqual(statsRes.statusCode, 200);
  const statsJson = statsRes.json();
  assert.strictEqual(statsJson.success, true);
  assert.strictEqual(statsJson.username, 'alice');
  // Overall percentage default when no attendance log exists but initial present is 5 and absent is 1
  // 5 / 6 = 83.33% => 83%
  assert.strictEqual(statsJson.overallPercentage, 83);
  assert.strictEqual(statsJson.subjects[0].name, 'Mathematics');
  assert.strictEqual(statsJson.subjects[0].attendancePercentage, 83);
  console.log(`   ✅ Bob received Alice's attendance summary correctly (${statsJson.overallPercentage}%).`);

  console.log('🧪 Test 10: Block stats viewing for non-friends');
  // Register an unrelated user Charlie
  const regReqCharlie = new MockRequest('POST', '/api/auth', {}, {
    action: 'register',
    username: 'charlie',
    password: 'charliePassword'
  });
  const regResCharlie = new MockResponse();
  await authHandler(regReqCharlie, regResCharlie);
  const charlieToken = regResCharlie.json().token;

  // Charlie tries to query Alice's stats
  const charlieStatsReq = new MockRequest('POST', '/api/friends', {
    authorization: `Bearer ${charlieToken}`
  }, {
    action: 'stats',
    friendUsername: 'alice'
  });
  const charlieStatsRes = new MockResponse();
  await friendsHandler(charlieStatsReq, charlieStatsRes);
  assert.strictEqual(charlieStatsRes.statusCode, 403);
  assert.ok(charlieStatsRes.json().error.includes('Access denied'));
  console.log('   ✅ Charlie is correctly blocked from viewing Alice\'s stats.');

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  // Cleanup
  for (const p of pathsToClean) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (e) {}
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
