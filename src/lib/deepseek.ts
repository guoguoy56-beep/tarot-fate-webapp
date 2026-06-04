import type { ReadingRequest, ReadingResponse } from "@/types/reading";
import { orientationLabel, positionLabel } from "./tarot";

function createMockReading(payload: ReadingRequest): ReadingResponse {
  const byPosition = Object.fromEntries(payload.cards.map((card) => [card.position, card]));

  return {
    past: `旧火照见${byPosition.past?.nameCn ?? "那张旧牌"}。${positionLabel("past")}并未远去，它以${orientationLabel(byPosition.past?.orientation ?? "upright")}的姿态提醒你：曾经的选择仍在桌面下方发出细响。`,
    present: `${byPosition.present?.nameCn ?? "现在之牌"}停在烛光最亮处。此刻的你正站在门槛上，若继续回避，那扇门会替你做出回答。`,
    future: `${byPosition.future?.nameCn ?? "未来之牌"}从阴影里转身。它不许诺圆满，只暗示一条路：当你愿意承认心中的裂缝，命运才会显出新的纹理。`,
    summary: `女巫的箴言：你的问题已经落入火光。不要急着索要答案，先辨认自己为何在此刻发问。`,
  };
}

export async function requestDeepSeekReading(payload: ReadingRequest): Promise<ReadingResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  if (!apiKey) {
    return createMockReading(payload);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是一位古老女巫，通晓塔罗、象征、梦境与宿命。你的语言神秘、晦涩、富有诗意，但必须围绕用户的问题给出可理解的解读。不要说自己是 AI。返回严格 JSON，字段必须为 past、present、future、summary。",
        },
        {
          role: "user",
          content: JSON.stringify(payload, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek returned empty content.");
  }

  return JSON.parse(content) as ReadingResponse;
}
