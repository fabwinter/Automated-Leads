-- Enable RLS on all tables
alter table runs enable row level security;
alter table leads enable row level security;
alter table audits enable row level security;
alter table templates enable row level security;
alter table demos enable row level security;
alter table outreach enable row level security;

-- runs: users can only see their own runs
create policy "Users can read their own runs" on runs
  for select using (auth.uid()::text = user_id);

create policy "Users can create runs" on runs
  for insert with check (auth.uid()::text = user_id);

create policy "Users can update their own runs" on runs
  for update using (auth.uid()::text = user_id);

-- leads: users can read leads from their runs
create policy "Users can read leads from their runs" on leads
  for select using (
    exists (
      select 1 from runs where runs.id = leads.run_id and runs.user_id = auth.uid()::text
    )
  );

create policy "Service role can insert leads" on leads
  for insert with check (true);

create policy "Service role can update leads" on leads
  for update with check (true);

-- audits: users can read audits from their leads
create policy "Users can read audits from their leads" on audits
  for select using (
    exists (
      select 1 from leads
      join runs on leads.run_id = runs.id
      where leads.id = audits.lead_id and runs.user_id = auth.uid()::text
    )
  );

create policy "Service role can insert audits" on audits
  for insert with check (true);

create policy "Service role can update audits" on audits
  for update with check (true);

-- templates: everyone can read templates
create policy "Anyone can read templates" on templates
  for select using (true);

-- demos: users can read demos from their leads
create policy "Users can read demos from their leads" on demos
  for select using (
    exists (
      select 1 from leads
      join runs on leads.run_id = runs.id
      where leads.id = demos.lead_id and runs.user_id = auth.uid()::text
    )
  );

create policy "Service role can insert demos" on demos
  for insert with check (true);

create policy "Service role can update demos" on demos
  for update with check (true);

-- outreach: users can read outreach from their leads
create policy "Users can read outreach from their leads" on outreach
  for select using (
    exists (
      select 1 from leads
      join runs on leads.run_id = runs.id
      where leads.id = outreach.lead_id and runs.user_id = auth.uid()::text
    )
  );

create policy "Users can update their own outreach" on outreach
  for update using (
    exists (
      select 1 from leads
      join runs on leads.run_id = runs.id
      where leads.id = outreach.lead_id and runs.user_id = auth.uid()::text
    )
  );

create policy "Service role can insert outreach" on outreach
  for insert with check (true);
