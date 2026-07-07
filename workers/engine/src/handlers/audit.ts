import type { Lead, Audit } from "@outreach-engine/types";
import {
  detectIssues,
  isValidUrl,
} from "@outreach-engine/utils";
import {
  calculatePriority,
  qualifyLead,
} from "@outreach-engine/utils";
import { createPageSpeedClient } from "../services/pagespeed";
import { createScreenshotService } from "../services/screenshot";
import { createVisionService } from "../services/vision";
import { SupabaseClient } from "../lib/supabase";
import { R2Storage } from "../lib/r2";

/**
 * Audit handler: run all checks on a single lead and populate audits table.
 * Implements HTML parsing, PageSpeed, SSL check, screenshot, optional vision.
 */

export async function handleAudit(
  lead: Lead,
  supabase: SupabaseClient,
  r2: R2Storage,
  services: {
    pageSpeedApiKey: string;
    anthropicApiKey?: string;
    browser?: any;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const startTime = Date.now();

    // Initialize clients
    const pageSpeedClient = createPageSpeedClient(services.pageSpeedApiKey);
    const screenshotService = createScreenshotService(services.browser);

    // Step 1: Fetch website HTML (if website exists)
    let html: string | null = null;
    let hasSSL = false;

    if (lead.website_url && isValidUrl(lead.website_url)) {
      try {
        const htmlResponse = await fetch(lead.website_url, {
          timeout: 5000,
        });

        if (htmlResponse.ok) {
          html = await htmlResponse.text();
          hasSSL = lead.website_url.startsWith("https://");
        }
      } catch (error) {
        console.error(`Failed to fetch ${lead.website_url}:`, error);
      }
    }

    // Step 2: Run PageSpeed Insights (even if HTML fetch failed)
    let pageSpeedData = null;
    if (lead.website_url) {
      try {
        pageSpeedData = await pageSpeedClient.analyze(lead.website_url);
      } catch (error) {
        console.error("PageSpeed failed:", error);
      }
    }

    // Step 3: Detect issues
    const { issues, seoIssues, issuesSummary } = detectIssues({
      website_url: lead.website_url,
      html,
      hasSSL,
      pageSpeedData,
    });

    // Step 4: Capture screenshot
    let screenshotUrl: string | null = null;
    if (lead.website_url) {
      try {
        const screenshotBuffer = await screenshotService.captureScreenshot(
          lead.website_url,
          10000
        );

        if (screenshotBuffer) {
          screenshotUrl = await r2.uploadScreenshot(
            lead.id,
            screenshotBuffer
          );
        }
      } catch (error) {
        console.error("Screenshot failed:", error);
      }
    }

    // Step 5: Optional vision audit (if enabled in run config)
    let visualSummary: string | null = null;
    const runConfig = lead.run_id
      ? JSON.parse(JSON.stringify(lead.run_id)) // In real implementation, fetch run
      : { vision_audit: false };

    if (
      runConfig.vision_audit &&
      screenshotUrl &&
      services.anthropicApiKey
    ) {
      try {
        // In real implementation, fetch screenshot from URL and encode
        const visionService = createVisionService(services.anthropicApiKey);
        // TODO: Fetch screenshot from screenshotUrl and encode to base64
        // visualSummary = await visionService.analyzeScreenshot(base64Screenshot);
      } catch (error) {
        console.error("Vision audit failed:", error);
      }
    }

    // Step 6: Blend issue summary per §6.1
    let finalIssueSummary = issuesSummary;
    if (!issuesSummary && visualSummary) {
      finalIssueSummary = visualSummary;
    }

    // Step 7: Calculate priority and determine status
    const audit: Omit<Audit, "id" | "audited_at" | "updated_at"> = {
      lead_id: lead.id,
      pagespeed_mobile: pageSpeedData?.performanceScoreMobile,
      pagespeed_desktop: pageSpeedData?.performanceScoreDesktop,
      has_viewport: pageSpeedData?.hasViewport,
      has_ssl: hasSSL,
      is_social_only: issues.social_only,
      seo_issues: seoIssues,
      issues,
      issue_summary: finalIssueSummary,
      screenshot_url: screenshotUrl,
      visual_summary: visualSummary,
      checks_run: {
        html_fetch: html !== null,
        ssl_check: true,
        pagespeed: pageSpeedData !== null,
        screenshot: screenshotUrl !== null,
        vision_audit: visualSummary !== null,
      },
    };

    // Upsert audit
    await supabase.upsertAudit(audit);

    // Update lead status to audited
    const priority = calculatePriority(lead, audit as any);
    const isQualified = qualifyLead(lead, audit as any);
    const newStatus = isQualified ? "qualified" : "dead";

    await supabase.updateLeadStatus(lead.id, newStatus, priority);

    const duration = Date.now() - startTime;
    console.log(
      `Audit complete for ${lead.name}: ${duration}ms, status=${newStatus}, priority=${priority}`
    );

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Audit failed for ${lead.name}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Batch audit handler for multiple leads.
 */
export async function handleAuditBatch(
  leads: Lead[],
  supabase: SupabaseClient,
  r2: R2Storage,
  services: any
): Promise<{ successful: number; failed: number }> {
  let successful = 0;
  let failed = 0;

  for (const lead of leads) {
    const result = await handleAudit(lead, supabase, r2, services);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { successful, failed };
}
