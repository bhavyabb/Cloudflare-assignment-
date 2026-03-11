# FeedbackPulse — Deployment Guide

## What Your App Uses (all FREE tier)

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| **Workers** | Runs your API + dashboard | 100K requests/day |
| **D1** | SQLite database for feedback | 5GB storage, 5M rows read/day |
| **KV** | Caches pipeline results | 100K reads/day |
| **Workers AI** | Sentiment + classification | 10K neurons/day |
| **Workflows** | Orchestrates the pipeline | 1K runs/day |

**R2 is NOT used.** You don't need to enable it.

---

## Step 1: Create an API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use the **"Edit Cloudflare Workers"** template
4. Add these extra permissions:
   - **Account → D1 → Edit**
   - **Account → Workers KV Storage → Edit**
5. Under "Account Resources", select your account
6. Click **"Continue to summary"** → **"Create Token"**
7. **Copy the token immediately** (you won't see it again)

---

## Step 2: Set Your Token

Run this in your terminal (replace `YOUR_TOKEN_HERE` with the actual token):

```bash
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN_HERE"
export CLOUDFLARE_ACCOUNT_ID="b70a6840301d4cdf0a0142195baca2e1"
```

To make it permanent, add those two lines to your `~/.zshrc` (or `~/.bashrc`), then run:
```bash
source ~/.zshrc
```

Verify it works:
```bash
cd ~/feedbackpulse
npx wrangler whoami
```

You should see your account name. If you get "Invalid API Token", double-check you copied the full token with no extra spaces.

---

## Step 3: Apply the Database Schema

Your D1 database already exists (ID: `f8167793-0692-460f-aab0-199d1fecd574`).

Apply the migration:
```bash
cd ~/feedbackpulse
npx wrangler d1 migrations apply feedbackpulse-db --remote
```

If you already ran this before, you can skip it.

---

## Step 4: Deploy

```bash
cd ~/feedbackpulse
npx wrangler deploy
```

This will output a URL like: `https://feedbackpulse.<your-subdomain>.workers.dev`

---

## Step 5: Use It

1. Open the URL in your browser — you'll see the dashboard
2. Click **"Seed Data"** — loads ~100 test feedback entries into D1
3. Click **"Run Pipeline"** — triggers AI analysis (takes 30-60 seconds)
4. Dashboard auto-refreshes with charts, priority matrix, and action items

---

## Your Existing Resource IDs (already in wrangler.toml)

| Resource | ID |
|----------|----|
| D1 Database | `f8167793-0692-460f-aab0-199d1fecd574` |
| KV Namespace | `8e514f7b52cf4e0eaf9128ffcca87b3f` |

These are already configured in `wrangler.toml`. You don't need to change anything.

---

## Troubleshooting

**"Invalid API Token (1000)"**
- Token was copied with extra whitespace
- Token is scoped to a different account
- Token is missing D1 or KV permissions

**"Worker exceeded CPU time limit"**
- This is normal during heavy AI processing — the workflow handles retries

**"wrangler: command not found"**
- Run `npm install` in the project directory first

---

## Project Structure (after cleanup)

```
feedbackpulse/
├── src/
│   ├── index.ts          # API routes (Hono)
│   ├── workflow.ts        # AI pipeline (10 steps)
│   ├── types.ts           # TypeScript interfaces
│   ├── slack-formatter.ts # Slack message builder
│   ├── dashboard.ts       # HTML dashboard UI
│   └── seed-data.ts       # Test data
├── migrations/
│   └── 0001_init.sql      # Database schema
├── wrangler.toml           # Cloudflare config
└── package.json
```

6 source files. No R2. No external dependencies beyond Hono.
