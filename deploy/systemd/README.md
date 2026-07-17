# systemd deployment

This service runs the local Playwright monitor. The LINE webhook, subscription
database, and notification delivery remain on the Cloudflare Worker.

## One-time setup

From the project root:

```bash
cp .env.example .env
# Edit .env and set WORKER_API_TOKEN to the secret configured on the Worker.
pnpm run build
pnpm exec playwright install --with-deps chromium
```

Install the unit and start it:

```bash
sudo cp deploy/systemd/ticket-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ticket-monitor
sudo systemctl status ticket-monitor
```

View live logs:

```bash
journalctl -u ticket-monitor -f
```

After changing TypeScript source code, rebuild and restart the service:

```bash
pnpm run build
sudo systemctl restart ticket-monitor
```

The unit is prefilled for user `j41215` and this repository path. If either
changes, update `User`, `Group`, `WorkingDirectory`, `ExecStart`, and
`PLAYWRIGHT_BROWSERS_PATH` before copying the unit to `/etc/systemd/system/`.
