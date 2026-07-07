import { Anthropic } from "anthropic";

/**
 * Vision service using Claude to analyze website aesthetics.
 * Only called if runs.config.vision_audit is true.
 */

export class VisionAuditService {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Analyze a website screenshot for visual aesthetic issues.
   * Returns a single-sentence assessment of what's visually wrong.
   */
  async analyzeScreenshot(
    screenshotBase64: string,
    mediaType: "image/png" | "image/jpeg" = "image/png"
  ): Promise<string | null> {
    try {
      const message = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: screenshotBase64,
                },
              },
              {
                type: "text",
                text: 'You are a blunt web design critic. In one sentence, say what\'s wrong with this website\'s look — dated stock photos, no hierarchy, clashing colours, generic template feel, cramped mobile layout, etc. Be specific, not generic. If the site looks professionally designed and modern, respond with: "No obvious design issues."',
              },
            ],
          },
        ],
      });

      const textContent = message.content.find((block) => block.type === "text");
      if (textContent && textContent.type === "text") {
        return textContent.text.trim();
      }
      return null;
    } catch (error) {
      console.error("Vision audit failed:", error);
      return null;
    }
  }

  /**
   * Convert ArrayBuffer to base64 for API submission.
   */
  static bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export function createVisionService(apiKey: string) {
  return new VisionAuditService(apiKey);
}
