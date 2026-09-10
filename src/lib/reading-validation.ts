import { tarotCardMap } from "@/data/tarotCards";
import type {
  ReadingRequestErrorCode,
  TrustedReadingCard,
  TrustedReadingRequest,
} from "@/types/reading";
import type { CardOrientation, SpreadPosition } from "@/types/tarot";

const spreadPositions: ReadonlySet<string> = new Set(["past", "present", "future"]);
const cardOrientations: ReadonlySet<string> = new Set(["upright", "reversed"]);

interface ReadingRequestValidationError {
  code: ReadingRequestErrorCode;
  message: string;
}

export type ReadingRequestValidationResult =
  | { success: true; data: TrustedReadingRequest }
  | { success: false; error: ReadingRequestValidationError };

function failure(code: ReadingRequestErrorCode, message: string): ReadingRequestValidationResult {
  return { success: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSpreadPosition(value: unknown): value is SpreadPosition {
  return typeof value === "string" && spreadPositions.has(value);
}

export function isCardOrientation(value: unknown): value is CardOrientation {
  return typeof value === "string" && cardOrientations.has(value);
}

export function isTarotCardId(value: unknown): value is string {
  return typeof value === "string" && tarotCardMap.has(value);
}

export function validateReadingRequest(value: unknown): ReadingRequestValidationResult {
  if (!isRecord(value)) {
    return failure("INVALID_REQUEST", "解读请求格式无效。");
  }

  if (typeof value.question !== "string" || !value.question.trim()) {
    return failure("INVALID_REQUEST", "请提供非空问题。");
  }

  if (!Array.isArray(value.cards)) {
    return failure("INVALID_REQUEST", "解读请求格式无效。");
  }

  if (value.cards.length !== 3) {
    return failure("INVALID_CARD_COUNT", "解读请求必须包含三张牌。");
  }

  const positions = new Set<SpreadPosition>();
  const cardIds = new Set<string>();
  const cards: TrustedReadingCard[] = [];

  for (const card of value.cards) {
    if (!isRecord(card)) {
      return failure("INVALID_REQUEST", "卡牌信息格式无效。");
    }

    if (typeof card.cardId !== "string" || !card.cardId) {
      return failure("INVALID_CARD_ID", "卡牌 ID 格式无效。");
    }

    if (!isTarotCardId(card.cardId)) {
      return failure("UNKNOWN_CARD", "解读请求包含未知卡牌。");
    }

    const trustedCard = tarotCardMap.get(card.cardId);

    if (!trustedCard) {
      return failure("UNKNOWN_CARD", "解读请求包含未知卡牌。");
    }

    if (!isSpreadPosition(card.position)) {
      return failure("INVALID_CARD_POSITION", "牌位必须为 past、present 或 future。");
    }

    if (positions.has(card.position)) {
      return failure("DUPLICATE_CARD_POSITION", "三张牌的牌位不能重复。");
    }

    if (!isCardOrientation(card.orientation)) {
      return failure("INVALID_CARD_ORIENTATION", "卡牌方向必须为 upright 或 reversed。");
    }

    if (cardIds.has(card.cardId)) {
      return failure("DUPLICATE_CARD", "三张牌不能重复。");
    }

    positions.add(card.position);
    cardIds.add(card.cardId);
    cards.push({
      cardId: card.cardId,
      position: card.position,
      nameCn: trustedCard.nameCn,
      nameEn: trustedCard.nameEn,
      orientation: card.orientation,
      uprightKeywords: trustedCard.uprightKeywords,
      reversedKeywords: trustedCard.reversedKeywords,
      meaning: trustedCard.meaning,
    });
  }

  return {
    success: true,
    data: {
      question: value.question.trim(),
      cards,
    },
  };
}
