-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgvector";

-- runs: one row per "kick off a run" from the dashboard
create table if not exists runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,  -- Clerk user_id for multi-tenant access
  niche         text not null,
  city          text not null,
  config        jsonb not null default '{
    "vision_audit": false,
    "ssl_check": true,
    "seo_basics": true,
    "social_only_check": true
  }',
  status        text default 'running',  -- running|completed|failed
  discovered_count int default 0,
  audited_count int default 0,
  error_message text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  constraint niche_not_empty check (niche != ''),
  constraint city_not_empty check (city != '')
);

-- leads: one row per discovered business
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references runs(id) on delete cascade,
  place_id      text unique not null,  -- cacheable long-term, Google's ID
  name          text not null,
  niche         text not null,
  city          text not null,
  rating        numeric(3,2),
  review_count  int default 0,
  website_url   text,  -- null = strongest signal (no website)
  phone         text,
  email         text,  -- best-effort
  instagram     text,
  photo_refs    jsonb default '[]'::jsonb,  -- Google photo resource names
  status        text default 'discovered',  -- discovered|audited|qualified|demo_ready|drafted|sent|replied|dead
  priority      numeric(10,4) default 0,  -- composite score, updated during scoring
  discovered_at timestamptz default now(),
  refreshed_at  timestamptz default now(),

  constraint website_phone_or_contact check (website_url is not null or phone is not null or email is not null or instagram is not null)
);

-- audits: the diagnosis. issue_summary is the headline
create table if not exists audits (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null unique references leads(id) on delete cascade,
  pagespeed_mobile  int,  -- 0-100
  pagespeed_desktop int,  -- 0-100
  has_viewport      boolean,
  has_ssl           boolean,
  is_social_only    boolean,
  seo_issues        jsonb default '[]'::jsonb,  -- array of { field: string, issue: string }
  issues            jsonb default '{}'::jsonb,  -- structured flags: { no_site, broken, no_ssl, social_only, not_mobile, slow, no_contact, pdf_menu, dated, seo_issues_present }
  issue_summary     text,  -- ONE owner-facing line, technical
  screenshot_url    text,  -- R2 URL of current site
  visual_summary    text,  -- nullable — only set if vision pass ran
  checks_run        jsonb default '{
    "html_fetch": true,
    "ssl_check": true,
    "pagespeed": true,
    "screenshot": true,
    "vision_audit": false
  }'::jsonb,
  audited_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- templates: hand-built, one per niche (Phase 1)
create table if not exists templates (
  id               uuid primary key default gen_random_uuid(),
  niche            text unique not null,
  direction        text,  -- the vibe, for the copy prompt
  storage_key      text,  -- R2 key of the template HTML
  reference_images jsonb default '[]'::jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- demos: generated per business (Phase 1)
create table if not exists demos (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null unique references leads(id) on delete cascade,
  template_id  uuid references templates(id),
  slug         text unique,  -- {slug}.demos.<domain>
  storage_key  text,  -- R2 key of generated HTML
  deploy_url   text,
  video_url    text,  -- Phase 3, nullable
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- outreach: human-in-the-loop send queue (Phase 2)
create table if not exists outreach (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null unique references leads(id) on delete cascade,
  channel      text default 'email',  -- 'email' | 'instagram'
  subject      text,
  body         text,
  status       text default 'draft',  -- draft|approved|sent|replied|bounced
  sent_at      timestamptz,
  follow_up_at timestamptz,  -- +3 days, triggers a NEW draft
  reply_body   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Create indexes for performance
create index if not exists idx_runs_user_id on runs(user_id);
create index if not exists idx_runs_created_at on runs(created_at desc);

create index if not exists idx_leads_run_id on leads(run_id);
create index if not exists idx_leads_place_id on leads(place_id);
create index if not exists idx_leads_status_priority on leads(status, priority desc);
create index if not exists idx_leads_niche_city on leads(niche, city);

create index if not exists idx_audits_lead_id on audits(lead_id);
create index if not exists idx_audits_created_at on audits(audited_at desc);

create index if not exists idx_demos_lead_id on demos(lead_id);
create index if not exists idx_demos_slug on demos(slug);

create index if not exists idx_outreach_lead_id on outreach(lead_id);
create index if not exists idx_outreach_status on outreach(status);
create index if not exists idx_outreach_sent_at on outreach(sent_at desc);

-- Add updated_at trigger for runs table
create or replace function update_runs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger runs_updated_at before update on runs
  for each row execute function update_runs_updated_at();

-- Add updated_at trigger for leads table
create or replace function update_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at before update on leads
  for each row execute function update_leads_updated_at();

-- Add updated_at trigger for audits table
create or replace function update_audits_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger audits_updated_at before update on audits
  for each row execute function update_audits_updated_at();
