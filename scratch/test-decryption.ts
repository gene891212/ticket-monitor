import * as crypto from 'crypto';

const key = 'ILOVEFETIXFETIX!';
const iv = '!@#$FETIXEVENTiv';

function decrypt(hex: string): string {
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));
    let decrypted = decipher.update(hex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    return `Failed to decrypt: ${err.message}`;
  }
}

// Let's test the 6 event UUIDs from the user's links
const uuids = [
  '4b47b5360d42451f65704664c40b1c72', // 音田雅則
  '4532326416b0ccf5f7e1fbb8769337e7', // EMI NODA
  '057f530e07899c3178678161755eac5c', // Ave Mujica
  'e5baf60463fccb6391ae4dcb2e314978', // TREASURE
  '7acedf4b414903ac17104384cb416849', // YUURI
  '133e449ef09df003e3031b684b9e220b'  // YUURI Ended
];

console.log('=== DECRYPTION TEST ===');
for (const uuid of uuids) {
  const decrypted = decrypt(uuid);
  console.log(`UUID: ${uuid} -> Decrypted: ${decrypted}`);
}
