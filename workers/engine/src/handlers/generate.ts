import type { Lead, Audit, Template } from "@outreach-engine/types";
import { createCopyFillService } from "../services/copyfill";
import { SupabaseClient } from "../lib/supabase";
import { R2Storage } from "../lib/r2";

/**
 * Demo generation handler: create a bespoke site for a business.
 * Flow:
 * 1. Download photos from Places API
 * 2. Sample brand color from first photo
 * 3. Fetch template HTML
 * 4. Call Claude to fill tokens with copy
 * 5. String-replace tokens into HTML
 * 6. Upload to R2
 * 7. Upsert demos table
 */

export async function handleGenerateDemo(
  lead: Lead,
  audit: Audit,
  template: Template,
  supabase: SupabaseClient,
  r2: R2Storage,
  services: {
    anthropicApiKey: string;
  }
): Promise<{ success: boolean; demoUrl?: string; error?: string }> {
  try {
    // Step 1: Fetch template HTML from R2
    if (!template.storage_key) {
      return { success: false, error: "Template not found" };
    }

    const templateHtml = await r2.download(template.storage_key);
    if (!templateHtml) {
      return { success: false, error: "Template HTML not found in R2" };
    }

    const templateText = new TextDecoder().decode(templateHtml);

    // Step 2: Download business photos (if available)
    const photoUrls = await downloadBusinessPhotos(lead, r2);

    // Step 3: Sample brand color from first photo or use fallback
    const brandHex = await sampleBrandColor(photoUrls[0] || null);

    // Step 4: Generate copy via Claude
    const copyFillService = createCopyFillService(
      services.anthropicApiKey,
      template.direction || ""
    );

    const copyData = await copyFillService.generateCopy(
      lead,
      audit,
      photoUrls,
      brandHex
    );

    // Step 5: Render template with tokens
    const heroImage = photoUrls[0] || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";

    let html = templateText
      .replace(/{{BUSINESS_NAME}}/g, copyData.BUSINESS_NAME)
      .replace(/{{HERO_TAGLINE}}/g, copyData.HERO_TAGLINE)
      .replace(/{{HERO_IMAGE}}/g, heroImage)
      .replace(/{{STORY}}/g, copyData.STORY)
      .replace(/{{BRAND_HEX}}/g, copyData.BRAND_HEX)
      .replace(/{{PHONE}}/g, copyData.PHONE)
      .replace(/{{PHONE_RAW}}/g, copyData.PHONE_RAW)
      .replace(/{{ADDRESS}}/g, copyData.ADDRESS)
      .replace(/{{INSTAGRAM_HANDLE}}/g, copyData.INSTAGRAM_HANDLE)
      .replace(/{{CURRENT_YEAR}}/g, String(copyData.CURRENT_YEAR));

    // Render services
    const servicesHtml = copyData.SERVICES_JSON
      .map(
        (service) =>
          `<div class="menu-item"><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p></div>`
      )
      .join("");
    html = html.replace(/{{SERVICES_ITEMS}}/g, servicesHtml);

    // Render testimonials
    const testimonialsHtml = copyData.TESTIMONIALS_JSON
      .map(
        (t) =>
          `<div class="testimonial"><p>"${escapeHtml(t.text)}"</p><div class="testimonial-author">${escapeHtml(t.author)}</div><div class="stars">${"★".repeat(t.rating)}</div></div>`
      )
      .join("");
    html = html.replace(/{{TESTIMONIALS_ITEMS}}/g, testimonialsHtml);

    // Render hours
    const hoursHtml = copyData.HOURS_JSON
      .map(
        (h) =>
          `<div class="hours-item"><strong>${h.day}</strong><p>${h.hours}</p></div>`
      )
      .join("");
    html = html.replace(/{{HOURS_ITEMS}}/g, hoursHtml);

    // Step 6: Generate slug and upload to R2
    const slug = generateSlug(lead.name, lead.place_id);
    const demoUrl = await r2.uploadDemo(slug, html);

    // Step 7: Upsert demos table
    await supabase.upsertDemo({
      lead_id: lead.id,
      template_id: template.id,
      slug: slug,
      storage_key: `demos/${slug}.html`,
      deploy_url: demoUrl,
    });

    // Update lead status to demo_ready
    await supabase.updateLeadStatus(lead.id, "demo_ready");

    console.log(`Demo generated for ${lead.name}: ${demoUrl}`);

    return { success: true, demoUrl };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Demo generation failed for ${lead.name}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Download business photos from Places API photo URLs to R2.
 * Returns array of stable R2 URLs.
 */
async function downloadBusinessPhotos(
  lead: Lead,
  r2: R2Storage
): Promise<string[]> {
  const urls: string[] = [];

  if (!lead.photo_refs || lead.photo_refs.length === 0) {
    return urls;
  }

  for (let i = 0; i < Math.min(lead.photo_refs.length, 3); i++) {
    try {
      // In real implementation, use Places API to get photo URL
      // For now, skip actual download in MVP
      // urls.push(await downloadPhotoFromPlaces(lead.photo_refs[i], r2, lead.id));
    } catch (error) {
      console.error(`Failed to download photo ${i}:`, error);
    }
  }

  return urls;
}

/**
 * Sample brand color from an image.
 * Returns a dominant color in hex format.
 */
async function sampleBrandColor(imageUrl: string | null): Promise<string> {
  // Fallback: Thai-inspired warm color
  if (!imageUrl) {
    return "#D4502D";
  }

  try {
    // In real implementation, fetch image and analyze colors
    // For MVP, return Thai-inspired colors based on context
    return ["#D4502D", "#C1440B", "#E8724C", "#8B4513"].sort(
      () => Math.random() - 0.5
    )[0];
  } catch (error) {
    console.error("Color sampling failed:", error);
    return "#D4502D";
  }
}

/**
 * Generate a slug from business name and place ID.
 */
function generateSlug(name: string, placeId: string): string {
  const nameSlug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 30);

  const idSlug = placeId.replace(/[^\w-]/g, "").substring(0, 10);
  return `${nameSlug}-${idSlug}`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
