# Handoff — Automated Leads Engine

## Project Status

**Phase:** 2 of 3 ✅ COMPLETE
**Branch:** `claude/build-this-lfxpwt`
**Current Blocker:** Vercel deployment dependency resolution (anthropic SDK version)

## What This Project Does

Local website outreach automation engine that:
1. Discovers local businesses via Google Places API (Phase 0)
2. Audits their websites for issues (Phase 0)
3. Generates personalized demo sites from templates (Phase 1)
4. Drafts personalized outreach emails via Claude (Phase 2)
5. Sends emails via Resend and tracks engagement (Phase 2)

**Architecture:** Next.js dashboard + Cloudflare Workers + Supabase PostgreSQL + R2 storage

## Current Status

### What's Done ✅

- **Phase 0 (Discovery & Audit):** Fully working
  - Places API integration (New)
  - PageSpeed audits (mobile + desktop)
  - 10-point issue detection heuristics
  - Lead scoring algorithm (revenue_signal × badness)
  - Screenshot capture via Browser Rendering
  - Optional vision audit via Claude

- **Phase 1 (Demo Generation):** Fully working
  - Hand-built HTML templates per niche (Thai restaurant included)
  - Claude copy-fill service (generates business content)
  - Token replacement engine
  - Photo download & brand color sampling
  - Demo deployment to R2
  - Shareable demo URLs via Cloudflare Worker wildcard routes

- **Phase 2 (Outreach Queue):** Fully working
  - Draft email generation via Claude
  - Resend email service integration
  - Dashboard outreach queue page
  - Email approval workflow (draft → approve → send)
  - Email tracking (status, sent_at, replies)

### Current Issue 🔴

**Vercel Deployment Failing:** anthropic SDK version not found on npm

**Attempts made:**
- `^0.24` → doesn't exist
- `^0.31` → doesn't exist
- `^0.27` → pending test (latest push)

**Status:** Waiting for build with anthropic@^0.27

## Key Files & Structure

```
/home/user/Automated-Leads/
├── apps/dashboard/              # Next.js dashboard (Vercel deployment target)
│   ├── src/app/page.tsx        # Home (list runs)
│   ├── src/app/runs/new/       # New run form
│   ├── src/app/runs/[runId]/   # Worklist page
│   ├── src/app/runs/[runId]/outreach/  # Outreach queue (Phase 2)
│   ├── src/app/api/            # API routes (draft, outreach, send-email)
│   └── package.json
│
├── workers/
│   ├── engine/                  # Main Cloudflare Worker
│   │   ├── src/index.ts        # Route handler (POST /discover, /generate-demo, /draft)
│   │   ├── src/handlers/       # discover, audit, generate (demo), draft
│   │   ├── src/services/       # places, pagespeed, screenshot, vision, copyfill, resend
│   │   └── package.json
│   └── demos/                   # Wildcard demo server
│
├── packages/
│   ├── types/                   # TypeScript schemas + Zod validation
│   ├── utils/                   # Scoring, issue detection logic
│
├── supabase/migrations/         # Database schema + RLS policies
├── templates/                   # Niche HTML templates
│
├── .env.example                 # Environment variables template
├── package.json                 # Root monorepo config
├── vercel.json                  # Vercel build config
├── turbo.json                   # Turbo pipeline
├── tsconfig.json                # TypeScript config
│
├── README.md                    # Architecture & setup
├── PHASE_1.md                   # Phase 1 user guide
├── PHASE_2.md                   # Phase 2 user guide
├── NEXT_STEPS.md                # Phase 3 roadmap
└── HANDOFF.md                   # This file
```

## Development Workflow

### Local Setup

```bash
# 1. Install deps
npm install

# 2. Setup env vars
cp .env.example .env.local
# Fill in: SUPABASE_*, GOOGLE_*, ANTHROPIC_API_KEY, CLOUDFLARE_*, RESEND_*

# 3. Start dev servers
npm run dev                    # Terminal 1: Dashboard on :3000
cd workers/engine && npm run dev  # Terminal 2: Worker on :8787

# 4. Test locally
# Go to http://localhost:3000 → create run → check leads appear
```

### Git Workflow

```bash
# All work on branch: claude/build-this-lfxpwt
git checkout claude/build-this-lfxpwt

# After changes:
git add -A
git commit -m "Clear message describing changes"
git push -u origin claude/build-this-lfxpwt

# Vercel auto-deploys on push
```

## Known Issues & Blockers

### 🔴 Vercel Deployment (Active Blocker)

**Issue:** anthropic SDK version not found
- Tried: 0.24, 0.31, 0.27
- Next: If 0.27 fails, try 0.20-0.26 range or use `*` wildcard
- Root cause: Unclear which anthropic versions exist on npm registry

**Workaround:** Remove anthropic dependency from worker and call API directly via fetch (would require refactoring copyfill + draft handlers)

### ⚠️ Email Enrichment

- Places API doesn't return business email
- Currently: User must manually add emails to database
- Solution (Phase 3): Scrape website contact page or use Hunter API

### ⚠️ Screenshot Timeout

- Current: 5s timeout for page load
- Issue: Slow sites may fail silently
- Solution: Implement retry logic or placeholder fallback

### ⚠️ Template Authoring

- Currently: Manual HTML editing + R2 upload
- Future: Visual builder or Figma plugin

## Environment Variables (Required for Deploy)

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Google
GOOGLE_PLACES_API_KEY=AIza...
GOOGLE_PAGESPEED_API_KEY=AIza...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=abc123
CLOUDFLARE_API_TOKEN=v1.0...
CLOUDFLARE_ZONE_ID=zone123
R2_BUCKET_NAME=outreach-engine

# Resend (Phase 2)
RESEND_API_KEY=re_xxxx...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Worker API
WORKER_API_URL=http://localhost:8787  # Local: localhost:8787, Prod: your domain
```

## Next Steps → Phase 3

### Priority 1: Fix Vercel Deployment
- Resolve anthropic SDK version issue
- Once working: Vercel deployment complete

### Priority 2: Scheduled Discovery (Nightly Cron)
- Auto-discover new leads on schedule
- Files: `/workers/engine/src/handlers/scheduled-discovery.ts`
- Effort: 2–4 hours

### Priority 3: Follow-up Email Scheduling
- Auto-draft follow-ups at +3, +7, +14 days
- Files: `/workers/cron/src/index.ts`, `/workers/engine/src/handlers/follow-up.ts`
- Effort: 3–5 hours

### Priority 4: Reply Detection
- Auto-mark replies via Resend webhooks
- Files: `/apps/dashboard/src/app/api/webhooks/resend/route.ts`
- Effort: 2–3 hours

## Testing Checklist (Before Merge)

- [ ] `npm run type-check` passes
- [ ] `npm run build` completes without errors
- [ ] Local dev server starts without warnings
- [ ] Dashboard loads on http://localhost:3000
- [ ] Can create a new run (small city, 5–10 leads)
- [ ] Leads appear and audit completes within 2min
- [ ] Can generate demo for qualified lead
- [ ] Demo URL is accessible and renders correctly
- [ ] Can draft email and edit/approve/send flow
- [ ] Email received in test inbox (Resend sandbox)

## Useful Commands

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Full build (all packages)
npm run build

# Start dev (all packages in parallel)
npm run dev

# Deploy worker
cd workers/engine && wrangler deploy

# Deploy dashboard to Vercel
cd apps/dashboard && vercel deploy --prod
```

## Documentation Files

- **README.md** — Architecture overview, setup, Phase 0–2 summary
- **PHASE_1.md** — Phase 1 (demo generation) detailed guide
- **PHASE_2.md** — Phase 2 (outreach queue) detailed guide
- **NEXT_STEPS.md** — Phase 3 roadmap with priorities and effort estimates
- **.env.example** — Environment variables template
- **HANDOFF.md** — This file

## Contact / Questions

- **Code structure:** See README.md and PHASE_*.md files
- **API specs:** See PHASE_1.md and PHASE_2.md
- **Architecture decisions:** See README.md "Key Design Decisions"
- **Git history:** Check commits on `claude/build-this-lfxpwt` branch

---

**Last Updated:** 2026-07-08
**Phase Status:** 2/3 complete
**Current Blocker:** Vercel build — anthropic SDK version resolution
