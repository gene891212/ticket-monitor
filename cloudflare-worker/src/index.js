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
  const manual = report.manualRequestId
    ? await env.DB.prepare("SELECT id,line_user_id FROM manual_check_requests WHERE id=? AND subscription_id=? AND status='claimed'").bind(report.manualRequestId, subscriptionId).first()
    : null;
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
  if (newlyAvailable.length && !manual) {
    const title = report.eventName ?? newlyAvailable[0].name;
    const details = newlyAvailable.map((item) => `• ${item.dateTime}｜${item.venue}`).join('\n');
    await line(env, 'push', { to: subscription.line_user_id, messages: [{ type: 'text', text: `🎫 有可購買場次\n${title}\n${details}\n\n前往購票：${subscription.event_url}` }] });
    await env.DB.batch(newlyAvailable.map((item) => env.DB.prepare('UPDATE subscription_sessions SET last_notified_status=? WHERE subscription_id=? AND session_key=?').bind('available', subscriptionId, item.key)));
  }
  if (manual) {
    const available = (report.sessions ?? []).filter((item) => item.status === 'available');
    const title = report.eventName ?? report.sessions?.[0]?.name ?? '活動';
    const resultText = available.length
      ? `🔎 手動檢查完成\n${title}\n${available.map((item) => `• ${item.dateTime}｜${item.venue}`).join('\n')}\n\n目前有可購買場次：${subscription.event_url}`
      : `🔎 手動檢查完成\n${title}\n目前沒有可購買場次。`;
    await line(env, 'push', { to: manual.line_user_id, messages: [{ type: 'text', text: resultText }] });
    if (available.length) await env.DB.batch(available.map((item) => env.DB.prepare('UPDATE subscription_sessions SET last_notified_status=? WHERE subscription_id=? AND session_key=?').bind('available', subscriptionId, item.key)));
    await env.DB.prepare("UPDATE manual_check_requests SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(manual.id).run();
  }
  return json({ notified: newlyAvailable.length });
}

async function command(env, userId, value) {
  const help = '指令：\n訂閱 <Tixcraft URL>\n我的訂閱\n立即檢查 <訂閱 ID>\n取消 <訂閱 ID>';
  if (/^(help|說明|幫助)$/i.test(value)) return help;
  if (value === '我的訂閱') {
    const { results } = await env.DB.prepare(`
      SELECT s.id, s.event_name, s.event_url, ss.session_date_time, ss.session_name, ss.session_venue, ss.last_status
      FROM subscriptions s
      LEFT JOIN subscription_sessions ss ON s.id = ss.subscription_id
      WHERE s.line_user_id = ? AND s.enabled = 1
      ORDER BY s.created_at DESC, ss.session_date_time ASC
    `).bind(userId).all();

    if (!results || !results.length) return '目前沒有訂閱。';

    const subsMap = new Map();
    for (const row of results) {
      if (!subsMap.has(row.id)) {
        subsMap.set(row.id, {
          id: row.id,
          eventName: row.event_name,
          eventUrl: row.event_url,
          sessions: []
        });
      }
      if (row.session_date_time) {
        subsMap.get(row.id).sessions.push({
          dateTime: row.session_date_time,
          name: row.session_name,
          venue: row.session_venue,
          status: row.last_status
        });
      }
    }

    const messages = [];
    for (const sub of subsMap.values()) {
      let subStr = `# ${sub.id}\n${sub.eventName || sub.eventUrl}`;
      if (sub.sessions.length) {
        const sessionLines = sub.sessions.map((s) => {
          const statusIcon = s.status === 'available' ? '🟢 有票' : s.status === 'unavailable' ? '❌ 售完' : '❓ 未知';
          return `• ${s.dateTime}｜${s.venue}：${statusIcon}`;
        });
        subStr += '\n' + sessionLines.join('\n');
      } else {
        subStr += '\n（尚未取得場次狀態，請稍候或執行立即檢查）';
      }
      messages.push(subStr);
    }
    return messages.join('\n\n');
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
  if (value.startsWith('立即檢查 ')) {
    const subscriptionId = value.slice(5).trim();
    const subscription = await env.DB.prepare('SELECT id FROM subscriptions WHERE id=? AND line_user_id=? AND enabled=1').bind(subscriptionId, userId).first();
    if (!subscription) return '找不到啟用中的訂閱 ID。';
    const recent = await env.DB.prepare("SELECT id FROM manual_check_requests WHERE subscription_id=? AND line_user_id=? AND status IN ('pending','claimed') AND created_at > datetime('now','-60 seconds')").bind(subscriptionId, userId).first();
    if (recent) return '這個訂閱剛剛已送出檢查請求，請稍候。';
    await env.DB.prepare('INSERT INTO manual_check_requests (id,subscription_id,line_user_id) VALUES (?,?,?)').bind(crypto.randomUUID(), subscriptionId, userId).run();
    return '已送出手動檢查請求，約 15 秒內會收到結果。';
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
    if (request.method === 'POST' && url.pathname === '/api/manual-checks/claim') {
      if (!authorized(request, env)) return response('Unauthorized', 401);
      await env.DB.prepare("UPDATE manual_check_requests SET status='pending',claimed_at=NULL WHERE status='claimed' AND claimed_at < datetime('now','-2 minutes')").run();
      const { results } = await env.DB.prepare("SELECT r.id,r.subscription_id AS subscriptionId,s.provider,s.event_url AS eventUrl,r.line_user_id AS lineUserId FROM manual_check_requests r JOIN subscriptions s ON s.id=r.subscription_id WHERE r.status='pending' AND s.enabled=1 ORDER BY r.created_at LIMIT 10").all();
      if (results.length) await env.DB.batch(results.map((item) => env.DB.prepare("UPDATE manual_check_requests SET status='claimed',claimed_at=CURRENT_TIMESTAMP WHERE id=?").bind(item.id)));
      return json(results);
    }
    const failMatch = url.pathname.match(/^\/api\/manual-checks\/([^/]+)\/fail$/);
    if (request.method === 'POST' && failMatch) {
      if (!authorized(request, env)) return response('Unauthorized', 401);
      const item = await env.DB.prepare("SELECT line_user_id FROM manual_check_requests WHERE id=? AND status='claimed'").bind(failMatch[1]).first();
      if (item) {
        await env.DB.prepare("UPDATE manual_check_requests SET status='failed',completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(failMatch[1]).run();
        await line(env, 'push', { to: item.line_user_id, messages: [{ type: 'text', text: '手動檢查失敗，請稍後再試。' }] });
      }
      return json({ ok: true });
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
