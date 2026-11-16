import { tarotCardMap } from "@/data/tarotCards";
import type { CosmicSpread, OrbitalSelection } from "@/lib/cosmic-experience";
import type { JournalCard, JournalRecord } from "@/lib/journal-storage";

export function sampleCardReading(selection: OrbitalSelection, position: string): JournalCard {
  const card = tarotCardMap.get(selection.cardId)!;
  const keywords = selection.orientation === "upright" ? card.uprightKeywords : card.reversedKeywords;
  return {
    position, cardId: card.id, orientation: selection.orientation, meaning: card.meaning, keywords: [...keywords],
    interpretation: `把「${keywords[0]}」作为观察${position}的一个角度：你现在最在意的是什么？试着写下一件可以主动确认或改变的小事。`,
  };
}

export function sampleSummary(spread: CosmicSpread, selected: readonly OrbitalSelection[]) {
  const first = selected[0], last = selected[selected.length - 1];
  const keyword = (item: OrbitalSelection) => {
    const card = tarotCardMap.get(item.cardId)!;
    return (item.orientation === "upright" ? card.uprightKeywords : card.reversedKeywords)[0];
  };
  return {
    overview: `${selected.length === 1 ? `这张「${tarotCardMap.get(first.cardId)!.nameCn}」对应${spread.slots[0]}。` : `从「${spread.slots[0]}」到「${spread.slots[selected.length - 1]}」，这 ${selected.length} 张牌组成了本次回顾的线索。`}先留意牌面引起的感受，再回到已经发生的事实，看看哪些部分与你的处境有关。`,
    connectionTitle: selected.length === 1 ? "值得留意的线索" : "牌与牌的联系",
    connection: `${selected.length === 1 ? `以「${keyword(first)}」作为一个观察角度：` : `把「${keyword(first)}」与「${keyword(last)}」放在一起观察：`}哪些感受彼此呼应，哪些判断还需要确认？牌面可以帮助整理想法，具体答案仍需要结合你掌握的信息。`,
    themes: selected.map((item, index) => ({ position: spread.slots[index], keyword: keyword(item) })),
    actions: ["写下一件与问题有关、已经发生的事实。", "找出一个尚未证实、值得进一步确认的判断。", "选一件今天就能开始的小事，作为下一步行动。"],
    reflection: "如果只带走一个提醒，你希望它是什么？",
  };
}

export function createSampleJournal(
  spread: CosmicSpread, selected: readonly OrbitalSelection[], question: string, id: string, createdAt: string,
): JournalRecord {
  const content = sampleSummary(spread, selected);
  return {
    version: 1, id, createdAt, kind: "sample", question: question.trim(), spreadName: spread.name,
    cards: selected.map((item, index) => sampleCardReading(item, spread.slots[index])),
    summary: ["整体脉络", content.overview, content.connectionTitle, content.connection,
      content.themes.map((theme) => `${theme.position}：${theme.keyword}`).join("\n"), "把线索，带回生活",
      content.actions.map((action, index) => `${index + 1}. ${action}`).join("\n"), content.reflection].join("\n\n"),
  };
}
