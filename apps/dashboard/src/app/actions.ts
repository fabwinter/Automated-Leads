"use server";

import { createClient } from "@supabase/supabase-js";
import type { CreateRunRequest } from "@outreach-engine/types";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const workerUrl = process.env.WORKER_API_URL || "http://localhost:8787";

/**
 * Server action: Create a run and kick off discovery.
 */
export async function createRunAndDiscover(input: CreateRunRequest) {
  const userId = "personal-project"; // Single user for personal project

  try {
    // Create Supabase client with service role for server-side operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Insert run record
    const { data: run, error: runError } = await supabase
      .from("runs")
      .insert({
        user_id: userId,
        niche: input.niche,
        city: input.city,
        config: {
          vision_audit: input.config?.vision_audit || false,
          ssl_check: input.config?.ssl_check !== false,
          seo_basics: input.config?.seo_basics !== false,
          social_only_check: input.config?.social_only_check !== false,
        },
        status: "running",
      })
      .select()
      .single();

    if (runError || !run) {
      return { error: `Failed to create run: ${runError?.message}` };
    }

    // Kick off discovery via worker
    try {
      const discoverResponse = await fetch(`${workerUrl}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: run.id,
          niche: input.niche,
          city: input.city,
        }),
      });

      if (!discoverResponse.ok) {
        console.error(
          "Worker discovery response:",
          await discoverResponse.text()
        );
        // Still return success; discovery may be processing async
      }
    } catch (workerError) {
      console.error("Failed to call worker:", workerError);
      // Don't fail the run creation; worker will be retried
    }

    return { success: true, runId: run.id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
