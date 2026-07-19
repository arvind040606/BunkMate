import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log("Starting real backend HTTP flow test...");

  // 1. Register User A and User B
  const suffix = Date.now().toString().slice(-6);
  const usernameA = `alice_${suffix}`;
  const usernameB = `bob_${suffix}`;

  console.log(`Registering ${usernameA}...`);
  const resA = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', username: usernameA, password: 'password123' })
  });
  const dataA = await resA.json();
  assert.ok(dataA.success, `Failed to register User A: ${JSON.stringify(dataA)}`);
  const tokenA = dataA.token;
  const userIdA = dataA.userId;
  console.log(`User A registered with ID: ${userIdA}`);

  console.log(`Registering ${usernameB}...`);
  const resB = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', username: usernameB, password: 'password123' })
  });
  const dataB = await resB.json();
  assert.ok(dataB.success, `Failed to register User B: ${JSON.stringify(dataB)}`);
  const tokenB = dataB.token;
  const userIdB = dataB.userId;
  console.log(`User B registered with ID: ${userIdB}`);

  // 2. Sync a subject and attendance for User A
  console.log("Syncing subject and attendance for User A...");
  const syncTime = Date.now();
  const syncRes = await fetch(`${BASE_URL}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      lastSynced: 0,
      changes: [
        {
          table: 'subjects',
          recordId: 'sub-test-101',
          payload: {
            name: 'Mathematics',
            color: '#4f46e5',
            targetPercentage: 75,
            initialPresent: 2,
            initialAbsent: 1,
            schedule: [
              { id: 'sch-1', dayOfWeek: 1, time: '09:00 AM', duration: 60 }
            ]
          },
          updatedAt: syncTime
        },
        {
          table: 'attendance',
          recordId: 'att-test-101',
          payload: {
            subjectId: 'sub-test-101',
            date: '2026-07-06',
            status: 'attended',
            timestamp: syncTime
          },
          updatedAt: syncTime
        }
      ]
    })
  });

  const syncData = await syncRes.json();
  assert.ok(syncData.success, `Failed to sync User A changes: ${JSON.stringify(syncData)}`);
  console.log("User A synced successfully.");

  // 3. Send friend request from User B to User A
  console.log(`Sending friend request from ${usernameB} to ${usernameA}...`);
  const reqRes = await fetch(`${BASE_URL}/api/friends`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ action: 'request', friendUsername: usernameA })
  });
  const reqData = await reqRes.json();
  assert.ok(reqData.success, `Failed to send friend request: ${JSON.stringify(reqData)}`);
  console.log("Friend request sent.");

  // 4. Accept friend request as User A
  console.log(`Accepting friend request as ${usernameA}...`);
  const acceptRes = await fetch(`${BASE_URL}/api/friends`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ action: 'respond', friendUsername: usernameB, accept: true })
  });
  const acceptData = await acceptRes.json();
  assert.ok(acceptData.success, `Failed to accept friend request: ${JSON.stringify(acceptData)}`);
  console.log("Friend request accepted.");

  // 5. Query User A's stats as User B
  console.log(`Querying ${usernameA}'s stats as ${usernameB}...`);
  const statsRes = await fetch(`${BASE_URL}/api/friends`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ action: 'stats', friendUsername: usernameA })
  });
  const statsData = await statsRes.json();
  assert.ok(statsData.success, `Failed to query stats: ${JSON.stringify(statsData)}`);
  
  console.log("Received Stats:", JSON.stringify(statsData, null, 2));

  // Verify that the attendance rate reflects both initial count and sync records
  // Initial present = 2, initial absent = 1.
  // Plus 1 attended record -> total present = 3, total absent = 1.
  // Percentage = 3 / 4 = 75%.
  assert.strictEqual(statsData.overallPercentage, 75, `Expected 75%, got ${statsData.overallPercentage}`);
  assert.strictEqual(statsData.subjects[0].name, 'Mathematics');
  console.log("✅ Real HTTP flow test passed successfully!");
}

run().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
