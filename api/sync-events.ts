import { verifyTokenAndUser } from './auth.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  const token = req.query.token as string;
  const user = await verifyTokenAndUser(token || '');
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end('Unauthorized');
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send connected event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Serverless functions have execution limits. We can maintain a short live connection,
  // flushing heartbeats every 2 seconds, and close after 9 seconds so the client closes
  // and reconnects cleanly without throwing error logs.
  const startTime = Date.now();
  const interval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (Date.now() - startTime > 9000) {
        clearInterval(interval);
        res.end();
      }
    } catch {
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  req.on('close', () => {
    clearInterval(interval);
  });
}
