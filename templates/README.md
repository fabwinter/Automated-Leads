# Templates — Hand-Built Website Designs

Each niche has ONE beautifully designed template. The engine injects each business's content (name, photos, reviews, etc.) into the fixed template, guaranteeing design quality while feeling bespoke.

## Template Structure

```
/templates/
├── thai_restaurant/
│   └── template.html          (Main template file)
├── dentist/
│   └── template.html
└── ...
```

## Creating a New Template

### 1. Design Phase (In Claude Code / Figma)

- Design **ONE** responsive HTML template
- Use color variable `{{BRAND_HEX}}` for the primary accent color
- Use image placeholder `{{HERO_IMAGE}}` for hero background
- Ensure mobile-friendly (test at 375px, 768px, 1200px)
- Design for ~4-6 services/menu items (flexible grid)
- Include testimonials section (3-4 cards)
- Add hours/location section
- Header with business name, tagline, CTA

### 2. Tokenize the Template

Replace static content with tokens. Available tokens:

```html
<!-- Business Info -->
{{BUSINESS_NAME}}        Business name from Google Places
{{HERO_TAGLINE}}         Short punchy tagline (10 words max)
{{STORY}}                1-2 paragraph origin/mission
{{ADDRESS}}              Street + city
{{PHONE}}                Formatted phone (02) 1234 5678
{{INSTAGRAM_HANDLE}}     Instagram handle (no @)

<!-- Design -->
{{BRAND_HEX}}            Primary color, e.g. #D4502D
{{HERO_IMAGE}}           Hero background image URL

<!-- Dynamic Content (rendered as HTML) -->
{{SERVICES_ITEMS}}       <div> blocks for each service
{{TESTIMONIALS_ITEMS}}   <div> blocks for each testimonial
{{HOURS_ITEMS}}          <div> blocks for each day

<!-- Metadata -->
{{CURRENT_YEAR}}         Current year (2024, 2025, etc)
```

### 3. Add Template to Database

```sql
INSERT INTO templates (niche, direction, storage_key, reference_images)
VALUES (
  'thai_restaurant',
  'warm, inviting, appetizing; emphasize authenticity and craft',
  'templates/thai_restaurant.html',
  '["ref1", "ref2"]'
);
```

Then upload to R2:
```bash
aws s3 cp template.html s3://outreach-engine/templates/thai_restaurant.html --acl public-read
```

Or use the dashboard (Phase 2).

### 4. Example Template Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{BUSINESS_NAME}}</title>
  <style>
    :root { --brand: {{BRAND_HEX}}; }
    /* CSS for your niche */
  </style>
</head>
<body>
  <header>
    <h1>{{BUSINESS_NAME}}</h1>
    <p>{{HERO_TAGLINE}}</p>
  </header>

  <section class="about">
    <h2>Our Story</h2>
    <p>{{STORY}}</p>
  </section>

  <section class="menu">
    <h2>Menu</h2>
    <div class="menu-grid">
      {{SERVICES_ITEMS}}
    </div>
  </section>

  <section class="testimonials">
    <h2>Reviews</h2>
    {{TESTIMONIALS_ITEMS}}
  </section>

  <section class="hours">
    <h2>Hours</h2>
    <div>{{HOURS_ITEMS}}</div>
  </section>

  <footer>
    <p>{{ADDRESS}}</p>
    <p>{{PHONE}}</p>
    <a href="https://instagram.com/{{INSTAGRAM_HANDLE}}">Instagram</a>
  </footer>
</body>
</html>
```

## Niches & Niche Naming

Use snake_case for niche names (used as directory names and in database):

- `thai_restaurant`
- `dentist`
- `electrician`
- `hair_salon`
- `pizza_restaurant`
- `coffee_shop`
- `laundry`
- `plumber`
- `automotive_repair`
- `personal_trainer`
- `optometrist`
- `yoga_studio`
- `gym`
- `accountant`
- `photographer`

Add more as needed. One template per niche.

## Design Guidelines

### Color Palette
- **Primary (brand): {{BRAND_HEX}}** — Main accent, sampled from business photos
- **Background**: White or very light gray
- **Text**: Dark gray (#333) or near-black
- **Accent**: Lighter shade of primary for hover states

### Typography
- **Headlines**: System font (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- **Body**: Same sans-serif
- **Font sizes**: 
  - Hero h1: 2.5rem–3.5rem (mobile: 1.8rem–2rem)
  - Section h2: 2rem–2.5rem
  - Body: 1rem–1.1rem

### Spacing
- **Hero**: 400–500px tall, centered content, 2–4rem padding
- **Section padding**: 3–4rem top/bottom, 2rem left/right on mobile
- **Gaps**: 1.5–2rem between grid items
- **Line height**: 1.6–1.8

### Components
- **Buttons**: 12px padding h, 24px padding v, border-radius 4–6px
- **Cards**: Subtle shadow (0 2px 8px rgba(0,0,0,0.1)) or border
- **Forms**: Full width on mobile, max-width on desktop

### Responsiveness
```css
@media (max-width: 768px) {
  /* Stack grids to single column */
  /* Reduce font sizes by ~20% */
  /* Reduce padding by ~40% */
}
```

## Content Generation

When a demo is generated, Claude fills tokens with:

1. **Services/Menu**: 3–4 items, specific to the niche
   - Each: name + 15–25 word description
   - E.g., "Pad Thai — Hand-rolled noodles with tamarind, lime, and crispy peanuts"

2. **Testimonials**: 3–4 5-star reviews
   - 20–40 words each
   - Include specific details (dish name, experience)
   - Sound like real customers

3. **Story**: 1–2 paragraphs (50–80 words)
   - Origin, mission, or philosophy
   - Sensory details matter

4. **Hours**: Standard 7-day format
   - E.g., "Monday 10am–10pm" (defaults if not known)

## Tips

- **Design for 90%**, not perfection. The template is the base; businesses add personality via content.
- **Avoid clichés**: No stock photos in the template (use {{HERO_IMAGE}} placeholder instead). No "world-class", "award-winning" generic language in the template copy.
- **Mobile first**: Test the template at 375px viewport width.
- **A/B ready**: Consider how headlines, CTAs, and colors will adapt when Claude fills in copy.
- **Load times**: Keep CSS inline (no external stylesheets for delivery speed). Images will be injected later.

## Uploading a Template

1. Design & save as `template.html`
2. Upload to R2 bucket at `templates/{niche}.html`
3. Add row to `templates` table with niche name + storage_key
4. Dashboard will auto-discover on next run

Example:
```sql
INSERT INTO templates (niche, direction, storage_key)
VALUES ('thai_restaurant', 'warm, inviting, appetizing', 'templates/thai_restaurant.html');
```

Done! Now when you discover businesses in niche `thai_restaurant`, the engine will generate demos from this template.
