import crypto from 'crypto';

const aesKey = 'ILOVEFETIXFETIX!';
const aesIv = '!@#$FETIXEVENTiv';
const cachedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const urls = [
  'https://ticketplus.com.tw/activity/4b47b5360d42451f65704664c40b1c72',
  'https://ticketplus.com.tw/activity/4532326416b0ccf5f7e1fbb8769337e7',
  'https://ticketplus.com.tw/activity/057f530e07899c3178678161755eac5c',
  'https://ticketplus.com.tw/activity/e5baf60463fccb6391ae4dcb2e314978',
  'https://ticketplus.com.tw/activity/7acedf4b414903ac17104384cb416849',
  'https://ticketplus.com.tw/activity/133e449ef09df003e3031b684b9e220b'
];

function decrypt(hex: string): string {
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(aesKey), Buffer.from(aesIv));
    let decrypted = decipher.update(hex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    return `Failed: ${err.message}`;
  }
}

async function debug() {
  const headers = {
    'user-agent': cachedUserAgent,
    'origin': 'https://ticketplus.com.tw',
  };

  for (const url of urls) {
    const eventUuid = url.split('/').pop()!;
    console.log(`\n=======================`);
    console.log(`URL: ${url}`);
    console.log(`eventUuid: ${eventUuid}`);
    console.log(`eventId: ${decrypt(eventUuid)}`);

    const eventUrl = `https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/${eventUuid}/event.json`;
    const sessionsUrl = `https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/${eventUuid}/sessions.json`;

    console.log(`Fetching event.json from: ${eventUrl}`);
    const eventRes = await fetch(eventUrl, { headers });
    console.log(`Status: ${eventRes.status}`);
    if (eventRes.ok) {
      const data = await eventRes.json() as any;
      console.log(`event.json keys:`, Object.keys(data));
      console.log(`event.json name/title:`, {
        title: data.title,
        name: data.name,
        eventName: data.eventName,
        eventTitle: data.eventTitle,
        title_cn: data.title_cn
      });
      // Print first few fields
      console.log(`Sample data:`, JSON.stringify(data).slice(0, 300));
    } else {
      console.log(`Failed to fetch event.json`);
    }

    console.log(`Fetching sessions.json from: ${sessionsUrl}`);
    const sessionsRes = await fetch(sessionsUrl, { headers });
    console.log(`Status: ${sessionsRes.status}`);
    if (sessionsRes.ok) {
      const data = await sessionsRes.json() as any;
      console.log(`sessions.json keys:`, Object.keys(data));
      if (data.sessions && data.sessions.length > 0) {
        console.log(`First session name:`, data.sessions[0].name);
        console.log(`First session keys:`, Object.keys(data.sessions[0]));
      }
    }
  }
}

debug().catch(console.error);
