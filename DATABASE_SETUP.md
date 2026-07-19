# BunkMate Online Database Setup Guide (Turso/libSQL)

BunkMate is configured to support a persistent, online, multi-user database via **Turso (libSQL)**. 

If you do not configure a remote database:
- Localhost development will store data in `bunkmate_backend.sqlite` in the project root.
- Serverless platforms like **Vercel** will store data in `/tmp/bunkmate_backend.sqlite`, which is **ephemeral** and gets wiped automatically by Vercel every time the function goes cold (causing "Invalid username/password", missing accounts, and wrong session states).

To ensure every user's account and password are saved permanently online across APK, Vercel, and Localhost, follow these simple setup steps:

---

## 1. Create a Free Turso Database (Takes 1 Minute)

1. Go to **[Turso.tech](https://turso.tech)** and sign up for a free account (includes up to 500 databases and 9GB storage, which is more than enough).
2. Install the Turso CLI (or use the web dashboard).
3. Create a new database named `bunkmate`:
   ```bash
   turso db create bunkmate
   ```
4. Retrieve your **Database URL**:
   ```bash
   turso db show bunkmate --url
   # Example: libsql://bunkmate-username.turso.io
   ```
5. Generate an **Auth Token**:
   ```bash
   turso db tokens create bunkmate
   # Example: eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## 2. Configure Vercel Environment Variables (For APK and Production Web App)

1. Open your Vercel Dashboard and select your project (`bunkmate-lilac` or similar).
2. Go to **Settings** > **Environment Variables**.
3. Add the following two environment variables:
   - **Key**: `TURSO_DATABASE_URL`
     - **Value**: `libsql://your-database-name-username.turso.io`
   - **Key**: `TURSO_AUTH_TOKEN`
     - **Value**: `your-generated-auth-token`
4. Re-deploy your Vercel project to apply the environment variables.

*Once added, the API backend hosted on Vercel will automatically connect to your online Turso database. All APK installations and web users will store and verify their credentials securely from this single online source.*

---

## 3. Configure Localhost Environment Variables (For Dev/Testing)

To test the remote database locally, create a file named `.env` in the root of your `Bunkmate` project:

```env
TURSO_DATABASE_URL=libsql://your-database-name-username.turso.io
TURSO_AUTH_TOKEN=your-generated-auth-token
JWT_SECRET=your_super_secret_key_here
```

Restart your local dev server (`npm run dev`) and it will read from the online database.

---

## 4. Privacy & Breach Hardening Implemented
- **Password Hashing**: Passwords are securely hashed with a cryptographically secure random `salt` using `PBKDF2-HMAC-SHA512` with 10,000 iterations.
- **Recovery Clue Hashing**: The security recovery answers are hashed with a separate random `salt`. Even in the event of a database breach, attackers cannot read your users' recovery answers in plaintext.
- **Enumeration Attack Protection**: Asking for a security question for an unregistered username returns a realistic fake question to prevent attackers from probing whether specific usernames exist.
