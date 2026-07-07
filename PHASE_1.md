# Phase 1: Demo Generation — User Guide

## What's New

Phase 1 adds **automated demo site generation**. For each qualified business, the engine:

1. Creates a bespoke website using a hand-built template
2. Injects business-specific content (name, photo, services, testimonials)
3. Deploys to a live URL (`{slug}.demos.yourdomain.com`)
4. Shows the link in the dashboard for one-click preview

## Architecture

```
Qualified Lead (Phase 0)
        ↓
   [Generate Demo button]
        ↓
Worker: /generate-demo
  ├─ Fetch template HTML
  ├─ Download business photos → R2
  ├─ Sample brand color
  ├─ Call Claude: business data + template → JSON tokens
  ├─ Render template HTML with token values
  └─ Upload to R2 at demos/{slug}.html
        ↓
Demo Worker (wildcard route)
  → Fetch HTML from R2 → serve as website
        ↓
Dashboard: show "View live demo" link
```

## How to Use

### 1. Run Discovery (Phase 0)

```bash
npm run dev  # Dashboard on :3000
cd workers/engine && npm run dev  # Worker on :8787
```

1. Go to http://localhost:3000
2. Click "New Run"
3. Select niche (e.g., "thai_restaurant") + city (e.g., "Sydney")
4. Wait for leads to appear (30s–2min)

### 2. View Qualified Leads

Dashboard shows ranked worklist:
- Leads sorted by priority (revenue signal × badness score)
- Filtered to show only qualified (rating ≥ 4.4, review_count ≥ 50, has issue)
- Each row shows: name, rating, issue summary, priority score, status

Click any lead to see full audit details (screenshot, PageSpeed scores, etc.).

### 3. Generate Demo

For any **qualified** lead:

1. Click "Generate Demo" button in the worklist
   - Button appears only if status = "qualified"
2. Wait ~10–15 seconds for generation
   - Claude fills template tokens
   - Photos downloaded
   - HTML rendered
   - Uploaded to R2
3. Demo link appears in lead modal
4. Click "View live demo" → opens site in new tab

The generated site is **fully functional** and shareable:
- No hosting setup needed (served from R2 via Cloudflare Worker)
- Stable URL per business (won't expire)
- Shows business name, tagline, services, testimonials, hours, phone

### 4. Copy Demo URL for Outreach

Demo URL format: `https://slug-business-id.demos.yourdomain.com/`

Example: `https://pad-krapow-abc123.demos.example.com/`

Use this link in your outreach email. It's the **hot link** in the pitch:

> "I already built a concept for {{BUSINESS_NAME}} — see it live: {{DEMO_URL}}"

## Template System

### One Template Per Niche

Each niche has ONE beautifully designed HTML template (e.g., `templates/thai_restaurant/template.html`).

**Why one template?**
- Design quality is fixed at template level (no AI hallucination)
- Businesses feel bespoke (unique content injected)
- Costs less (no image generation, no layout generation)

### Creating a New Template

See `/templates/README.md` for detailed guide.

**Quick summary:**

1. Design responsive HTML in Claude Code or Figma
2. Add color variable `{{BRAND_HEX}}` for accent color
3. Replace static text with tokens:
   - `{{BUSINESS_NAME}}`
   - `{{HERO_TAGLINE}}`
   - `{{STORY}}`
   - `{{SERVICES_ITEMS}}` (rendered HTML)
   - `{{TESTIMONIALS_ITEMS}}` (rendered HTML)
   - `{{HOURS_ITEMS}}` (rendered HTML)
   - etc.
4. Save as `/templates/{niche}/template.html`
5. Add row to database:
   ```sql
   INSERT INTO templates (niche, direction, storage_key)
   VALUES ('thai_restaurant', 'warm, inviting, appetizing', 'templates/thai_restaurant.html');
   ```
6. Upload to R2: `aws s3 cp template.html s3://outreach-engine/templates/thai_restaurant.html`

Once a template exists for a niche, all businesses in that niche will use it.

### Content Token Reference

When Claude fills tokens, it receives business data + template direction:

**Input to Claude:**
```
Business: Baan Noodle Palace
Location: Sydney, NSW
Rating: 4.8 (125 reviews)
Niche: thai_restaurant
Template direction: "warm, inviting, appetizing; emphasize authenticity and craft"
```

**Claude returns JSON:**
```json
{
  "BUSINESS_NAME": "Baan Noodle Palace",
  "HERO_TAGLINE": "Authentic Bangkok noodles, hand-rolled daily",
  "STORY": "Opened in 2015 by Chef Somchai, trained in Bangkok for 20 years...",
  "SERVICES_JSON": [
    { "name": "Pad Thai", "description": "..." },
    { "name": "Som Tam", "description": "..." }
  ],
  "TESTIMONIALS_JSON": [
    { "text": "...", "author": "Sarah", "rating": 5 },
    ...
  ],
  "HOURS_JSON": [
    { "day": "Monday", "hours": "10am - 10pm" },
    ...
  ]
}
```

**Template renders these as HTML:**
```html
<h1>{{BUSINESS_NAME}}</h1>
<p>{{HERO_TAGLINE}}</p>
<p>{{STORY}}</p>
<div class="menu-grid">
  {{SERVICES_ITEMS}}  <!-- Rendered as <div>s -->
</div>
<div class="testimonials">
  {{TESTIMONIALS_ITEMS}}  <!-- Rendered as <div>s -->
</div>
```

**Rules Claude follows:**
- 3–4 services, specific to niche (not generic)
- 3–4 testimonials (5-star, mention specific dishes/experiences)
- Story is 50–80 words, sensory + specific
- No adjectives like "amazing", "awesome", "great"
- Testimonials sound like real customers

### Brand Color Sampling

The engine samples the brand color from business photos:

```typescript
const brandHex = await sampleBrandColor(photoUrls[0]);
// Returns hex string, e.g. "#D4502D" (Thai-inspired orange)
```

Fallback: `#D4502D` (warm, inviting color suitable for most local businesses).

The template uses `{{BRAND_HEX}}` to set:
- Hero section background gradient
- Section headers
- Button backgrounds
- Accent borders
- Link colors

This ensures each site's color reflects the business's visual identity.

## Demo URLs & Hosting

### URL Structure

```
{slug}.demos.{your_domain}/

Example: pad-krapow-abc123.demos.example.com
```

**Slug generation:**
- Business name (lowercase, alphanumeric)
- Hyphen
- First 10 chars of Google place_id
- Result: max 50 characters total

### Hosting (Cloudflare Worker)

Demo Worker at `/workers/demos/src/index.ts`:

```typescript
// Wildcard route: *.demos.example.com/*
// On request, parse slug from hostname
// Fetch demos/{slug}.html from R2
// Return HTML with caching headers
```

**How to set up:**

1. Point DNS: `demos.example.com` → Cloudflare nameservers
2. Create Cloudflare Worker route: `demos.example.com/*`
3. Deploy `/workers/demos`:
   ```bash
   cd workers/demos
   wrangler deploy
   ```
4. Test: `curl https://pad-krapow-abc123.demos.example.com/`

Once live, all demos auto-serve from R2 (no additional deploy needed per site).

## Performance & Cost

### Generation Time

Per business:
- Fetch template: <1s
- Call Claude (copy-fill): 3–5s
- Render HTML: <1s
- Upload to R2: <1s
- **Total: ~5–7 seconds**

For 100 qualified leads: ~10–15 minutes for batch generation.

### Cost Breakdown

Per business:
- **Claude API**: ~$0.01 (token-based, ~500 tokens for copy-fill call)
- **Google Photos API**: Free (included in Places API call cost)
- **R2 Storage**: $0.015/GB/month (negligible for ~100KB HTML files)
- **Cloudflare Worker**: Free tier (millions of requests/month)
- **Total: ~$0.01 per business, $10 for 1,000 businesses**

### R2 Storage

Each demo is ~50–100KB of HTML (photos are hotlinked from Google initially, can be cached later).

1,000 businesses = ~50–100 MB = **$0.01/month**.

## Troubleshooting

### Demo generation fails

**Error: "No template for niche"**
- Solution: Template not found for business's niche
- Check: Is niche in database? `SELECT * FROM templates WHERE niche = '...'`
- Fix: Add template for niche before generating demos

**Error: "Claude API timeout"**
- Solution: API call took >30s
- Check: ANTHROPIC_API_KEY valid? Network stable?
- Fix: Retry (handled automatically)

**Demo URL doesn't load**
- Check: Worker deployed? `cd workers/demos && wrangler deploy`
- Check: DNS pointing to Cloudflare?
- Check: R2 bucket accessible? Check wrangler.toml bindings
- Test: `curl -v https://slug.demos.yourdomain/` (check response headers)

### Generated site looks ugly

- **Issue**: Template design doesn't match business
- **Solution**: Design is custom per niche. If template is poor, redesign it in Claude Code / Figma
- **Note**: All businesses in a niche share the same template, so quality reflects on all of them

- **Issue**: Content filled poorly (typos, bad copy)
- **Solution**: Claude is following template + direction. Improve template's "direction" text in database

### Demo outdated

- **Issue**: Site shows old business info (phone, hours changed)
- **Solution**: Refreshable snapshots. Audit is only done once per run. For updates:
  - Create new run
  - Re-audit business (fetches latest Google Places data)
  - Generate new demo

## Next Steps → Phase 2

Phase 2 adds **outreach queue**:

- ✅ Demo generated  
- → Draft email (Phase 2): "I redesigned your site — see the live preview {{DEMO_URL}}"
- → Review queue: approve / edit / send (manual)
- → Resend integration: send 1 email at a time
- → Follow-up auto-draft at +3 days

Templates directory structure will include draft text templates per niche.

## API Reference

### POST `/generate-demo` (Worker)

```bash
curl -X POST http://localhost:8787/generate-demo \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "uuid",
    "run_id": "uuid"
  }'
```

**Response (201):**
```json
{
  "status": "success",
  "demoUrl": "https://slug.demos.example.com/",
  "message": "Demo generated for {{BUSINESS_NAME}}"
}
```

**Response (400/500):**
```json
{
  "status": "error",
  "message": "No template for niche: {{niche}}"
}
```

### GET `{slug}.demos.example.com/` (Demo Worker)

Fetches HTML from R2 and serves it.

**Headers:**
- `Content-Type: text/html; charset=utf-8`
- `Cache-Control: public, max-age=31536000` (1 year)
- `X-Robots-Tag: noindex` (prevent search indexing)

---

**Questions?** Check `/templates/README.md` for template authoring guide, or `/NEXT_STEPS.md` for Phase 2 roadmap.
