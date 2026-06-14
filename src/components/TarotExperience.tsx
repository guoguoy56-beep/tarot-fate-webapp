"use client";

import { tarotCardMap } from "@/data/tarotCards";
import { drawRandomDeck, orientationLabel, positionLabel, randomOrientation } from "@/lib/tarot";
import { readReadingRecords, saveReadingRecord } from "@/lib/storage";
import type { ReadingRecord, ReadingResponse } from "@/types/reading";
import type { PlacedCard, SpreadPosition, TarotCardData } from "@/types/tarot";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { BookOpen, Flame, History, RotateCcw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type AppStage = "intro" | "question" | "camera-lift" | "shuffle" | "fan" | "draw" | "reading" | "final";

type ShuffleCard = {
  id: string;
  x: number;
  y: number;
  rotate: number;
  z: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

const spreadOrder: SpreadPosition[] = ["past", "present", "future"];

const positionCopy: Record<SpreadPosition, { title: string; hint: string }> = {
  past: { title: "过去", hint: "旧火仍在低语" },
  present: { title: "现在", hint: "烛光照见此刻" },
  future: { title: "未来", hint: "阴影尚未落定" },
};

const readingKeys: SpreadPosition[] = ["past", "present", "future"];

function createShuffleState(deck: TarotCardData[]): ShuffleCard[] {
  return deck.map((card, index) => ({
    id: card.id,
    x: (Math.random() - 0.5) * 14,
    y: (Math.random() - 0.5) * 10,
    rotate: (Math.random() - 0.5) * 4,
    z: index,
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function TextReveal({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    setVisibleText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 30);

    return () => window.clearInterval(timer);
  }, [text]);

  return <p className="min-h-28 whitespace-pre-wrap text-[15px] leading-8 text-[#f4dfb7]">{visibleText}</p>;
}

function CardBack({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-[#b08a4a]/65 bg-[#180d0a] shadow-[inset_0_0_24px_rgba(176,138,74,0.22)]">
      <div className="absolute inset-2 rounded-[7px] border border-[#b08a4a]/45" />
      <div className="absolute inset-5 rounded-full border border-[#b08a4a]/30" />
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d59b4c]/65 shadow-[0_0_28px_rgba(213,155,76,0.22)]" />
      {!compact && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-title text-[10px] tracking-[0.28em] text-[#d8b56d]/80">
          TAROT
        </div>
      )}
    </div>
  );
}

function HomeDeckPreview({ visible }: { visible: boolean }) {
  const layers = [
    { x: -9, y: 5, rotate: -5, opacity: 0.78 },
    { x: -5, y: 2, rotate: -2.4, opacity: 0.86 },
    { x: 0, y: 0, rotate: 0, opacity: 1 },
    { x: 5, y: 2, rotate: 2.4, opacity: 0.86 },
    { x: 9, y: 5, rotate: 5, opacity: 0.78 },
  ];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-44 w-32 -translate-x-1/2 -translate-y-1/2"
    >
      <div className="relative h-full w-full">
        {layers.map((layer, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              zIndex: index,
              opacity: layer.opacity,
              transform: `translate(${layer.x}px, ${layer.y}px) rotate(${layer.rotate}deg)`,
            }}
          >
            <CardBack compact />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CardFront({ card, orientation }: { card: TarotCardData; orientation: "upright" | "reversed" }) {
  const keywords = orientation === "upright" ? card.uprightKeywords : card.reversedKeywords;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-[#9d7b42] bg-[#d9c390] text-[#23130c] shadow-[inset_0_0_32px_rgba(74,39,16,0.3)]">
      <div className="absolute inset-2 rounded-[7px] border border-[#4b2b16]/50" />
      <div className="absolute left-1/2 top-7 h-16 w-16 -translate-x-1/2 rounded-full border border-[#5d3519]/50 bg-[#b08a4a]/20" />
      <div className="absolute inset-x-5 top-12 flex h-28 items-center justify-center rounded-full border border-[#5d3519]/25 bg-[#f4dfb7]/28 font-title text-4xl text-[#3a1115]">
        {card.arcana === "major" ? card.number : card.nameCn.slice(-1)}
      </div>
      <div className="absolute inset-x-4 bottom-8 text-center">
        <p className="font-title text-lg leading-tight">{card.nameCn}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#5d3519]">{card.nameEn}</p>
        <p className="mt-3 text-[10px] text-[#44220f]">{keywords.join(" / ")}</p>
      </div>
      {orientation === "reversed" && <div className="absolute right-3 top-3 text-xs text-[#3a1115]">逆</div>}
    </div>
  );
}

function MiniCard({
  card,
  orientation,
  revealed,
  layoutId,
  variant = "table",
}: {
  card: TarotCardData;
  orientation: "upright" | "reversed";
  revealed: boolean;
  layoutId?: string;
  variant?: "table" | "journal";
}) {
  const sizeClass = variant === "journal" ? "h-64 w-40" : "h-72 w-44";

  return (
    <motion.div
      layoutId={layoutId}
      transition={{ type: "spring", stiffness: 430, damping: 30, mass: 0.9 }}
      className={`tarot-card relative ${sizeClass}`}
      style={{ zIndex: variant === "journal" ? 820 : "auto" }}
    >
      <motion.div
        animate={{ rotateY: revealed ? 180 : 0, rotateZ: revealed && orientation === "reversed" ? 180 : 0 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="tarot-face absolute inset-0">
          <CardBack />
        </div>
        <div className="tarot-face tarot-front absolute inset-0">
          <CardFront card={card} orientation={orientation} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function FaceUpMiniCard({
  card,
  orientation,
  layoutId,
  variant = "table",
}: {
  card: TarotCardData;
  orientation: "upright" | "reversed";
  layoutId?: string;
  variant?: "table" | "journal";
}) {
  const sizeClass = variant === "journal" ? "h-64 w-40" : "h-72 w-44";

  return (
    <motion.div
      layoutId={layoutId}
      transition={{ type: "spring", stiffness: 180, damping: 24, mass: 1.05 }}
      className={`tarot-card relative ${sizeClass}`}
      style={{ zIndex: variant === "journal" ? 920 : "auto" }}
    >
      <div className="relative h-full w-full">
        <CardFront card={card} orientation={orientation} />
      </div>
    </motion.div>
  );
}

function FateButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 border border-[#d0a85a]/70 bg-[#5f3518]/85 px-7 py-3 text-sm tracking-[0.18em] text-[#f7dfad] shadow-[0_0_32px_rgba(213,155,76,0.22)] transition hover:bg-[#75421f] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function TarotExperience() {
  const [stage, setStage] = useState<AppStage>("intro");
  const [question, setQuestion] = useState("");
  const [deck, setDeck] = useState<TarotCardData[]>(() => drawRandomDeck());
  const [shuffleCards, setShuffleCards] = useState<ShuffleCard[]>(() => createShuffleState(deck));
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [readingError, setReadingError] = useState("");
  const [revealIndex, setRevealIndex] = useState(0);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [journalOpening, setJournalOpening] = useState(false);
  const [journalCardsSettled, setJournalCardsSettled] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const lastShufflePoint = useRef<PointerPoint | null>(null);
  const journalTimers = useRef<number[]>([]);
  const dropRefs = useRef<Record<SpreadPosition, HTMLDivElement | null>>({
    past: null,
    present: null,
    future: null,
  });

  const availableDeck = useMemo(
    () => deck.filter((card) => !placedCards.some((placed) => placed.cardId === card.id)),
    [deck, placedCards],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setStage("question"), 700);
    setRecords(readReadingRecords());
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      journalTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (stage !== "shuffle") {
      lastShufflePoint.current = null;
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "reading" || placedCards.length !== 3 || reading) {
      return;
    }

    const controller = new AbortController();

    async function loadReading() {
      try {
        setReadingError("");
        const cards = placedCards.map((placed) => {
          const card = tarotCardMap.get(placed.cardId);
          if (!card) {
            throw new Error("Missing card data.");
          }

          return {
            position: placed.position,
            nameCn: card.nameCn,
            nameEn: card.nameEn,
            orientation: placed.orientation,
            uprightKeywords: card.uprightKeywords,
            reversedKeywords: card.reversedKeywords,
            meaning: card.meaning,
          };
        });

        const response = await fetch("/api/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, cards }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("解读接口暂时没有回应。");
        }

        setReading((await response.json()) as ReadingResponse);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setReadingError(error instanceof Error ? error.message : "女巫暂时沉默了。");
      }
    }

    void loadReading();

    return () => controller.abort();
  }, [placedCards, question, reading, stage]);

  function beginRitual() {
    if (!question.trim()) {
      return;
    }

    setStage("camera-lift");
    window.setTimeout(() => setStage("shuffle"), 1200);
  }

  function resetExperience() {
    journalTimers.current.forEach((timer) => window.clearTimeout(timer));
    journalTimers.current = [];
    const nextDeck = drawRandomDeck();
    setDeck(nextDeck);
    setShuffleCards(createShuffleState(nextDeck));
    setPlacedCards([]);
    setReading(null);
    setReadingError("");
    setRevealIndex(0);
    setJournalOpening(false);
    setJournalCardsSettled(false);
    setStage("question");
  }

  function enterFateJournal() {
    journalTimers.current.forEach((timer) => window.clearTimeout(timer));
    journalTimers.current = [];
    setJournalOpening(true);
    setJournalCardsSettled(false);
    const finalTimer = window.setTimeout(() => {
      setStage("final");
    }, 1500);
    const settleTimer = window.setTimeout(() => {
      setJournalCardsSettled(true);
    }, 2920);
    journalTimers.current = [finalTimer, settleTimer];
  }

  function handleShuffleMove(event: React.PointerEvent<HTMLDivElement>) {
    if (stage !== "shuffle" || !tableRef.current) {
      return;
    }

    const rect = tableRef.current.getBoundingClientRect();
    const pointerX = event.clientX - rect.left - rect.width / 2;
    const pointerY = event.clientY - rect.top - rect.height / 2;
    const previous = lastShufflePoint.current;
    lastShufflePoint.current = { x: pointerX, y: pointerY };

    if (!previous) {
      return;
    }

    const movementX = pointerX - previous.x;
    const movementY = pointerY - previous.y;
    const movementLength = Math.hypot(movementX, movementY);

    if (movementLength < 5) {
      return;
    }

    const directionX = movementX / movementLength;
    const directionY = movementY / movementLength;

    setShuffleCards((current) =>
      current.map((card, index) => {
        const dx = card.x - pointerX;
        const dy = card.y - pointerY;
        const distance = Math.hypot(dx, dy);
        const interactionRadius = 118;

        if (distance > interactionRadius) {
          return card;
        }

        const sweepGate = Math.abs(Math.floor(pointerX / 18) + Math.floor(pointerY / 18) + index) % 4;
        if (sweepGate > 1) {
          return card;
        }

        const force = (interactionRadius - distance) / interactionRadius;
        const speedBoost = clamp(movementLength / 24, 0.65, 2.1);

        // 牌堆被视为一摞有阻力的实体。每次鼠标掠过只推动一部分牌，
        // 并且推动方向跟随鼠标轨迹，用户需要多次扫过牌堆才能彻底洗乱。
        return {
          id: card.id,
          x: clamp(card.x + directionX * force * 52 * speedBoost + (Math.random() - 0.5) * 8, -500, 500),
          y: clamp(card.y + directionY * force * 38 * speedBoost + (Math.random() - 0.5) * 7, -245, 245),
          rotate: clamp(card.rotate + directionX * force * 16 + (Math.random() - 0.5) * 7, -72, 72),
          z: 100 + index,
        };
      }),
    );
  }

  function finishShuffle() {
    setStage("fan");
    window.setTimeout(() => setStage("draw"), 650);
  }

  function handleCardDrop(card: TarotCardData, _event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const nextPosition = spreadOrder[placedCards.length];
    const zone = dropRefs.current[nextPosition];

    if (!zone) {
      return;
    }

    const rect = zone.getBoundingClientRect();
    const isInside =
      info.point.x >= rect.left && info.point.x <= rect.right && info.point.y >= rect.top && info.point.y <= rect.bottom;

    if (!isInside) {
      return;
    }

    const nextPlaced = [
      ...placedCards,
      {
        cardId: card.id,
        position: nextPosition,
        orientation: randomOrientation(),
        order: placedCards.length,
      },
    ];

    setPlacedCards(nextPlaced);

    if (nextPlaced.length === 3) {
      window.setTimeout(() => setStage("reading"), 500);
    }
  }

  function saveCurrentReading() {
    if (!reading) {
      return;
    }

    const record: ReadingRecord = {
      id: crypto.randomUUID(),
      question,
      createdAt: new Date().toISOString(),
      spread: placedCards.map((placed) => ({
        position: placed.position,
        cardId: placed.cardId,
        orientation: placed.orientation,
        interpretation: reading[placed.position],
      })),
      summary: reading.summary,
    };

    setRecords(saveReadingRecord(record));
  }

  const currentReadingKey = readingKeys[revealIndex];
  const currentPlaced = placedCards.find((placed) => placed.position === currentReadingKey);
  const currentCard = currentPlaced ? tarotCardMap.get(currentPlaced.cardId) : null;
  const spreadTopClass = stage === "draw" ? "top-[36%]" : "top-[24%]";

  return (
    <main onPointerMove={handleShuffleMove} className="relative h-screen w-screen overflow-hidden bg-ink text-[#f4dfb7]">
      <motion.div
        ref={tableRef}
        animate={{
          scale: stage === "camera-lift" || stage === "shuffle" || stage === "draw" ? 1.05 : 1,
          rotateX: stage === "question" ? 8 : 0,
          opacity: stage === "intro" ? 0 : 1,
        }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="home-table-surface absolute inset-0"
      />

      <div className="home-atmosphere pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute left-12 top-10 z-[40] flex items-center gap-3 text-[#d7b66e]/85">
        <Flame size={18} />
        <span className="font-title text-xs tracking-[0.34em]">OLD WITCH TABLE</span>
      </div>

      {(stage === "camera-lift" || stage === "shuffle" || stage === "fan" || stage === "draw") && (
        <section className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[41%] h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d59b4c]/10 blur-3xl" />
          {shuffleCards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
              animate={
                stage === "fan" || stage === "draw"
                  ? { x: 0, y: 320, rotate: 0, opacity: 0 }
                  : {
                      x: card.x,
                      y: card.y,
                      rotate: card.rotate,
                      opacity: 1,
                    }
              }
              transition={{ type: "spring", stiffness: 92, damping: 18 }}
              className="absolute left-1/2 top-[43%] h-40 w-28 -translate-x-1/2 -translate-y-1/2"
              style={{ zIndex: card.z }}
            >
              <CardBack compact />
            </motion.div>
          ))}
        </section>
      )}

      <HomeDeckPreview visible={stage === "question"} />

      <AnimatePresence>
        {stage === "question" && (
          <motion.section
            key="question"
            initial={{ opacity: 0, filter: "blur(18px)", y: 22 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(16px)", y: -22 }}
            transition={{ duration: 1.1 }}
            className="absolute inset-0 px-6"
          >
            <div className="absolute left-1/2 top-[clamp(2.5rem,8vh,6rem)] w-full -translate-x-1/2 text-center">
              <div className="mx-auto mb-4 flex w-full max-w-xl items-center justify-center gap-4 text-[#d8b56d]/72">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d8b56d]/55" />
                <Sparkles size={16} />
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d8b56d]/55" />
              </div>
              <p className="mb-3 text-xs tracking-[0.58em] text-[#d8b56d]/78">THE FATE CARDS</p>
              <h1 className="ritual-title font-title text-6xl text-[#f4d99e] md:text-7xl">命运之牌</h1>
              <p className="mt-4 text-sm tracking-[0.18em] text-[#d8c08c]/82">在烛光熄灭之前，说出你的疑问。</p>
            </div>
            <div className="home-parchment absolute bottom-[clamp(1.5rem,6vh,4rem)] left-1/2 w-[calc(100%_-_3rem)] max-w-3xl -translate-x-1/2 px-9 py-5">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="提问越清晰，命运的指引越具体..."
                className="relative z-10 h-14 w-full resize-none border-none bg-transparent text-base leading-7 text-[#28150c] outline-none placeholder:text-[#6f4a2b]/70"
              />
              <div className="home-parchment-footer relative z-10 mt-4 flex flex-col items-center justify-between gap-3 border-t border-[#6f4a2b]/25 pt-4 sm:flex-row">
                <span className="text-xs tracking-[0.16em] text-[#5c351c]">问题会被交给旧牌与火光。</span>
                <button
                  type="button"
                  onClick={beginRitual}
                  disabled={!question.trim()}
                  className="ritual-button-glow inline-flex items-center justify-center gap-2 border border-[#d0a85a]/80 bg-[#22120c]/88 px-7 py-3 text-sm tracking-[0.18em] text-[#f7dfad] transition hover:bg-[#3b2013] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Sparkles size={16} />
                  开始仪式
                </button>
              </div>
            </div>

            {records.length > 0 && (
              <div className="absolute left-1/2 top-[91.5%] flex -translate-x-1/2 items-center gap-2 text-xs text-[#d8b56d]/70">
                <History size={15} />
                已保存 {records.length} 条命运手记
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {(stage === "camera-lift" || stage === "shuffle" || stage === "fan" || stage === "draw") && (
        <section className="absolute inset-0">
          {stage === "shuffle" && (
            <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-4">
              <p className="text-sm tracking-[0.2em] text-[#dfc386]/80">用鼠标轨迹扰乱牌堆</p>
              <FateButton onClick={finishShuffle}>命运已乱，开始抽牌</FateButton>
            </div>
          )}
        </section>
      )}

      {(stage === "draw" || stage === "reading") && (
        <section className="absolute inset-0">
          <div
            className={`absolute left-1/2 ${spreadTopClass} grid w-full max-w-4xl -translate-x-1/2 grid-cols-3 gap-6 px-6 transition-[top] duration-700`}
          >
            {spreadOrder.map((position) => {
              const placed = placedCards.find((card) => card.position === position);
              const card = placed ? tarotCardMap.get(placed.cardId) : null;
              const isActiveDrop = stage === "draw" && spreadOrder[placedCards.length] === position;
              const isDraggingToActiveDrop = isActiveDrop && activeDragId !== null;
              const revealed = stage === "reading" && readingKeys.findIndex((item) => item === position) <= revealIndex;

              return (
                <div key={position} className="flex flex-col items-center gap-4">
                  <div
                    ref={(node) => {
                      dropRefs.current[position] = node;
                    }}
                    className={`relative flex h-72 w-44 items-center justify-center border ${
                      card
                        ? "border-transparent bg-transparent"
                        : isActiveDrop
                          ? "border-[#d59b4c]/80 bg-[#d59b4c]/12"
                          : "border-[#d8b56d]/20 bg-black/12"
                    } transition`}
                  >
                    {card && placed ? (
                      <MiniCard
                        card={card}
                        orientation={placed.orientation}
                        revealed={revealed}
                        layoutId={`fate-card-${placed.cardId}`}
                      />
                    ) : (
                      <div className={`text-center transition-opacity ${isDraggingToActiveDrop ? "opacity-0" : "opacity-100"}`}>
                        <p className="font-title text-2xl text-[#e8d2a4]">{positionCopy[position].title}</p>
                        <p className="mt-3 text-xs tracking-[0.16em] text-[#d8b56d]/60">{positionCopy[position].hint}</p>
                      </div>
                    )}
                  </div>
                  <p className="font-title text-2xl text-[#eed6a5]">{positionCopy[position].title}</p>
                </div>
              );
            })}
          </div>

          {stage === "draw" && (
            <div className="absolute inset-x-0 bottom-0 h-64 overflow-hidden">
              <div className="absolute left-1/2 top-20 h-64 w-[1100px] -translate-x-1/2 rounded-[50%] border-t border-[#d8b56d]/30" />
              {availableDeck.map((card, index) => {
                const center = (availableDeck.length - 1) / 2;
                const offset = index - center;
                const angle = offset * 1.15;
                const x = offset * 13;
                const y = Math.abs(offset) * 0.42;

                return (
                  <motion.div
                    key={card.id}
                    drag
                    dragSnapToOrigin
                    onDragStart={() => setActiveDragId(card.id)}
                    onDragEnd={(event, info) => {
                      setActiveDragId(null);
                      handleCardDrop(card, event, info);
                    }}
                    animate={{ x, y, rotate: angle, scale: activeDragId === card.id ? 1.08 : 1 }}
                    whileHover={{ y: y - 28, scale: 1.04 }}
                    transition={{ type: "spring", stiffness: 180, damping: 22 }}
                    className="absolute left-1/2 top-14 h-44 w-28 cursor-grab active:cursor-grabbing"
                    style={{ zIndex: activeDragId === card.id ? 400 : index }}
                  >
                    <CardBack compact />
                  </motion.div>
                );
              })}
              <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs tracking-[0.18em] text-[#d8b56d]/75">
                拖出三张牌，依次交给过去、现在与未来
              </p>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setShowHistory(true)}
        className="ritual-button-glow absolute bottom-8 right-8 z-[700] inline-flex items-center gap-2 border border-[#d8b56d]/55 bg-black/58 px-5 py-3 text-xs tracking-[0.18em] text-[#f0d79f] backdrop-blur-sm transition hover:bg-[#3b2013]/85"
      >
        <History size={16} />
        历史记录
      </button>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[800] flex items-center justify-center bg-black/62 px-6 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 18, filter: "blur(10px)" }}
              transition={{ duration: 0.28 }}
              className="parchment relative max-h-[72vh] w-full max-w-2xl overflow-hidden px-7 py-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs tracking-[0.22em] text-[#6a3f22]">FATE JOURNAL</p>
                  <h2 className="mt-2 font-title text-3xl text-[#23130c]">历史记录</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="border border-[#5f3518]/35 px-3 py-1 text-sm text-[#321b0f] transition hover:bg-[#5f3518]/10"
                >
                  关闭
                </button>
              </div>
              <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-2">
                {records.length === 0 ? (
                  <p className="border-y border-[#6f4a2b]/25 py-5 text-sm text-[#4c2c19]">还没有保存的命运手记。</p>
                ) : (
                  records.map((record) => (
                    <article key={record.id} className="border border-[#6f4a2b]/25 p-4">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <p className="text-xs tracking-[0.16em] text-[#6a3f22]">
                          {new Date(record.createdAt).toLocaleString("zh-CN")}
                        </p>
                        <p className="text-xs text-[#6a3f22]">{record.spread.length} 张牌</p>
                      </div>
                      <p className="text-sm leading-6 text-[#28150c]">{record.question}</p>
                      <p className="mt-3 line-clamp-2 text-xs leading-6 text-[#4c2c19]">{record.summary}</p>
                    </article>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage === "reading" && (
        <section className="absolute inset-x-0 bottom-8 mx-auto max-w-3xl px-6">
          <motion.div
            animate={
              journalOpening
                ? { opacity: 0, y: 18, scale: 0.98, filter: "blur(16px)" }
                : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
            }
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            className="border border-[#d8b56d]/25 bg-black/45 px-7 py-6 shadow-candle backdrop-blur-sm"
          >
            {!reading && !readingError && (
              <p className="text-center text-sm tracking-[0.18em] text-[#d8b56d]/80">女巫正在听牌，请等待火光给出回应</p>
            )}
            {readingError && <p className="text-center text-sm text-[#f0b7a7]">{readingError}</p>}
            {reading && currentCard && currentPlaced && (
              <>
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#d8b56d]/20 pb-4">
                  <div>
                    <p className="text-xs tracking-[0.24em] text-[#d8b56d]/70">{positionLabel(currentReadingKey)}</p>
                    <h2 className="mt-1 font-title text-2xl text-[#f3d9a5]">
                      {currentCard.nameCn} · {orientationLabel(currentPlaced.orientation)}
                    </h2>
                  </div>
                  <BookOpen className="text-[#d8b56d]/70" size={22} />
                </div>
                <TextReveal text={reading[currentReadingKey]} />
                <div className="mt-5 flex justify-end">
                  <FateButton
                    onClick={() => {
                      if (revealIndex < 2) {
                        setRevealIndex((value) => value + 1);
                      } else {
                        enterFateJournal();
                      }
                    }}
                  >
                    {revealIndex < 2 ? "继续揭示下一张" : "进入命运手记"}
                  </FateButton>
                </div>
              </>
            )}
          </motion.div>
        </section>
      )}

      {stage === "final" && reading && !journalCardsSettled && (
        <section className="pointer-events-none absolute inset-x-0 bottom-6 top-14 z-[920] mx-auto max-w-6xl px-6">
          <div className="relative flex h-full flex-col overflow-visible px-9 py-7">
            <div className="invisible mb-5 flex items-start justify-between gap-5">
              <div>
                <p className="text-xs tracking-[0.22em]">FATE JOURNAL</p>
                <h2 className="mt-2 font-title text-3xl">命运手记</h2>
              </div>
              <button type="button" className="inline-flex items-center gap-2 border px-4 py-2 text-sm">
                <Save size={16} />
                保存
              </button>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-visible" style={{ paddingRight: "calc(0.5rem + 17px)" }}>
              <div className="grid grid-cols-3 gap-6 border-y border-transparent py-5">
                {spreadOrder.map((position) => {
                  const placed = placedCards.find((item) => item.position === position);
                  const card = placed ? tarotCardMap.get(placed.cardId) : null;

                  return (
                    <motion.div
                      key={position}
                      layout
                      animate={{ scale: [1, 1.22, 1], y: [0, -42, 0] }}
                      transition={{
                        layout: { type: "spring", stiffness: 150, damping: 24, mass: 1.1 },
                        scale: { duration: 1.4, times: [0, 0.42, 1], ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 1.4, times: [0, 0.42, 1], ease: [0.16, 1, 0.3, 1] },
                      }}
                      className="flex flex-col items-center"
                    >
                      <div className="relative flex h-64 w-40 items-center justify-center">
                        {card && placed && (
                          <FaceUpMiniCard
                            card={card}
                            orientation={placed.orientation}
                            layoutId={`fate-card-${placed.cardId}`}
                            variant="journal"
                          />
                        )}
                      </div>
                      <div className="mt-3 text-center text-[#23130c]">
                        <p className="font-title text-xl">{positionCopy[position].title}</p>
                        <p className="mt-1 text-sm">
                          {card?.nameCn} · {placed ? orientationLabel(placed.orientation) : ""}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {stage === "final" && reading && (
        <motion.section
          initial={{ y: "112%", opacity: 1, scale: 0.985 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 bottom-6 top-14 z-[760] mx-auto max-w-6xl px-6"
        >
          <div className="parchment relative flex h-full flex-col overflow-hidden px-9 py-7">
            <div className="mb-5 flex items-start justify-between gap-5">
              <div>
                <p className="text-xs tracking-[0.22em] text-[#6a3f22]">FATE JOURNAL</p>
                <h2 className="mt-2 font-title text-3xl text-[#23130c]">命运手记</h2>
              </div>
              <button
                type="button"
                onClick={saveCurrentReading}
                className="inline-flex items-center gap-2 border border-[#5f3518]/50 px-4 py-2 text-sm text-[#321b0f] transition hover:bg-[#5f3518]/10"
              >
                <Save size={16} />
                保存
              </button>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-2" style={{ scrollbarGutter: "stable" }}>
              <div className="grid grid-cols-3 gap-6 border-y border-[#6f4a2b]/25 py-5">
                {spreadOrder.map((position) => {
                  const placed = placedCards.find((item) => item.position === position);
                  const card = placed ? tarotCardMap.get(placed.cardId) : null;

                  return (
                    <div key={position} className="flex flex-col items-center">
                      <div className="relative flex h-64 w-40 items-center justify-center">
                        {journalCardsSettled && card && placed ? (
                          <FaceUpMiniCard
                            card={card}
                            orientation={placed.orientation}
                            layoutId={`fate-card-${placed.cardId}`}
                            variant="journal"
                          />
                        ) : (
                          <div className="h-64 w-40 border border-[#6f4a2b]/30 bg-[#6f4a2b]/5" />
                        )}
                      </div>
                      <div className="mt-3 text-center text-[#23130c]">
                        <p className="font-title text-xl">{positionCopy[position].title}</p>
                        <p className="mt-1 text-sm">
                          {card?.nameCn} · {placed ? orientationLabel(placed.orientation) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-5 border-b border-[#6f4a2b]/25 pb-4 text-sm leading-7 text-[#28150c]">你的问题：{question}</p>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {spreadOrder.map((position) => (
                  <article key={position} className="border border-[#6f4a2b]/25 p-4">
                    <p className="font-title text-2xl text-[#23130c]">{positionCopy[position].title}</p>
                    <p className="mt-3 text-sm leading-7 text-[#4c2c19]">{reading[position]}</p>
                  </article>
                ))}
              </div>
              <p className="mt-5 border-t border-[#6f4a2b]/25 pt-4 font-title text-lg leading-8 text-[#28150c]">
                女巫的箴言：{reading.summary}
              </p>
            </div>

            <div className="mt-5 flex flex-none justify-between border-t border-[#6f4a2b]/20 pt-4">
              <span className="text-xs text-[#5c351c]">已保存 {records.length} 条历史记录</span>
              <button
                type="button"
                onClick={resetExperience}
                className="inline-flex items-center gap-2 text-sm text-[#321b0f] underline underline-offset-4"
              >
                <RotateCcw size={15} />
                再次占卜
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </main>
  );
}
