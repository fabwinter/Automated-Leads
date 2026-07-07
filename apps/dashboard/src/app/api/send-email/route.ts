import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, to, subject, body: bodyText } = body;

    if (!lead_id || !to || !subject || !bodyText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Send email via Resend
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
      to,
      subject,
      html: bodyText.replace(/\n/g, "<br>"), // Simple HTML conversion
    });

    if (result.error) {
      throw result.error;
    }

    // Update outreach status to sent
    await supabase
      .from("outreach")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", lead_id)
      .eq("channel", "email");

    // Update lead status
    await supabase
      .from("leads")
      .update({
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    return NextResponse.json({
      status: "success",
      messageId: result.data?.id,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Send email error:", errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
