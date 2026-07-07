# Next Steps — Phase 0 to Phase 1+

## What's Built (Phase 0)

✅ **Database Schema** (`/supabase/migrations/`)
- `runs`, `leads`, `audits`, `templates`, `demos`, `outreach` tables with indexes and RLS
- Updated triggers for `updated_at` tracking
- Service role bypass for workers

✅ **Shared Utilities** (`/packages/`)
- **types**: Comprehensive TypeScript definitions + Zod schemas for all data models
- **utils**: Scoring logic (revenue_signal × badness), issue detection (10 heuristics), qualification gates

✅ **Cloudflare Workers** (`/workers/engine/`, `/workers/demos/`)
- **engine**: POST /discover endpoint for Places API → leads upsert
- **audit handler**: PageSpeed, SSL, screenshot, optional vision audit
- **R2 storage**: Screenshot upload & URL generation
- **demos**: Wildcard route handler for `{slug}.demos.domain` (Phase 1 ready)

✅ **Next.js Dashboard** (`/apps/dashboard/`)
- Clerk authentication
- Home page: list existing runs
- New run form: niche + city + config (vision_audit toggle)
- Worklist page: ranked leads table, detail modal with screenshot + audit results
- Real-time polling for lead updates (5s intervals)

---

## Immediate Next Steps (Complete Phase 0 → Phase 1)

### Step 1: Test Locally (2–3 hours)

1. **Setup**
   ```bash
   npm install
   cp .env.example .env.local
   # Fill in all secrets
   ```

2. **Run Supabase migrations**
   - Via Supabase dashboard or CLI

3. **Start local dev**
   ```bash
   npm run dev
   # Terminal 2: cd workers/engine && npm run dev
   ```

4. **Test the flow**
   - Create Clerk user at http://localhost:3000
   - Kick off a run (try small city like "Newtown Sydney")
   - Monitor `/runs/[id]` for leads appearing
   - Check Supabase dashboard for audit records

5. **Troubleshoot**
   - Check browser DevTools (Network tab) for worker calls
   - Check terminal logs for API errors
   - Verify env vars in both dashboard and worker

### Step 2: Deploy Environments (4–6 hours)

**Supabase Production**
- Create a Supabase project (free tier ok for MVP)
- Apply migrations (use Supabase CLI: `supabase db push`)
- Enable RLS on all tables
- Copy project URL and keys to `.env`

**Cloudflare Worker**
- `cd workers/engine && wrangler login && wrangler publish`
- Update `wrangler.toml` with production route (e.g., `api.yourdomain.com`)
- Test `/discover` endpoint via curl or Postman

**Next.js on Vercel**
- `cd apps/dashboard && vercel deploy --prod`
- Set environment variables in Vercel dashboard
- Update Clerk settings to use Vercel URL
- Test sign-in and run creation

**DNS for Worker**
- Point `api.yourdomain.com` to Cloudflare (via zone settings)
- Configure zone ID in wrangler.toml

---

## Phase 1: Demo Generation (Week 2)

### 1. Hand-Build a Template (`/templates/`)

Create `/templates/thai_restaurant/template.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>{{BUSINESS_NAME}} - Thai Restaurant</title>
  <meta name="description" content="{{TAGLINE}}">
  <style>
    body { font-family: system-ui; }
    .hero { background: {{BRAND_HEX}}; color: white; padding: 2rem; }
    .hero h1 { font-size: 2rem; margin: 0; }
    .hero p { font-size: 1.1rem; margin: 0.5rem 0 0; }
    /* ... more CSS ... */
  </style>
</head>
<body>
  <div class="hero" style="background-image: url({{HERO_IMAGE}}); background-size: cover;">
    <h1>{{BUSINESS_NAME}}</h1>
    <p>{{HERO_TAGLINE}}</p>
  </div>

  <section class="about">
    <h2>Our Story</h2>
    <p>{{STORY}}</p>
  </section>

  <section class="menu">
    <h2>Dishes</h2>
    <div class="menu-grid">
      {{SERVICES_JSON}}
    </div>
  </section>

  <section class="testimonials">
    <h2>From Our Customers</h2>
    {{TESTIMONIALS_JSON}}
  </section>

  <footer>
    <p>{{ADDRESS}}</p>
    <p>{{PHONE}}</p>
    <p>Hours: {{HOURS}}</p>
  </footer>
</body>
</html>
```

### 2. Implement Demo Generation (`/workers/engine/src/handlers/generate.ts`)

```typescript
// Input: lead + template
// 1. Download 3-5 photos from Places → R2
// 2. Sample brand colour from first photo
// 3. Call Claude: business data + template direction → JSON token values
// 4. String-replace tokens into template HTML
// 5. Upload to R2 at demos/{slug}.html
// 6. Upsert demos table
```

### 3. Wire Dashboard

- Add `/apps/dashboard/src/components/DemoPreview.tsx`
- Show demo link in lead modal
- Button to copy shareable URL

---

## Phase 2: Outreach Queue ✅ COMPLETE

### ✅ What's Built

- ✅ Outreach table (already in schema)
- ✅ Draft generator handler (`/workers/engine/src/handlers/draft.ts`)
  - Calls Claude: business data + issues → subject + body
  - Stores in outreach table with status=draft
- ✅ Resend email service (`/workers/engine/src/services/resend.ts`)
  - Sends HTML emails via Resend API
  - Requires verified sender domain
- ✅ Dashboard outreach queue (`/apps/dashboard/src/app/runs/[runId]/outreach/page.tsx`)
  - Table of draft emails
  - Edit, approve, send workflow
  - Email status tracking (draft → approved → sent → bounced/replied)
- ✅ API routes
  - POST `/api/draft` — generate draft
  - GET/PUT `/api/outreach` — manage outreach records
  - POST `/api/send-email` — send via Resend

### 📖 Documentation

- See `/PHASE_2.md` for full Phase 2 user guide
- Setup: Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env

---

## Phase 3: Automation & Scheduling (Week 4+)

### Priority 1: Scheduled Discovery (Nightly Cron)

Auto-discover new leads on a schedule (no manual "New Run" clicks).

- Create `discovery_schedules` table in Supabase
- Dashboard settings page to configure niche + city list
- Cloudflare Worker Scheduler: run every night at 2 AM UTC
- Kick off `/discover` endpoint for each niche/city combo
- Show last run time + next scheduled run in UI

**Files to create:**
- `/workers/engine/src/handlers/scheduled-discovery.ts`
- `/apps/dashboard/src/app/settings/discovery/page.tsx`
- `/apps/dashboard/src/app/api/discovery-config/route.ts`

**Estimated effort:** 2–4 hours

### Priority 2: Follow-up Email Scheduling

Auto-draft follow-up emails at +3 days, +7 days, +14 days post-send.

- Extend outreach table with follow_up_*_at, follow_up_*_sent fields
- Daily cron task: check if follow-ups are due
- Call Claude with original email + context → generate follow-up
- Insert new outreach record as draft (linked to parent)
- Dashboard shows follow-up chain

**Files to create:**
- `/workers/cron/src/index.ts` (scheduled cron worker)
- `/workers/cron/wrangler.toml`
- `/workers/engine/src/handlers/follow-up.ts`

**Estimated effort:** 3–5 hours

### Priority 3: Reply Detection (Resend Webhooks)

Automatically detect and mark replies in dashboard.

- Use Resend Webhooks (easier than email forwarding)
- Create webhook receiver endpoint
- Parse Resend reply events → update outreach status
- Dashboard shows "Replied" status + reply preview

**Files to create:**
- `/apps/dashboard/src/app/api/webhooks/resend/route.ts`

**Estimated effort:** 2–3 hours

### Optional: Lead Pipeline Dashboard

Visual Kanban-style pipeline view (discovery → audited → qualified → demo → sent).

- `/apps/dashboard/src/app/runs/[runId]/pipeline/page.tsx`
- Columns per lead status with card count + stats
- Click to open lead modal

**Estimated effort:** 2–3 hours

### Optional: Browser Video Recording

Record short video of demo site (alternative to screenshot).

- Extend screenshot service to record .webm video (5–10 seconds)
- Upload to R2, store video_url in demos table
- Dashboard shows video player in lead modal

**Estimated effort:** 2–3 hours

---

## Critical Known Gaps

### Phase 0–2 (Current)

- **Email enrichment** (Places API doesn't return email)
  - Currently: Using lead.email from database (if available)
  - Fallback: Manual copy-paste to lead record
  - Future: Scrape website contact page or Hunter/Apollo API

- **Phone number formatting**
  - Currently: Using raw phone from Places API
  - Needs: Validate international numbers, format per region

- **Screenshot timeout handling**
  - Currently: 5s timeout, may fail on slow sites
  - Needs: Fallback to placeholder or retry logic

- **Rate limiting & quotas**
  - Google Places: generous free tier, but monitor usage
  - PageSpeed: free tier ok, but queue with backoff
  - Anthropic: ~3M tokens/month on free tier
  - Resend: free tier 100/day; $0.30–$0.35 per 1,000 emails

- **Email delivery tracking**
  - Currently: Resend provides bounce/open webhooks (Phase 3)
  - Manual reply marking (Phase 3: auto-detection via webhooks)

### Phase 3 (Upcoming)

- **Scheduled discovery**
  - Need: Cloudflare Workers Scheduler or external trigger
  - Needed by: Nightly automated discovery runs

- **Follow-up automation**
  - Need: Cron worker + follow-up template variants
  - Needed by: Auto-drafting at +3, +7, +14 days

- **Reply parsing**
  - Need: Email forwarding service or Resend webhooks
  - Needed by: Auto-detect replies and update status

### Future (Post-Phase 3)

- **Template authoring UX**
  - Currently: Edit HTML manually + upload to R2
  - Future: Visual builder or Figma plugin?

- **A/B Testing**
  - Subject line variants
  - Demo link timing
  - Email body copy variants

- **Lead scoring refinement**
  - Current: Static weights for badness scores
  - Future: ML-based re-ranking or user feedback loop

---

## Testing Checklist Before Shipping Phase 0

- [ ] Create run with small city (5-10 businesses)
- [ ] Verify leads appear in dashboard within 30s
- [ ] Verify audits complete (issue_summary populated)
- [ ] Verify priority scores (highest = best rating + most issues)
- [ ] Verify qualified leads filtered by rating ≥ 4.4 + review_count ≥ 50
- [ ] Verify screenshot captured and displayed
- [ ] Verify vision audit works (if toggled on)
- [ ] Verify dead leads hideable
- [ ] Verify RLS: another Clerk user cannot see first user's runs
- [ ] Verify worker rate limiting (no 429s from Google)

---

## Env Vars Checklist

```bash
# Supabase (get from project settings)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Google (enable Place API New + PageSpeed, create API key)
GOOGLE_PLACES_API_KEY=AIza...
GOOGLE_PAGESPEED_API_KEY=AIza...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Cloudflare (get account ID, create API token with Wrangler scope)
CLOUDFLARE_ACCOUNT_ID=abc123
CLOUDFLARE_API_TOKEN=v1.0...
CLOUDFLARE_ZONE_ID=zone123  # For DNS if using custom domain
R2_BUCKET_NAME=outreach-engine

# Resend (Phase 2 — required for email sending)
RESEND_API_KEY=re_xxxx...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Worker API
WORKER_API_URL=https://api.yourdomain.com  # Production; localhost:8787 locally
```

---

## File Quick Reference

| File | Purpose |
|------|---------|
| `/supabase/migrations/` | Database schema + RLS |
| `/packages/types/` | TypeScript types + Zod schemas |
| `/packages/utils/scoring.ts` | Lead scoring algorithm |
| `/packages/utils/issue-detection.ts` | HTML + audit heuristics |
| `/workers/engine/src/index.ts` | Worker entry point, routes to handlers |
| `/workers/engine/src/handlers/discover.ts` | Places API discovery |
| `/workers/engine/src/handlers/audit.ts` | Full audit pipeline (PageSpeed, issues, screenshot) |
| `/workers/engine/src/handlers/generate.ts` | Demo generation (Phase 1) |
| `/workers/engine/src/handlers/draft.ts` | Email draft generation (Phase 2) |
| `/workers/engine/src/services/` | places.ts, pagespeed.ts, screenshot.ts, vision.ts, resend.ts |
| `/apps/dashboard/src/app/page.tsx` | Home, list runs |
| `/apps/dashboard/src/app/runs/new/page.tsx` | Kickoff form |
| `/apps/dashboard/src/app/runs/[runId]/page.tsx` | Worklist + modal |
| `/apps/dashboard/src/app/runs/[runId]/outreach/page.tsx` | Outreach queue (Phase 2) |
| `/apps/dashboard/src/app/api/draft/route.ts` | Draft generation endpoint (Phase 2) |
| `/apps/dashboard/src/app/api/outreach/route.ts` | Outreach CRUD (Phase 2) |
| `/apps/dashboard/src/app/api/send-email/route.ts` | Email sending endpoint (Phase 2) |
| `/apps/dashboard/src/lib/supabase.ts` | Client-side DB queries |
| `/apps/dashboard/src/app/actions.ts` | Server action: createRunAndDiscover |

---

## Documentation

- `/README.md` — Setup, architecture, Phase 0–3 overview
- `/PHASE_1.md` — Phase 1 (Demo Generation) detailed user guide
- `/PHASE_2.md` — Phase 2 (Outreach Queue) detailed user guide
- `/NEXT_STEPS.md` — This file; Phase 3+ roadmap
- `/.env.example` — Environment variables template

---

## Questions?

Refer to:
- Phase documentation above
- README for architecture overview
- PHASE_*.md files for detailed feature guides
- This file for roadmap and next priorities

Good luck! 🚀
