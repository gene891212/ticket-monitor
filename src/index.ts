import 'dotenv/config';
import { poll } from './monitor.js';

const seconds = Math.max(Number(process.env.POLL_INTERVAL_SECONDS ?? 180), 120);
console.log(`Ticket monitor started; polling every ${seconds} seconds.`);
void poll();
setInterval(() => void poll(), seconds * 1000);
