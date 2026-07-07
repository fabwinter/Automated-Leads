import { createClient } from "@supabase/supabase-js";
import type { Lead, Audit, Run } from "@outreach-engine/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true },
});

/**
 * Fetch a run by ID (client-side, uses RLS).
 */
export async function fetchRun(runId: string): Promise<Run | null> {
  const { data, error } = await supabase
    .from("runs")
    .select()
    .eq("id", runId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch run: ${error.message}`);
  }
  return data || null;
}

/**
 * Fetch all runs for the authenticated user.
 */
export async function fetchUserRuns(): Promise<Run[]> {
  const { data, error } = await supabase
    .from("runs")
    .select()
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch runs: ${error.message}`);
  }
  return data || [];
}

/**
 * Create a new run.
 */
export async function createRun(
  niche: string,
  city: string,
  config: any = {}
): Promise<Run> {
  const { data, error } = await supabase
    .from("runs")
    .insert({
      niche,
      city,
      config: {
        vision_audit: false,
        ssl_check: true,
        seo_basics: true,
        social_only_check: true,
        ...config,
      },
      status: "running",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create run: ${error.message}`);
  }
  return data;
}

/**
 * Fetch leads for a run.
 */
export async function fetchLeadsForRun(
  runId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Lead[]> {
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("leads")
    .select()
    .eq("run_id", runId)
    .order("priority", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch leads: ${error.message}`);
  }
  return data || [];
}

/**
 * Fetch a single lead by ID.
 */
export async function fetchLead(leadId: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select()
    .eq("id", leadId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch lead: ${error.message}`);
  }
  return data || null;
}

/**
 * Fetch audits for specific leads.
 */
export async function fetchAuditsForLeads(
  leadIds: string[]
): Promise<Map<string, Audit>> {
  if (leadIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("audits")
    .select()
    .in("lead_id", leadIds);

  if (error) {
    throw new Error(`Failed to fetch audits: ${error.message}`);
  }

  const map = new Map<string, Audit>();
  for (const audit of data || []) {
    map.set(audit.lead_id, audit);
  }
  return map;
}

/**
 * Fetch audit for a single lead.
 */
export async function fetchAuditForLead(leadId: string): Promise<Audit | null> {
  const { data, error } = await supabase
    .from("audits")
    .select()
    .eq("lead_id", leadId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch audit: ${error.message}`);
  }
  return data || null;
}

/**
 * Subscribe to real-time updates for leads in a run.
 */
export function subscribeToRunLeads(
  runId: string,
  callback: (payload: any) => void
) {
  return supabase
    .from(`leads:run_id=eq.${runId}`)
    .on("*", callback)
    .subscribe();
}
