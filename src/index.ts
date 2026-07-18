import 'dotenv/config';
import { poll, pollManual } from './monitor.js';

const baseSeconds = Math.max(Number(process.env.POLL_INTERVAL_SECONDS ?? 180), 10);
console.log(`Ticket monitor started; base interval is ${baseSeconds} seconds with randomized jitter.`);

async function scheduleNextPoll() {
  try {
    await poll();
  } catch (error) {
    console.error('Error during poll:', error);
  }

  // Add random jitter of +/- 15% of the base interval to prevent rigid pattern detection by WAF
  const baseMs = baseSeconds * 1000;
  const maxJitter = baseMs * 0.15; 
  const jitter = (Math.random() * 2 - 1) * maxJitter; 
  const nextDelay = Math.max(baseMs + jitter, 5000); 

  setTimeout(() => {
    void scheduleNextPoll();
  }, nextDelay);
}

// Start the loop
void scheduleNextPoll();

// Manual check queries our own Cloudflare Worker (not Tixcraft), so a fixed interval is fine
setInterval(() => void pollManual().catch(console.error), 15_000);
