import { NextRequest, NextResponse } from "next/server";

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || "http://localhost:8001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field" },
        { status: 400 }
      );
    }

    const payload: { text: string; lang: string; voice?: string } = {
      text: body.text,
      lang: body.lang || "fa",
    };
    if (body.voice && typeof body.voice === "string") {
      payload.voice = body.voice;
    }

    // Forward request to Python TTS service
    const response = await fetch(`${TTS_SERVICE_URL}/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "TTS service error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Health check - ping the TTS service
    const response = await fetch(`${TTS_SERVICE_URL}/`, {
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", message: "TTS service unavailable" },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      status: "ok",
      tts_service: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 503 }
    );
  }
}
