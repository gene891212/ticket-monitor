import { TicketplusProvider } from '../src/providers/ticketplus.js';

const urls = [
  // 已經開賣
  'https://ticketplus.com.tw/activity/4b47b5360d42451f65704664c40b1c72',
  'https://ticketplus.com.tw/activity/4532326416b0ccf5f7e1fbb8769337e7',
  'https://ticketplus.com.tw/activity/057f530e07899c3178678161755eac5c',
  // 尚未開賣
  'https://ticketplus.com.tw/activity/e5baf60463fccb6391ae4dcb2e314978',
  'https://ticketplus.com.tw/activity/7acedf4b414903ac17104384cb416849',
  // 截止
  'https://ticketplus.com.tw/activity/133e449ef09df003e3031b684b9e220b'
];

async function run() {
  const provider = new TicketplusProvider();
  console.log('=== REAL API INTEGRATION TEST ===');
  
  for (const url of urls) {
    console.log(`Checking: ${url}`);
    const start = Date.now();
    const result = await provider.check(url);
    const duration = Date.now() - start;
    
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Overall Status: ${result.status}`);
    console.log(`  Event Name: ${result.eventName}`);
    console.log(`  Detail: ${result.detail}`);
    if (result.sessions) {
      console.log(`  Sessions (${result.sessions.length}):`);
      for (const s of result.sessions) {
        console.log(`    - Name: ${s.name}`);
        console.log(`      Key: ${s.key}`);
        console.log(`      DateTime: ${s.dateTime}`);
        console.log(`      Venue: ${s.venue}`);
        console.log(`      Status: ${s.status}`);
      }
    }
    console.log('');
  }
}

run().catch(console.error);
