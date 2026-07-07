import type { Run, Lead } from "@outreach-engine/types";
import { createPlacesClient } from "../services/places";
import { SupabaseClient } from "../lib/supabase";

/**
 * Discovery handler: fetch businesses from Places API and upsert into leads table.
 * Implements pagination and handles rate limiting.
 */

export async function handleDiscover(
  run: Run,
  supabase: SupabaseClient,
  placesApiKey: string
): Promise<{ discovered: number; error?: string }> {
  try {
    const placesClient = createPlacesClient(placesApiKey);
    const { niche, city, config } = run;

    // Construct search query
    const query = `${niche} in ${city}`;

    let pageToken: string | undefined;
    let discovered = 0;
    const maxPages = 5; // Limit pagination to prevent runaway costs
    let pageCount = 0;

    // Paginate through Places API results
    while (pageCount < maxPages) {
      try {
        const response = await placesClient.searchText(query, pageToken);

        for (const place of response.places) {
          const lead: Omit<Lead, "id" | "created_at" | "refreshed_at"> = {
            run_id: run.id,
            place_id: place.id,
            name: place.displayName,
            niche: niche,
            city: city,
            rating: place.rating,
            review_count: place.userRatingCount || 0,
            website_url: place.websiteUri || null,
            phone: place.nationalPhoneNumber || null,
            email: null, // Will be scraped during audit
            instagram: null, // Will be scraped during audit
            photo_refs: place.photos || [],
            status: "discovered",
            priority: 0, // Will be set during scoring
          };

          await supabase.upsertLead(lead);
          discovered++;
        }

        // Check for next page
        if (!response.nextPageToken) {
          break;
        }
        pageToken = response.nextPageToken;
        pageCount++;

        // Rate limiting: small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error fetching page ${pageCount}:`, error);
        break;
      }
    }

    // Update run with discovered count
    await supabase.updateRunStatus(run.id, "running", {
      discovered_count: discovered,
    });

    return { discovered };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Discovery handler error:", errorMsg);

    // Update run with error
    await supabase.updateRunStatus(run.id, "failed", {
      error_message: errorMsg,
    });

    return { discovered: 0, error: errorMsg };
  }
}

/**
 * Dispatch audit for all discovered leads in a run.
 * Typically queued for async processing.
 */
export async function dispatchAudits(
  runId: string,
  supabase: SupabaseClient
): Promise<number> {
  const leads = await supabase.getLeadsForRun(runId);
  // TODO: Queue each lead for audit processing
  // For Phase 0, this can be synchronous; Phase 3 will add async queuing
  return leads.length;
}
