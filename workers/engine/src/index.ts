import type { DiscoverRequest, DiscoverResponse } from "@outreach-engine/types";
import { validateEnv } from "./lib/env";
import { createSupabaseClient } from "./lib/supabase";
import { createR2Storage } from "./lib/r2";
import { handleDiscover } from "./handlers/discover";
import { handleGenerateDemo } from "./handlers/generate";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_PLACES_API_KEY: string;
  GOOGLE_PAGESPEED_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2: R2Bucket;
  BROWSER?: any;
}

/**
 * Cloudflare Worker entry point.
 * Routes POST /discover endpoint for kicking off discovery + audit workflows.
 */

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Only handle POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);

    // Route: POST /discover
    if (url.pathname === "/discover") {
      return await handleDiscoverEndpoint(request, env);
    }

    // Route: POST /generate-demo (Phase 1)
    if (url.pathname === "/generate-demo") {
      return await handleGenerateDemoEndpoint(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * Handle POST /discover request.
 * Request body: { run_id, niche, city }
 * Kicks off discovery via Places API.
 */
async function handleDiscoverEndpoint(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Validate environment variables
    const validatedEnv = validateEnv(env);

    // Parse request body
    const body = (await request.json()) as DiscoverRequest;

    if (!body.run_id || !body.niche || !body.city) {
      return new Response(
        JSON.stringify({ status: "error", message: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize clients
    const supabase = createSupabaseClient(
      validatedEnv.SUPABASE_URL,
      validatedEnv.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch run to get full config
    const run = await supabase.getRun(body.run_id);
    if (!run) {
      return new Response(
        JSON.stringify({ status: "error", message: "Run not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Execute discovery (synchronous for MVP)
    const result = await handleDiscover(
      run,
      supabase,
      validatedEnv.GOOGLE_PLACES_API_KEY
    );

    if (result.error) {
      const response: DiscoverResponse = {
        status: "error",
        run_id: body.run_id,
        message: result.error,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Success response
    const response: DiscoverResponse = {
      status: "queued",
      run_id: body.run_id,
      message: `Discovery started for ${body.niche} in ${body.city}. Found ${result.discovered} businesses.`,
    };

    return new Response(JSON.stringify(response), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Discovery endpoint error:", errorMsg);

    return new Response(
      JSON.stringify({
        status: "error",
        message: errorMsg,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle POST /generate-demo request (Phase 1).
 * Request body: { lead_id, run_id }
 * Generates demo site from template.
 */
async function handleGenerateDemoEndpoint(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const validatedEnv = validateEnv(env);
    const body = (await request.json()) as { lead_id: string; run_id: string };

    if (!body.lead_id || !body.run_id) {
      return new Response(
        JSON.stringify({ status: "error", message: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createSupabaseClient(
      validatedEnv.SUPABASE_URL,
      validatedEnv.SUPABASE_SERVICE_ROLE_KEY
    );
    const r2 = createR2Storage(env.R2, validatedEnv.CLOUDFLARE_ACCOUNT_ID);

    // Fetch lead + audit + template
    const { data: lead, error: leadError } = await supabase.client
      .from("leads")
      .select()
      .eq("id", body.lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ status: "error", message: "Lead not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: audit } = await supabase.client
      .from("audits")
      .select()
      .eq("lead_id", body.lead_id)
      .single();

    const { data: template } = await supabase.client
      .from("templates")
      .select()
      .eq("niche", lead.niche)
      .single();

    if (!template) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `No template for niche: ${lead.niche}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate demo
    const result = await handleGenerateDemo(lead, audit, template, supabase, r2, {
      anthropicApiKey: validatedEnv.ANTHROPIC_API_KEY,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ status: "error", message: result.error }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        demoUrl: result.demoUrl,
        message: `Demo generated for ${lead.name}`,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Generate demo error:", errorMsg);

    return new Response(
      JSON.stringify({ status: "error", message: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
