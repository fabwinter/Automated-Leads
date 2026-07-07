import { NextRequest, NextResponse } from "next/server";

const WORKER_API_URL = process.env.WORKER_API_URL || "http://localhost:8787";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${WORKER_API_URL}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Draft API error:", errorMsg);

    return NextResponse.json(
      { status: "error", message: errorMsg },
      { status: 500 }
    );
  }
}
