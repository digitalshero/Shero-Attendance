# Shero Attendance — EC2 Deployment Package (prepared, not executed)

This directory contains templates only. Nothing here has been installed,
activated, or run against the shared EC2/RDS infrastructure. Every command
below is for whoever holds deploy access to run manually, in order, with
verification between steps.

## 1. Directory structure on the server

```
/data/shero-attendance/
├── backend/                  # this repo's backend/, after `npm ci && npm run build`
│   ├── dist/                 # compiled output (npm run build)
│   ├── uploads/              # leave attachments — persistent, NOT in git, back this up
│   └── .env                  # from backend/.env.production.example, chmod 600, never committed
└── frontend-dist/            # this repo's frontend/, after `npm ci && npm run build`, dist/ copied here
```

`/data/shero-attendance` sits alongside the existing `/data/kob-crm` — a sibling
directory, nothing inside `/data/kob-crm` is read or written by this project.

## 2. Backend production readiness (Step 1 audit findings)

| Item | Status |
|---|---|
| Build command | `npm run build` (tsc → `dist/`) — verified present |
| Start command | `node dist/server.js`, now binds to `127.0.0.1` not `0.0.0.0` (fixed in `src/server.ts`) |
| Required env vars | `POSTGRES_URL`, `JWT_SECRET`, `HOST`, `PORT`, `FRONTEND_URL` (see `.env.production.example`) |
| DB SSL | `db.ts` requires SSL **with certificate verification** unless `PGSSLMODE=disable` — in production it reads the CA bundle from `DATABASE_SSL_CA_PATH` and refuses to start if that file is missing or unreadable (see section 3a) |
| CORS | Driven by `FRONTEND_URL` env var — set to the real domain once confirmed; currently also allows `*.vercel.app` for the existing frontend, harmless to leave but can be removed once Vercel is decommissioned |
| JWT | Stateless, 365-day expiry, signed with `JWT_SECRET` — no DB-backed sessions to migrate |
| Health check | `GET /api/health` → `{"status":"ok"}`, already implemented, no changes needed |
| Upload storage | `backend/uploads/leave-attachments/` on local disk via multer — must persist across deploys (not wiped by `git pull`/rebuild) and should be backed up |

## 3a. PostgreSQL TLS certificate verification (RDS CA)

The backend never connects to Postgres with an unverified TLS certificate in production.
`db.ts` requires `DATABASE_SSL_CA_PATH` to point at a readable CA bundle and fails to start
(throws before listening) if it's missing — it does not silently fall back to an insecure
connection. `PGSSLMODE=disable` is the only opt-out, and it's meant for local dev only.

Install the CA bundle on the server, outside the git-managed directory:

```bash
sudo mkdir -p /data/shero-attendance/certs
# ap-south-1 regional bundle (covers the RDS instance's region):
sudo curl -o /data/shero-attendance/certs/rds-ca.pem \
  https://truststore.pki.rds.amazonaws.com/ap-south-1/ap-south-1-bundle.pem
sudo chown shero-attendance:shero-attendance /data/shero-attendance/certs/rds-ca.pem
sudo chmod 644 /data/shero-attendance/certs/rds-ca.pem
```

Then set `DATABASE_SSL_CA_PATH=/data/shero-attendance/certs/rds-ca.pem` in `backend/.env`
(already the default in `.env.production.example`). This bundle is public AWS material (not
a secret) and is intentionally kept outside the repo so it's managed per-server, not per-deploy.

## 3. Shared-server isolation checklist

- [x] Backend binds to `127.0.0.1:4800`, never `0.0.0.0` (see `src/server.ts` change)
- [x] Port 4800 confirmed free, chosen deliberately to avoid DST/KOB CRM
- [x] Nginx config is a **new, separate file** (`deploy/nginx/shero-attendance.conf`) — does not touch any existing `sites-available` file
- [x] systemd unit is a **new, separate service** (`shero-attendance.service`) — does not restart, depend on, or reference `dst.service` / `kob-crm.service`
- [x] No global npm/node config changes — Node version pinned per-app via whatever Node binary is already on the box (confirm version compatibility before deploy; this project doesn't require a newer Node than what's already serving DST/KOB)
- [x] Dedicated OS user (`shero-attendance`) proposed in the systemd unit, instead of running as the same user as other apps
- [x] Dedicated database (`shero_attendance`) and role (`attendance_app`) — never the shared `dbadmin` RDS account
- [x] Resource limits set in the systemd unit (`MemoryMax=512M`, `CPUQuota=100%`, `TasksMax=200`) so a runaway process can't starve DST/KOB

## 4. What still requires a human with elevated access (not done here)

- Creating the dedicated RDS database + role: run by an AWS/DB admin, **not** by this app's own credentials:
  ```sql
  -- Run once, by someone with dbadmin access, NOT via this repo or this session:
  CREATE ROLE attendance_app LOGIN PASSWORD '<new, unique, generated password>';
  CREATE DATABASE shero_attendance OWNER attendance_app;
  -- Then apply backend/sql/schema.sql while connected as attendance_app to shero_attendance.
  ```
- Confirming the production domain (GoDaddy DNS → the shared EC2 instance's public IP, kept out of this repo), then issuing TLS via `certbot --nginx -d <domain>`
- Creating the `shero-attendance` OS user and `/data/shero-attendance` directory with correct ownership
- Confirming Node.js version available on the box is compatible (project uses Express 5 / TS 5.9, targets `es2017`+ — Node 18+ recommended)
- Reviewing/approving the systemd resource limits against actual box headroom (2 vCPU / 3.8 GiB shared with DST + KOB CRM)

## 5. Deployment steps (for the operator to run manually — not automated here)

```bash
# 1. Clone
sudo mkdir -p /data/shero-attendance
sudo chown shero-attendance:shero-attendance /data/shero-attendance
sudo -u shero-attendance git clone https://github.com/digitalshero/Shero-Attendance.git /data/shero-attendance/src

# 2. RDS CA bundle (see section 3a) — required before the backend will start
sudo mkdir -p /data/shero-attendance/certs
sudo curl -o /data/shero-attendance/certs/rds-ca.pem \
  https://truststore.pki.rds.amazonaws.com/ap-south-1/ap-south-1-bundle.pem
sudo chown shero-attendance:shero-attendance /data/shero-attendance/certs/rds-ca.pem

# 3. Backend build
cd /data/shero-attendance/src/backend
npm ci
npm run build
cp .env.production.example /data/shero-attendance/backend/.env   # then edit real values, chmod 600
mkdir -p /data/shero-attendance/backend/uploads/leave-attachments

# 4. Frontend build
cd /data/shero-attendance/src/frontend
cp .env.production.example .env.production   # edit VITE_API_URL
npm ci
npm run build
sudo mkdir -p /data/shero-attendance/frontend-dist
sudo cp -r dist/* /data/shero-attendance/frontend-dist/

# 5. systemd
sudo cp deploy/shero-attendance.service /etc/systemd/system/shero-attendance.service
sudo systemctl daemon-reload
sudo systemctl enable shero-attendance
sudo systemctl start shero-attendance
sudo systemctl status shero-attendance   # verify active (running)

# 6. Nginx (new site only — does not touch existing sites)
sudo cp deploy/nginx/shero-attendance.conf /etc/nginx/sites-available/shero-attendance
sudo ln -s /etc/nginx/sites-available/shero-attendance /etc/nginx/sites-enabled/shero-attendance
sudo nginx -t          # MUST pass before reload
sudo systemctl reload nginx   # reload, never restart, to avoid dropping DST/KOB connections

# 7. TLS (after DNS for the confirmed domain points at this EC2 IP)
sudo certbot --nginx -d <confirmed-domain>
```

## 6. Verification

```bash
curl -s http://127.0.0.1:4800/api/health        # backend direct, from the box itself
curl -s https://<confirmed-domain>/api/health   # through Nginx + TLS
sudo systemctl status shero-attendance dst kob-crm nginx   # confirm all four are healthy, nothing else bounced
sudo ss -tlnp | grep 4800                        # confirm only 127.0.0.1:4800, not 0.0.0.0:4800
```

## 7. Rollback

```bash
sudo systemctl stop shero-attendance
sudo systemctl disable shero-attendance
sudo rm /etc/nginx/sites-enabled/shero-attendance
sudo nginx -t && sudo systemctl reload nginx
# /data/shero-attendance left in place for post-mortem / retry — delete manually only once confirmed safe.
```

This never touches `dst.service`, `kob-crm.service`, their Nginx configs, or their databases at any point.
