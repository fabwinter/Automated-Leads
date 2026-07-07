/**
 * Resend email service for sending outreach emails.
 * Requires warming a subdomain (e.g., hello@mail.example.com).
 */

export interface EmailParams {
  to: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class ResendService {
  private apiKey: string;
  private readonly API_URL = "https://api.resend.com/emails";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Send an email via Resend.
   * From address must be a verified domain.
   */
  async sendEmail(params: EmailParams): Promise<SendResult> {
    try {
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: params.to,
          from: params.from,
          subject: params.subject,
          html: params.html,
          reply_to: params.replyTo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || `Resend API error: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Convert HTML to plain text for fallback.
   */
  static htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export function createResendService(apiKey: string) {
  return new ResendService(apiKey);
}
