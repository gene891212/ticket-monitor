import { Client } from '@line/bot-sdk';
import 'dotenv/config';

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
export const line = token ? new Client({ channelAccessToken: token }) : undefined;
export async function reply(replyToken: string, text: string) {
  if (!line) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
  await line.replyMessage(replyToken, { type: 'text', text });
}
export async function push(userId: string, text: string) {
  if (!line) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
  await line.pushMessage(userId, { type: 'text', text });
}
