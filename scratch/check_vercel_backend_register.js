async function testBackend() {
  const url = 'https://bunkmate-lilac.vercel.app/api/auth';
  const randomUser = 'testrand' + Math.random().toString(36).substring(7);
  const payload = {
    action: 'register',
    username: randomUser,
    password: 'somepassword123',
    securityQuestion: 'What is your major course name?',
    securityAnswer: 'CS'
  };

  try {
    console.log("Sending POST to:", url, "for user:", randomUser);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Response Status:", response.status);
    console.log("Response Payload:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testBackend();
