# Outreach Engine — Local Website Outreach Automation

Automatically discover local businesses with poor/missing websites, audit them, generate personalized demo sites, and draft outreach emails.

**Phase 0** (this build): Discovery via Google Places API → Audit via PageSpeed + heuristics → Ranked worklist in dashboard.

## Architecture

```
Next.js Dashboard (Vercel + Clerk) 
  ↓ reads/writes
Supabase (Postgres) — system of record
  ↑ writes results from
Cloudflare Workers (discovery, audits, Browser Rendering, R2)
```

**Monorepo structure:**
```
/apps/dashboard         Next.js app (Vercel)
/workers/engine         Discovery + audit workflows (Cloudflare)
/workers/demos          Wildcard demo server (Phase 1)
/packages/types         Shared TypeScript definitions
/packages/utils         Scoring & issue detection logic
/supabase/migrations    SQL schema
```

## Setup

### Prerequisites

- Node.js 18+
- npm/pnpm
- Accounts: Supabase, Cloudflare, Google Cloud (Places API + PageSpeed), Anthropic, Clerk

### 1. Clone & Install

```bash
git clone <repo>
cd Automated-Leads
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
# Fill in all secrets:
# - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
# - GOOGLE_PLACES_API_KEY, GOOGLE_PAGESPEED_API_KEY
# - ANTHROPIC_API_KEY
# - CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID
# - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
# - WORKER_API_URL (http://localhost:8787 for local dev)
```

### 3. Database Setup

Apply Supabase migrations:

```bash
# Option A: Via Supabase CLI (requires login)
supabase db push

# Option B: Manually via Supabase dashboard
# Open https://supabase.com → your-project → SQL Editor
# Copy and run: supabase/migrations/001_initial_schema.sql
#               supabase/migrations/002_rls_policies.sql
```

### 4. Local Development

**Terminal 1 — Dashboard (Next.js)**
```bash
cd apps/dashboard
npm run dev
# Opens http://localhost:3000
```

**Terminal 2 — Cloudflare Worker (local)**
```bash
cd workers/engine
npm run dev
# Runs on http://localhost:8787
```

Sign in via Clerk at http://localhost:3000/sign-in.

### 5. Deploy (when ready)

**Dashboard → Vercel:**
```bash
# Link to Vercel via dashboard
cd apps/dashboard
vercel deploy --prod
```

**Worker → Cloudflare:**
```bash
cd workers/engine
wrangler deploy
```

**Database → Supabase:** Already running (migrations applied).

## Phase 0 Features

✅ Discover businesses via Google Places API (`niche` + `city`)  
✅ Audit: PageSpeed Insights (mobile + desktop), HTML parsing, SSL check  
✅ Detect issues: no_site, broken, no_ssl, social_only, not_mobile, slow, no_contact, pdf_menu, dated, seo_issues  
✅ Optional: Visual aesthetic audit via Claude vision (toggleable per run)  
✅ Score leads: `revenue_signal * badness`, qualify if rating ≥ 4.4 + review_count ≥ 50  
✅ Dashboard worklist: ranked by priority, filter by status  
✅ Screenshots captured to R2 + displayed in modal  

## Phase 1 (Coming)

- Hand-built niche templates (1 per niche with `{{TOKENS}}`)
- Claude copy-fill (JSON → token replacement)
- Wildcard demo server (`{slug}.demos.example.com`)

## Phase 2 (Coming)

- Outreach queue: draft → approve → send (manual)
- Resend email integration
- Follow-up auto-drafting at +3 days

## Phase 3 (Coming)

- Cloudflare Workflow orchestration
- Queues for fan-out processing
- Nightly Cron runs
- Optional: Browser-based video recording

## Key Design Decisions

1. **Templating, not generation**: Fixed template per niche + content injection. Design quality guaranteed at template level.
2. **Live previews > videos**: Deploy to `{slug}.demos.example.com` via R2. Instant, shareable, trackable.
3. **Manual sends**: Terminal state is `draft`. Comply with Spam Act 2003 (AU) — sends are one-at-a-time behind a button.
4. **Tight API usage**: Exact field masks for Google Places (§5) to minimize billing tier.
5. **Service role server-side**: Workers use Supabase service role (no row-level auth needed yet).

## Guardrails

- **Don't auto-send.** Draft only. Manual approval per email.
- **Don't over-store Places data.** Cache `place_id` long-term; treat other fields as refreshable snapshots.
- **Don't regenerate layouts.** Templates are fixed.
- **Don't default `vision_audit` to true.** Optional toggle per run (real per-lead cost).
- **Don't hotlink Google photos.** Download to R2 first.

## API Specs

**POST /discover** (Worker)
```json
{
  "run_id": "uuid",
  "niche": "thai_restaurant",
  "city": "Sydney"
}
```
Response: `{ "status": "queued|error", "run_id": "uuid", "message": "..." }`

**Scoring Formula** (§7)
```
revenue_signal = ln(max(review_count, 1) + 1) * rating
badness = sum of weighted issue flags, capped at 100
priority = revenue_signal * badness
qualify: rating ≥ 4.4 AND review_count ≥ 50 AND badness > 0
```

## Troubleshooting

**"RLS PGRST116"** — Lead not in user's run. Check RLS policies in Supabase → runs.user_id matches Clerk user.

**"Places API 403"** — API key invalid or quota exceeded. Verify key in Google Cloud Console.

**"Worker POST /discover returns 500"** — Check env vars in wrangler.toml; verify SUPABASE_SERVICE_ROLE_KEY.

**"No leads appearing"** — Discovery is async. Poll /runs/[id] or check run.status in DB.

## Contributing

- Shared types go in `/packages/types`
- Scoring/heuristics go in `/packages/utils`
- Worker logic goes in `/workers/engine/src`
- Dashboard components go in `/apps/dashboard/src`
- Run `npm run type-check` before committing

## License

Proprietary — Fab & Claude
