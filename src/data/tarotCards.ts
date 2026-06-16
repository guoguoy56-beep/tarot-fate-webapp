import type { TarotCardData, TarotSuit } from "@/types/tarot";

const majorArcana: TarotCardData[] = [
  ["fool", "愚者", "The Fool", 0, ["开始", "自由", "冒险"], ["鲁莽", "逃避", "迷失"], "新旅程的门缝已被风吹开。"],
  ["magician", "魔术师", "The Magician", 1, ["意志", "创造", "显化"], ["欺瞒", "空谈", "失控"], "手中的器物会回应清醒的意志。"],
  ["high-priestess", "女祭司", "The High Priestess", 2, ["直觉", "秘密", "静默"], ["遮蔽", "迟疑", "误读"], "沉默的书页藏着尚未被允许说出的答案。"],
  ["empress", "女皇", "The Empress", 3, ["滋养", "丰盛", "感性"], ["依赖", "停滞", "过度"], "柔软之物也能生长出不可违逆的力量。"],
  ["emperor", "皇帝", "The Emperor", 4, ["秩序", "掌控", "结构"], ["僵化", "压迫", "固执"], "石座上的王冠要求你承认边界。"],
  ["hierophant", "教皇", "The Hierophant", 5, ["传统", "教诲", "信念"], ["束缚", "反叛", "空壳"], "旧仪式不一定真实，却常常有它的重量。"],
  ["lovers", "恋人", "The Lovers", 6, ["选择", "联结", "吸引"], ["犹豫", "失衡", "诱惑"], "两条道路在心脏处交会。"],
  ["chariot", "战车", "The Chariot", 7, ["胜利", "意志", "推进"], ["失控", "冲撞", "分裂"], "车轮碾过尘土，也暴露驾车者的方向。"],
  ["strength", "力量", "Strength", 8, ["勇气", "温柔", "驯服"], ["怯懦", "压抑", "暴烈"], "真正的力量常以低声靠近。"],
  ["hermit", "隐者", "The Hermit", 9, ["独处", "追寻", "内省"], ["孤立", "迷惘", "冷却"], "灯火只能照亮愿意独自前行的人。"],
  ["wheel-of-fortune", "命运之轮", "Wheel of Fortune", 10, ["转机", "循环", "命运"], ["反复", "错失", "停轮"], "轮子转动时，没有人能站在完全静止之处。"],
  ["justice", "正义", "Justice", 11, ["平衡", "因果", "裁决"], ["偏见", "失衡", "逃责"], "天平不会怜悯，只会记住重量。"],
  ["hanged-man", "倒吊人", "The Hanged Man", 12, ["牺牲", "等待", "换位"], ["拖延", "抗拒", "僵局"], "倒悬的视角会让旧答案失去形状。"],
  ["death", "死神", "Death", 13, ["结束", "蜕变", "清除"], ["执念", "恐惧", "停滞"], "镰刀落下时，也为新土留出空地。"],
  ["temperance", "节制", "Temperance", 14, ["调和", "疗愈", "耐心"], ["失衡", "急躁", "耗散"], "两只杯之间流动的是时间。"],
  ["devil", "恶魔", "The Devil", 15, ["欲望", "束缚", "沉溺"], ["觉醒", "挣脱", "看清"], "锁链最初常被误认为饰物。"],
  ["tower", "高塔", "The Tower", 16, ["崩塌", "真相", "突变"], ["余震", "抗拒", "隐患"], "雷霆不是惩罚，它只是揭开裂缝。"],
  ["star", "星星", "The Star", 17, ["希望", "净化", "指引"], ["失望", "遥远", "迟疑"], "远处的光不催促，只证明夜还未吞尽你。"],
  ["moon", "月亮", "The Moon", 18, ["梦境", "幻象", "潜意识"], ["迷雾散去", "恐惧", "误判"], "月光会照见路，也会加深影子。"],
  ["sun", "太阳", "The Sun", 19, ["明朗", "生命力", "成功"], ["过曝", "幼稚", "短暂"], "光明让真相变得无处可藏。"],
  ["judgement", "审判", "Judgement", 20, ["召唤", "觉醒", "清算"], ["逃避", "迟迟不决", "旧债"], "号角响起时，沉睡者必须回答。"],
  ["world", "世界", "The World", 21, ["完成", "整合", "抵达"], ["未竟", "循环", "缺口"], "旅程闭合之处，也埋着下一扇门。"],
].map(([id, nameCn, nameEn, number, uprightKeywords, reversedKeywords, meaning]) => ({
  id: id as string,
  nameCn: nameCn as string,
  nameEn: nameEn as string,
  arcana: "major",
  suit: null,
  number: number as number,
  uprightKeywords: uprightKeywords as string[],
  reversedKeywords: reversedKeywords as string[],
  meaning: meaning as string,
  image: `/cards/rws/major-${String(number).padStart(2, "0")}-${id}.jpg`,
}));

const suits: Record<Exclude<TarotSuit, null>, { cn: string; en: string; theme: string }> = {
  wands: { cn: "权杖", en: "Wands", theme: "火焰、意志与行动" },
  cups: { cn: "圣杯", en: "Cups", theme: "情感、关系与梦" },
  swords: { cn: "宝剑", en: "Swords", theme: "思想、冲突与真相" },
  pentacles: { cn: "星币", en: "Pentacles", theme: "现实、资源与身体" },
};

const ranks = [
  { n: 1, cn: "一", en: "Ace", up: ["种子", "开端", "召唤"], rev: ["迟滞", "未成形", "空转"] },
  { n: 2, cn: "二", en: "Two", up: ["选择", "平衡", "对望"], rev: ["摇摆", "失衡", "犹疑"] },
  { n: 3, cn: "三", en: "Three", up: ["扩展", "协作", "萌发"], rev: ["分散", "延误", "误会"] },
  { n: 4, cn: "四", en: "Four", up: ["稳定", "边界", "休整"], rev: ["封闭", "僵化", "不安"] },
  { n: 5, cn: "五", en: "Five", up: ["冲突", "试炼", "缺口"], rev: ["和解", "退让", "余痛"] },
  { n: 6, cn: "六", en: "Six", up: ["回声", "馈赠", "过渡"], rev: ["沉溺过去", "亏欠", "停留"] },
  { n: 7, cn: "七", en: "Seven", up: ["考验", "策略", "迷雾"], rev: ["暴露", "疲惫", "破局"] },
  { n: 8, cn: "八", en: "Eight", up: ["推进", "技艺", "束缚"], rev: ["停工", "松动", "散乱"] },
  { n: 9, cn: "九", en: "Nine", up: ["成果", "孤峰", "守望"], rev: ["不满足", "戒备", "耗尽"] },
  { n: 10, cn: "十", en: "Ten", up: ["完成", "重负", "循环"], rev: ["释放", "崩解", "卸下"] },
  { n: 11, cn: "侍从", en: "Page", up: ["讯息", "学习", "初愿"], rev: ["幼稚", "迟疑", "杂音"] },
  { n: 12, cn: "骑士", en: "Knight", up: ["追逐", "行动", "冲锋"], rev: ["鲁莽", "偏执", "停滞"] },
  { n: 13, cn: "王后", en: "Queen", up: ["滋养", "掌握", "内在"], rev: ["失控", "封闭", "过度"] },
  { n: 14, cn: "国王", en: "King", up: ["权威", "成熟", "统御"], rev: ["专断", "冷漠", "失序"] },
];

const minorArcana: TarotCardData[] = Object.entries(suits).flatMap(([suitKey, suit]) =>
  ranks.map((rank) => ({
    id: `${suitKey}-${rank.n}`,
    nameCn: `${suit.cn}${rank.cn}`,
    nameEn: `${rank.en} of ${suit.en}`,
    arcana: "minor",
    suit: suitKey as Exclude<TarotSuit, null>,
    number: rank.n,
    uprightKeywords: rank.up,
    reversedKeywords: rank.rev,
    meaning: `${suit.theme}在这张牌里留下了${rank.cn}重痕迹。`,
    image: `/cards/rws/${suitKey}-${rank.n}.jpg`,
  })),
);

export const tarotCards: TarotCardData[] = [...majorArcana, ...minorArcana];

export const tarotCardMap = new Map(tarotCards.map((card) => [card.id, card]));
