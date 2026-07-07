import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const leadId = request.nextUrl.searchParams.get("lead_id");

    if (!leadId) {
      return NextResponse.json(
        { error: "Missing lead_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("outreach")
      .select("*")
      .eq("lead_id", leadId)
      .eq("channel", "email")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json(data || null);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Outreach GET error:", errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, subject, body: bodyText, status } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: "Missing lead_id" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (subject !== undefined) updateData.subject = subject;
    if (bodyText !== undefined) updateData.body = bodyText;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from("outreach")
      .update(updateData)
      .eq("lead_id", lead_id)
      .eq("channel", "email")
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Outreach PUT error:", errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
