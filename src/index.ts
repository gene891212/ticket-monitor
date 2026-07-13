import 'dotenv/config';
import { poll, pollManual } from './monitor.js';

const seconds = Math.max(Number(process.env.POLL_INTERVAL_SECONDS ?? 180), 10);
console.log(`Ticket monitor started; polling every ${seconds} seconds.`);
void poll();
setInterval(() => void poll(), seconds * 1000);
setInterval(() => void pollManual().catch(console.error), 15_000);
