import { DeepSeekReadingError, requestDeepSeekReading } from "@/lib/deepseek";
import type { ReadingApiError, ReadingRequest } from "@/types/reading";
import { NextResponse } from "next/server";

function errorResponse(error: ReadingApiError["error"], status: number) {
  return NextResponse.json<ReadingApiError>({ error }, { status });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReadingRequest(value: unknown): value is ReadingRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Record<string, unknown>;

  if (typeof request.question !== "string" || !request.question.trim() || !Array.isArray(request.cards)) {
    return false;
  }

  const positions = new Set<string>();
  const cardsAreValid = request.cards.length === 3 && request.cards.every((card) => {
    if (!card || typeof card !== "object") {
      return false;
    }

    const item = card as Record<string, unknown>;
    const positionIsValid = item.position === "past" || item.position === "present" || item.position === "future";
    const orientationIsValid = item.orientation === "upright" || item.orientation === "reversed";

    if (positionIsValid) {
      positions.add(item.position as string);
    }

    return (
      positionIsValid &&
      orientationIsValid &&
      typeof item.nameCn === "string" &&
      typeof item.nameEn === "string" &&
      typeof item.meaning === "string" &&
      isStringArray(item.uprightKeywords) &&
      isStringArray(item.reversedKeywords)
    );
  });

  return cardsAreValid && positions.size === 3;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse({ code: "INVALID_REQUEST", message: "解读请求格式无效。", retryable: false }, 400);
  }

  if (!isReadingRequest(payload)) {
    return errorResponse({ code: "INVALID_REQUEST", message: "请提供问题和完整的三张牌信息。", retryable: false }, 400);
  }

  try {
    const reading = await requestDeepSeekReading({ ...payload, question: payload.question.trim() });
    return NextResponse.json(reading);
  } catch (error) {
    if (error instanceof DeepSeekReadingError) {
      return errorResponse(
        { code: error.code, message: error.message, retryable: error.retryable },
        error.status,
      );
    }

    return errorResponse({ code: "INTERNAL_ERROR", message: "解读服务发生未知错误。", retryable: true }, 500);
  }
}
