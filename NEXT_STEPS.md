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

## Phase 2: Outreach Queue (Week 3)

### 1. Outreach Table (already in schema)

### 2. Implement Draft Generator (`/workers/engine/src/handlers/draft.ts`)

```typescript
// Input: lead + audit + demo_url
// 1. Compose subject: "made this for {{BUSINESS_NAME}}"
// 2. Compose body from template (issue_summary + price)
// 3. Upsert outreach row with status='draft'
// 4. Include sender ID + unsubscribe link
```

### 3. Dashboard Outreach Queue

- `/apps/dashboard/src/app/runs/[runId]/outreach/page.tsx`
- Table: draft emails, approve/edit, send button
- Send: integrate Resend API
- Track: sent_at timestamp, reply_body field

### 4. Follow-Up Cron

- `/workers/engine/src/handlers/cron.ts`
- Nightly: select sent leads from 3 days ago with no reply
- Auto-draft follow-up (status='draft', new record)

---

## Phase 3: Orchestration & Scale (Week 4)

### 1. Cloudflare Workflow

- Wrap Phases 0–2 in one durable workflow
- Steps: discover → fan-out enrich/audit → score → generate → deploy → draft

### 2. Queues

- Use Cloudflare Queues for fan-out (1 city → N leads → N audits)
- Batch audit processing with concurrency control

### 3. Nightly Cron

- Trigger workflow via scheduled Cron
- Re-audit old leads (staleness check)
- Auto-draft follow-ups

### 4. Video Capture (Optional)

- Browser Rendering scroll → MP4 via ffmpeg

---

## Critical Known Gaps (Fill Before Scale)

1. **Email enrichment** (Places API doesn't return email)
   - Scrape website contact page
   - Optional: paid Hunter/Apollo API

2. **Phone number formatting**
   - Validate international numbers
   - Format for outreach region

3. **Screenshot timeout handling**
   - What if site takes 30s to load?
   - Fallback to placeholder?

4. **Rate limiting**
   - Google Places: generous free tier but batch carefully
   - PageSpeed: free tier ok, but queue with backoff
   - Anthropic: ~3M tokens/month on free tier

5. **Template authoring UX**
   - Currently: edit HTML manually + upload to R2
   - Future: visual builder or Figma plugin?

6. **A/B Testing**
   - Subject line variants
   - Demo link timing

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

# Clerk (create app, get keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

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
| `/workers/engine/src/index.ts` | Worker entry point, POST /discover |
| `/workers/engine/src/handlers/` | discover.ts, audit.ts, (draft.ts — Phase 2) |
| `/workers/engine/src/services/` | places.ts, pagespeed.ts, screenshot.ts, vision.ts |
| `/apps/dashboard/src/app/page.tsx` | Home, list runs |
| `/apps/dashboard/src/app/runs/new/page.tsx` | Kickoff form |
| `/apps/dashboard/src/app/runs/[runId]/page.tsx` | Worklist + modal |
| `/apps/dashboard/src/lib/supabase.ts` | Client-side DB queries |
| `/apps/dashboard/src/app/actions.ts` | Server action: createRunAndDiscover |

---

## Questions?

Refer to:
- `/README.md` — Setup & architecture
- `/handoff.md` (original spec) — Design decisions & constraints
- Plan agent's detailed breakdown (context)

Good luck! 🚀
