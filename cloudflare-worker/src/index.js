const API = 'https://api.line.me/v2/bot/message';
const response = (body, status = 200) => new Response(body, { status });
const json = (body, status = 200) => Response.json(body, { status });
const authorized = (request, env) => env.WORKER_API_TOKEN && request.headers.get('authorization') === `Bearer ${env.WORKER_API_TOKEN}`;

async function signature(raw, value, secret) {
  if (!value || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  return btoa(String.fromCharCode(...new Uint8Array(bytes))) === value;
}
async function line(env, path, body) {
  const r = await fetch(`${API}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`LINE API HTTP ${r.status}`);
}
function isTixcraft(value) { try { return new URL(value).hostname.endsWith('tixcraft.com'); } catch { return false; } }

async function saveReport(request, env, subscriptionId) {
  if (!authorized(request, env)) return response('Unauthorized', 401);
  const subscription = await env.DB.prepare('SELECT line_user_id,event_url FROM subscriptions WHERE id=? AND enabled=1').bind(subscriptionId).first();
  if (!subscription) return response('Not found', 404);
  const report = await request.json();
  const newlyAvailable = [];
  for (const session of report.sessions ?? []) {
    const old = await env.DB.prepare('SELECT last_notified_status FROM subscription_sessions WHERE subscription_id=? AND session_key=?').bind(subscriptionId, session.key).first();
    await env.DB.prepare(`INSERT INTO subscription_sessions (subscription_id,session_key,session_date_time,session_name,session_venue,last_status,last_notified_status)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(subscription_id,session_key) DO UPDATE SET
        session_date_time=excluded.session_date_time,session_name=excluded.session_name,session_venue=excluded.session_venue,last_status=excluded.last_status,
        last_notified_status=CASE WHEN excluded.last_status='available' THEN subscription_sessions.last_notified_status ELSE excluded.last_status END,
        updated_at=CURRENT_TIMESTAMP`).bind(subscriptionId, session.key, session.dateTime, session.name, session.venue, session.status, null).run();
    if (session.status === 'available' && old?.last_notified_status !== 'available') newlyAvailable.push(session);
  }
  if (newlyAvailable.length) {
    const title = report.eventName ?? newlyAvailable[0].name;
    const details = newlyAvailable.map((item) => `• ${item.dateTime}｜${item.venue}`).join('\n');
    await line(env, 'push', { to: subscription.line_user_id, messages: [{ type: 'text', text: `🎫 有可購買場次\n${title}\n${details}\n\n前往購票：${subscription.event_url}` }] });
    await env.DB.batch(newlyAvailable.map((item) => env.DB.prepare('UPDATE subscription_sessions SET last_notified_status=? WHERE subscription_id=? AND session_key=?').bind('available', subscriptionId, item.key)));
  }
  return json({ notified: newlyAvailable.length });
}

async function command(env, userId, value) {
  const help = '指令：\n訂閱 <Tixcraft URL>\n我的訂閱\n取消 <訂閱 ID>';
  if (/^(help|說明|幫助)$/i.test(value)) return help;
  if (value === '我的訂閱') {
    const { results } = await env.DB.prepare('SELECT id,event_name,event_url FROM subscriptions WHERE line_user_id=? AND enabled=1 ORDER BY created_at DESC').bind(userId).all();
    return results.length ? results.map((v) => `# ${v.id}\n${v.event_name || v.event_url}`).join('\n\n') : '目前沒有訂閱。';
  }
  if (value.startsWith('取消 ')) {
    const r = await env.DB.prepare('UPDATE subscriptions SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND line_user_id=?').bind(value.slice(3).trim(), userId).run();
    return r.meta.changes ? '已停止此訂閱。' : '找不到訂閱 ID。';
  }
  if (value.startsWith('訂閱 ')) {
    const eventUrl = value.slice(3).trim();
    if (!isTixcraft(eventUrl)) return '請提供有效的 Tixcraft 活動網址。';
    const old = await env.DB.prepare('SELECT id FROM subscriptions WHERE line_user_id=? AND event_url=?').bind(userId, eventUrl).first();
    const id = old?.id || crypto.randomUUID();
    await env.DB.prepare("INSERT INTO subscriptions (id,line_user_id,provider,event_url) VALUES (?,?,'tixcraft',?) ON CONFLICT(line_user_id,event_url) DO UPDATE SET enabled=1,updated_at=CURRENT_TIMESTAMP").bind(id, userId, eventUrl).run();
    return `已開始監控。\n訂閱 ID：${id}`;
  }
  return '輸入「說明」查看指令。';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/healthz') return json({ ok: true });
    if (request.method === 'GET' && url.pathname === '/api/subscriptions') {
      if (!authorized(request, env)) return response('Unauthorized', 401);
      const { results } = await env.DB.prepare('SELECT id,provider,event_url FROM subscriptions WHERE enabled=1').all(); return json(results);
    }
    const reportMatch = url.pathname.match(/^\/api\/subscriptions\/([^/]+)\/sessions$/);
    if (request.method === 'POST' && reportMatch) return saveReport(request, env, reportMatch[1]);
    if (request.method !== 'POST' || url.pathname !== '/webhook/line') return response('Not found', 404);
    const raw = await request.text();
    if (!await signature(raw, request.headers.get('x-line-signature'), env.LINE_CHANNEL_SECRET)) return response('Unauthorized', 401);
    const { events } = JSON.parse(raw);
    await Promise.all(events.map(async (event) => {
      if (event.type !== 'message' || event.message?.type !== 'text' || !event.source?.userId) return;
      const message = await command(env, event.source.userId, event.message.text.trim());
      await line(env, 'reply', { replyToken: event.replyToken, messages: [{ type: 'text', text: message }] });
    }));
    return response('OK');
  }
};
