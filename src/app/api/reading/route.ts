import { requestDeepSeekReading } from "@/lib/deepseek";
import type { ReadingRequest } from "@/types/reading";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ReadingRequest;

    if (!payload.question || !Array.isArray(payload.cards) || payload.cards.length !== 3) {
      return NextResponse.json({ error: "Invalid reading request." }, { status: 400 });
    }

    const reading = await requestDeepSeekReading(payload);
    return NextResponse.json(reading);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
