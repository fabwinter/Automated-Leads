import { SupabaseClient } from "../lib/supabase";
import { Anthropic } from "@anthropic-ai/sdk";

export interface DraftRequest {
  lead_id: string;
  run_id: string;
}

export async function handleDraft(
  req: DraftRequest,
  supabase: SupabaseClient,
  anthropic: Anthropic
): Promise<{ status: string; outreach_id: string; draft_subject: string; draft_body: string }> {
  const { lead_id, run_id } = req;

  // Fetch lead + audit + demo
  const lead = await supabase.client
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .single();

  if (lead.error) throw new Error(`Lead not found: ${lead.error.message}`);
  const leadData = lead.data;

  const audit = await supabase.client
    .from("audits")
    .select("*")
    .eq("lead_id", lead_id)
    .single();

  const auditData = audit.data || {};

  const demo = await supabase.client
    .from("demos")
    .select("deploy_url")
    .eq("lead_id", lead_id)
    .single();

  const demoUrl = demo.data?.deploy_url || null;

  // Build context for Claude
  const issueList = Object.entries(auditData.issues || {})
    .filter(([_, value]) => value === true)
    .map(([key]) => {
      const labels: Record<string, string> = {
        no_site: "No website",
        broken: "Website broken/unreachable",
        no_ssl: "Missing SSL certificate",
        social_only: "Only social media presence",
        not_mobile: "Not mobile responsive",
        slow: "Slow page performance",
        no_contact: "Missing contact information",
        pdf_menu: "PDF menu instead of web page",
        dated: "Outdated website design",
        seo_issues_present: "SEO issues detected",
      };
      return labels[key] || key;
    });

  const businessContext = `
Business: ${leadData.name}
Location: ${leadData.city}
Rating: ${leadData.rating}/5 (${leadData.review_count} reviews)
Website Issues: ${issueList.length > 0 ? issueList.join(", ") : "No specific issues detected"}
Phone: ${leadData.phone || "Not listed"}
Issues Summary: ${auditData.issue_summary || "Website needs improvement"}
`;

  const draftPrompt = `You are composing a cold outreach email for a local business with website issues.

${businessContext}

Your task: Write a compelling subject line and email body that:
1. Opens with personalization (reference their business or a recent review/photo)
2. Clearly identify ONE specific issue from their website (reference the issues listed above)
3. Offer a solution: show them a live preview of what their redesigned site could look like
4. Include the demo URL: ${demoUrl || "https://[demo-url].demos.example.com"}
5. Keep it short (under 200 words for body), professional, non-pushy
6. End with a light CTA and signature

IMPORTANT: You MUST respond with ONLY valid JSON on a single line, no markdown backticks, no extra text:
{"subject": "...", "body": "..."}`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: draftPrompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let draftData;
  try {
    draftData = JSON.parse(content.text);
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${content.text}`);
  }

  // Upsert into outreach table with draft status
  const outreach = await supabase.client
    .from("outreach")
    .upsert(
      {
        lead_id,
        channel: "email",
        subject: draftData.subject,
        body: draftData.body,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id" }
    )
    .select("id")
    .single();

  if (outreach.error) throw new Error(`Failed to create draft: ${outreach.error.message}`);

  // Update lead status to drafted
  await supabase.updateLeadStatus(lead_id, "drafted");

  return {
    status: "success",
    outreach_id: outreach.data.id,
    draft_subject: draftData.subject,
    draft_body: draftData.body,
  };
}
