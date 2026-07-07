import { createClient } from "@supabase/supabase-js";
import type { Lead, Audit, Run } from "@outreach-engine/types";

export class SupabaseClient {
  private client: ReturnType<typeof createClient>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "outreach-engine-worker" } },
    });
  }

  async upsertLead(lead: Omit<Lead, "id" | "created_at" | "refreshed_at">) {
    const { data, error } = await this.client
      .from("leads")
      .upsert(lead, { onConflict: "place_id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert lead: ${error.message}`);
    }
    return data;
  }

  async upsertAudit(audit: Omit<Audit, "id" | "audited_at" | "updated_at">) {
    const { data, error } = await this.client
      .from("audits")
      .upsert(audit, { onConflict: "lead_id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert audit: ${error.message}`);
    }
    return data;
  }

  async updateLeadStatus(
    leadId: string,
    status: string,
    priority?: number
  ) {
    const update: any = { status };
    if (priority !== undefined) {
      update.priority = priority;
    }

    const { data, error } = await this.client
      .from("leads")
      .update(update)
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update lead status: ${error.message}`);
    }
    return data;
  }

  async getRun(runId: string): Promise<Run | null> {
    const { data, error } = await this.client
      .from("runs")
      .select()
      .eq("id", runId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      throw new Error(`Failed to get run: ${error.message}`);
    }
    return data || null;
  }

  async getLeadsForRun(runId: string): Promise<Lead[]> {
    const { data, error } = await this.client
      .from("leads")
      .select()
      .eq("run_id", runId);

    if (error) {
      throw new Error(`Failed to get leads for run: ${error.message}`);
    }
    return data || [];
  }

  async updateRunStatus(
    runId: string,
    status: string,
    metadata: { discovered_count?: number; audited_count?: number; error_message?: string } = {}
  ) {
    const update: any = { status };
    if (metadata.discovered_count !== undefined) {
      update.discovered_count = metadata.discovered_count;
    }
    if (metadata.audited_count !== undefined) {
      update.audited_count = metadata.audited_count;
    }
    if (metadata.error_message !== undefined) {
      update.error_message = metadata.error_message;
    }

    const { data, error } = await this.client
      .from("runs")
      .update(update)
      .eq("id", runId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update run status: ${error.message}`);
    }
    return data;
  }

  async incrementRunMetric(
    runId: string,
    metric: "discovered_count" | "audited_count",
    amount: number = 1
  ) {
    const { data, error } = await this.client.rpc("increment_run_metric", {
      run_id: runId,
      metric_name: metric,
      amount,
    });

    if (error) {
      throw new Error(`Failed to increment metric: ${error.message}`);
    }
    return data;
  }
}

export function createSupabaseClient(url: string, serviceRoleKey: string) {
  return new SupabaseClient(url, serviceRoleKey);
}
