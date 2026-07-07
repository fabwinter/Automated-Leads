import { Anthropic } from "anthropic";
import type { Lead, Audit } from "@outreach-engine/types";

export interface CopyFillResult {
  BUSINESS_NAME: string;
  HERO_TAGLINE: string;
  STORY: string;
  SERVICES_JSON: Array<{ name: string; description: string }>;
  TESTIMONIALS_JSON: Array<{
    text: string;
    author: string;
    rating: number;
  }>;
  HOURS_JSON: Array<{ day: string; hours: string }>;
  PHONE: string;
  PHONE_RAW: string;
  ADDRESS: string;
  INSTAGRAM_HANDLE: string;
  BRAND_HEX: string;
  CURRENT_YEAR: number;
}

export class CopyFillService {
  private anthropic: Anthropic;
  private templateDirection: string;

  constructor(apiKey: string, templateDirection: string = "") {
    this.anthropic = new Anthropic({ apiKey });
    this.templateDirection = templateDirection;
  }

  /**
   * Generate copy for all template tokens using Claude.
   * Input: business data (lead + audit + photos)
   * Output: JSON with all token values
   */
  async generateCopy(
    lead: Lead,
    audit: Audit,
    photoUrls: string[],
    brandHex: string
  ): Promise<CopyFillResult> {
    const prompt = this.buildPrompt(lead, audit, photoUrls, brandHex);

    try {
      const message = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const textContent = message.content.find((block) => block.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from Claude");
      }

      // Extract JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from Claude response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return this.normalizeResult(parsed, lead);
    } catch (error) {
      console.error("CopyFill error:", error);
      // Return safe defaults
      return this.getFallbackCopy(lead, brandHex);
    }
  }

  /**
   * Build the prompt for Claude to generate all copy tokens.
   */
  private buildPrompt(
    lead: Lead,
    audit: Audit,
    photoUrls: string[],
    brandHex: string
  ): string {
    const issueContext = audit.issue_summary
      ? `Issue to address: ${audit.issue_summary}`
      : "No major issues detected.";

    const niceNiche = lead.niche.replace(/_/g, " ");

    const directionHint = this.templateDirection
      ? `\nTemplate vibe/direction: ${this.templateDirection}`
      : "";

    return `You are a web copywriter specializing in local businesses. Generate compelling, specific copy for a ${niceNiche} website.

Business: ${lead.name}
Location: ${lead.city}
Rating: ${lead.rating}/5 (${lead.review_count} reviews)
Website issue: ${issueContext}${directionHint}

TASK: Return valid JSON (no markdown wrapper, just raw JSON) with these fields:
{
  "BUSINESS_NAME": "exact business name",
  "HERO_TAGLINE": "short, punchy tagline (under 10 words) for the hero section",
  "STORY": "1-2 paragraph origin/mission story (50-80 words), sensory and specific to this niche",
  "SERVICES_JSON": [
    { "name": "Dish/Service Name", "description": "What makes it special (15-25 words)" },
    { "name": "...", "description": "..." }
  ],
  "TESTIMONIALS_JSON": [
    { "text": "Specific praise (20-40 words)", "author": "First name only", "rating": 5 },
    { "text": "...", "author": "...", "rating": 5 }
  ],
  "HOURS_JSON": [
    { "day": "Monday", "hours": "10am - 10pm" },
    { "day": "Tuesday", "hours": "10am - 10pm" },
    { "day": "Wednesday", "hours": "10am - 10pm" },
    { "day": "Thursday", "hours": "10am - 10pm" },
    { "day": "Friday", "hours": "10am - 11pm" },
    { "day": "Saturday", "hours": "11am - 11pm" },
    { "day": "Sunday", "hours": "11am - 10pm" }
  ],
  "PHONE": "${lead.phone || '(02) 1234 5678'}",
  "ADDRESS": "inferred from context or generic placeholder"
}

Rules:
- 3-4 services/dishes for a ${niceNiche}
- 3-4 testimonials (5-star)
- Be specific, not generic (no "excellent service" clichés)
- Sensory details matter (taste, atmosphere, feeling)
- No adjectives like "amazing", "awesome", "great"
- Short sentences, conversational tone
- Testimonials sound like real customers (mention specific dishes/experiences)
- Output ONLY the JSON, no other text`;
  }

  /**
   * Normalize and validate the Claude-generated result.
   */
  private normalizeResult(parsed: any, lead: Lead): CopyFillResult {
    const currentYear = new Date().getFullYear();

    return {
      BUSINESS_NAME: parsed.BUSINESS_NAME || lead.name,
      HERO_TAGLINE: parsed.HERO_TAGLINE || "Welcome",
      STORY: parsed.STORY || `Discover ${lead.name} in ${lead.city}.`,
      SERVICES_JSON: Array.isArray(parsed.SERVICES_JSON)
        ? parsed.SERVICES_JSON.slice(0, 5)
        : [],
      TESTIMONIALS_JSON: Array.isArray(parsed.TESTIMONIALS_JSON)
        ? parsed.TESTIMONIALS_JSON.slice(0, 5)
        : [],
      HOURS_JSON: Array.isArray(parsed.HOURS_JSON)
        ? parsed.HOURS_JSON
        : this.getDefaultHours(),
      PHONE: lead.phone || "(02) 1234 5678",
      PHONE_RAW: this.phoneToRaw(lead.phone),
      ADDRESS: parsed.ADDRESS || `${lead.city}, NSW`,
      INSTAGRAM_HANDLE: lead.instagram
        ? lead.instagram.replace("https://instagram.com/", "")
        : "instagram",
      BRAND_HEX: "#D4502D", // Thai-inspired warm color
      CURRENT_YEAR: currentYear,
    };
  }

  /**
   * Return fallback copy when Claude fails.
   */
  private getFallbackCopy(lead: Lead, brandHex: string): CopyFillResult {
    const currentYear = new Date().getFullYear();

    return {
      BUSINESS_NAME: lead.name,
      HERO_TAGLINE: `Experience ${lead.name}`,
      STORY: `Welcome to ${lead.name}, a valued local business in ${lead.city}. We're dedicated to providing excellent service to our community.`,
      SERVICES_JSON: [
        { name: "Service 1", description: "Quality service" },
        { name: "Service 2", description: "Customer satisfaction" },
      ],
      TESTIMONIALS_JSON: [
        {
          text: "Great experience! Highly recommended.",
          author: "Customer",
          rating: 5,
        },
        {
          text: "Excellent service and attention to detail.",
          author: "Client",
          rating: 5,
        },
      ],
      HOURS_JSON: this.getDefaultHours(),
      PHONE: lead.phone || "(02) 1234 5678",
      PHONE_RAW: this.phoneToRaw(lead.phone),
      ADDRESS: `${lead.city}, NSW`,
      INSTAGRAM_HANDLE: "follow-us",
      BRAND_HEX: brandHex,
      CURRENT_YEAR: currentYear,
    };
  }

  /**
   * Get default business hours (typical 10-10 schedule).
   */
  private getDefaultHours() {
    return [
      { day: "Monday", hours: "10am - 10pm" },
      { day: "Tuesday", hours: "10am - 10pm" },
      { day: "Wednesday", hours: "10am - 10pm" },
      { day: "Thursday", hours: "10am - 10pm" },
      { day: "Friday", hours: "10am - 11pm" },
      { day: "Saturday", hours: "11am - 11pm" },
      { day: "Sunday", hours: "11am - 10pm" },
    ];
  }

  /**
   * Convert phone number to raw format for tel: links.
   */
  private phoneToRaw(phone: string | null | undefined): string {
    if (!phone) return "+61212345678";
    return phone.replace(/[^\d+]/g, "");
  }
}

export function createCopyFillService(
  apiKey: string,
  templateDirection?: string
) {
  return new CopyFillService(apiKey, templateDirection);
}
