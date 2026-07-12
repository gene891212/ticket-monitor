# Cloudflare Worker

This Worker owns the public LINE webhook, subscription data in D1, and LINE push notifications. The Windows monitor calls the two authenticated API endpoints after it checks Tixcraft:

- `GET /api/subscriptions` — list active subscriptions.
- `POST /api/subscriptions/:id/sessions` — submit the current per-session results; the Worker decides whether to notify.

## Deploy

1. Authenticate Wrangler: `npx wrangler login`.
2. D1 has already been created and its ID is present in `wrangler.jsonc`.
3. The schema has already been applied to the production D1 database.
4. Deploy the complete Worker source after setting Secrets: `npx wrangler deploy`.
6. Configure secrets (none are stored in the repository):

   ```powershell
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   npx wrangler secret put WORKER_API_TOKEN
   ```

7. Set LINE's webhook URL to `https://ticket-monitor.hsiehmin.com/webhook/line`.

`WORKER_API_TOKEN` is a long random value used only by the local Windows monitor when it fetches subscriptions and posts session reports.
