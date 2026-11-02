"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, History, Orbit, Search, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { tarotCards, tarotCardMap } from "@/data/tarotCards";
import { advanceOrbitMotion, cosmicSpreads, isRingDrag, nearestRotation, orbitMotion, ringDragDelta, selectOrbitalCard, type CosmicSpread, type OrbitalSelection, type RingProjection } from "@/lib/cosmic-experience";
import { shuffleDeck, randomOrientation } from "@/lib/tarot-random";
import { readReadingRecords } from "@/lib/storage";
import type { TarotCardData, CardOrientation } from "@/types/tarot";
import type { ReadingRecord } from "@/types/reading";
import "./cosmic-experience.css";

type Stage = "home" | "travel" | "shuffle" | "draw" | "reading" | "summarizing" | "summary";
type Panel = "prepare" | "encyclopedia" | "history" | "login" | null;
interface DeckCard { card: TarotCardData; orientation: CardOrientation }
interface DemoJournal { id: number; question: string; spread: string; cards: OrbitalSelection[] }

const motionEase = [0.22, 1, 0.36, 1] as const;
const initialDeck: DeckCard[] = tarotCards.map((card) => ({ card, orientation: "upright" }));
const cardData = (id: string) => tarotCardMap.get(id)!;
// Staging coordinates for the opening ribbon; every card later joins its fixed ring anchor.
const openingPoses = [
  [.70, .23, .29, -9], [.75, .24, .33, 5], [.81, .27, .4, 12],
  [.86, .32, .46, 16], [.82, .40, .65, -15], [.73, .36, .72, -10],
  [.67, .40, .8, -13], [.63, .51, 1.15, -14], [.76, .49, .95, 17],
  [.88, .51, .8, 24], [.93, .63, 1.45, -15], [.67, .66, 1.1, -24],
  [.59, .81, 1.9, 20], [.79, .75, 3.65, 23], [.37, 1.09, 3.6, 60],
  [.98, .94, 2.3, -17], [.55, .57, .67, -13], [.91, .36, .5, 24],
];

function CosmicScene({ stage, deck, selected, current, onSelect, paused }: {
  stage: Stage; deck: DeckCard[]; selected: OrbitalSelection[]; current: number;
  onSelect: (anchor: number) => void; paused: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const background = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const rotation = useRef(-0.4);
  const ringProjection = useRef<RingProjection | null>(null);
  const camera = useRef({ ring: 0, reading: 0, summary: 0, travel: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; lastX: number; lastY: number; lastTime: number; directionDelta: number; dragging: boolean } | null>(null);
  const velocity = useRef(0);
  const idleDirection = useRef(1);
  const previousFrameTime = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const sceneStart = useRef<number | null>(null);
  const focusWeights = useRef<number[]>(Array(78).fill(0));
  const reducedMotion = useReducedMotion();
  const active = selected[current];

  useEffect(() => {
    const surface = root.current;
    if (!surface) return;
    let frame = 0;
    const render = (now: number) => {
      const delta = Math.min(now - (previousFrameTime.current ?? now), 100);
      previousFrameTime.current = now;
      if (sceneStart.current === null) sceneStart.current = now;
      const elapsed = now - sceneStart.current;
      const w = surface.clientWidth;
      const h = surface.clientHeight;
      const reading = stage === "reading" || stage === "summarizing" || stage === "summary";
      const ring = stage !== "home";
      const summary = stage === "summarizing" || stage === "summary";
      const cam = camera.current;
      const ease = reducedMotion ? 1 : 1 - Math.exp(-delta / 650);
      cam.ring += (Number(ring) - cam.ring) * ease;
      cam.reading += (Number(reading) - cam.reading) * ease;
      cam.summary += (Number(summary) - cam.summary) * ease;
      cam.travel += (Number(stage === "travel") - cam.travel) * ease;
      if (stage === "reading" && active) {
        velocity.current = 0;
        const target = nearestRotation(rotation.current, active.anchor, deck.length);
        rotation.current += (target - rotation.current) * (reducedMotion ? 1 : 1 - Math.exp(-delta / 320));
      } else if (stage === "travel" || stage === "shuffle" || stage === "draw") {
        if (stage !== "draw") idleDirection.current = 1;
        if (paused || reducedMotion) {
          velocity.current = 0;
        } else if (!pointer.current?.dragging) {
          const target = stage === "travel" ? orbitMotion.travelSpeed : stage === "shuffle" ? orbitMotion.shuffleSpeed : orbitMotion.idleSpeed * idleDirection.current;
          const next = advanceOrbitMotion(velocity.current, target, delta);
          velocity.current = next.speed;
          rotation.current += next.angle;
        }
      } else {
        velocity.current = 0;
        if (stage === "home") idleDirection.current = 1;
      }
      surface.dataset.rotation = rotation.current.toFixed(8);
      surface.dataset.rotationTime = now.toFixed(2);
      if (background.current) {
        background.current.style.transform = `translate3d(${-3 - cam.ring * 5 - cam.reading * 107}%, ${-3 - cam.reading * 80}%, 0) scale(${1.12 + cam.ring * 0.18 + cam.travel * 0.4 + cam.reading * 2 - cam.summary * 0.13}) rotate(${cam.reading * -3}deg)`;
      }
      const cx = w * (0.5 - cam.reading * 0.16 + cam.summary * 0.16);
      const cy = h * (0.60 - cam.reading * 0.22 + cam.summary * 0.07);
      const rx = w * (0.405 - cam.reading * 0.065 - cam.summary * 0.08);
      const ry = h * (0.18 + cam.reading * 0.07 - cam.summary * 0.07);
      ringProjection.current = { cx, cy, rx, ry };
      if (track.current) {
        track.current.style.transform = `translate3d(${cx}px, ${cy + 15}px, 0) translate(-50%, -50%) scale(1, ${ry / rx}) rotate(${rotation.current * 180 / Math.PI * 0.15}deg)`;
        track.current.style.width = `${rx * 2.55}px`;
        track.current.style.opacity = `${cam.ring * 0.85}`;
      }
      const depths = deck.map((_, index) => (Math.sin(index / deck.length * Math.PI * 2 + rotation.current) + 1) / 2);
      const depthOrder = deck.map((_, index) => index).sort((a, b) => depths[a] - depths[b]);
      const zIndices = new Array<number>(deck.length);
      depthOrder.forEach((index, rank) => { zIndices[index] = rank; });
      deck.forEach((_, index) => {
        const element = cards.current[index];
        if (!element) return;
        const angle = index / deck.length * Math.PI * 2 + rotation.current;
        const depth = depths[index];
        const selectedIndex = selected.findIndex((item) => item.anchor === index);
        const focused = stage === "reading" && active?.anchor === index;
        const homeIndex = index % 18;
        const pose = openingPoses[homeIndex];
        const idle = reducedMotion ? 0 : Math.sin(elapsed / 2300 + index * 1.9);
        const homeX = w * pose[0];
        const homeY = h * pose[1] + idle * 9;
        const homeScale = pose[2];
        const ringX = cx + Math.cos(angle) * rx;
        const ringY = cy + Math.sin(angle) * ry;
        const perspective = (0.47 + depth * 0.7) * (1 - cam.summary * 0.2);
        focusWeights.current[index] += (Number(focused) - focusWeights.current[index]) * ease;
        const focusScale = 1 + focusWeights.current[index] * 1.8 + (selectedIndex >= 0 ? 0.065 : 0);
        const scale = homeScale * (1 - cam.ring) + perspective * focusScale * cam.ring;
        const x = homeX * (1 - cam.ring) + ringX * cam.ring;
        const y = homeY * (1 - cam.ring) + ringY * cam.ring;
        const homeTilt = pose[3];
        const tilt = homeTilt * (1 - cam.ring) + Math.cos(angle) * (focused ? 5 : 12) * cam.ring;
        const intro = reducedMotion ? 1 : Math.min(1, Math.max(0, (elapsed - homeIndex * 45) / 1400));
        const introEase = 1 - Math.pow(1 - intro, 3);
        element.style.transform = `translate3d(${x + (1 - introEase) * w * 0.65}px, ${y + (1 - introEase) * h * 0.4}px, 0) translate(-50%, -50%) perspective(900px) rotateY(${Math.cos(angle) * cam.ring * 20}deg) rotateZ(${tilt}deg) scale(${scale})`;
        // Keep real depth order: raising selected cards can completely cover a neighbor.
        element.style.zIndex = String(focused ? 160 : zIndices[index]);
        element.style.opacity = String((index < 18 ? 1 : cam.ring) * introEase);
        element.style.pointerEvents = stage === "draw" && !paused ? "auto" : "none";
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [stage, deck, selected, active, paused, reducedMotion]);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (stage !== "draw" || paused || event.button !== 0) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, lastTime: event.timeStamp, directionDelta: 0, dragging: false };
    suppressClick.current = false;
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (!p.dragging && isRingDrag(p, { x: event.clientX, y: event.clientY })) {
      p.dragging = true;
      root.current?.setPointerCapture(event.pointerId);
      root.current?.classList.add("is-dragging");
    }
    if (p.dragging) {
      suppressClick.current = true;
      const bounds = root.current?.getBoundingClientRect();
      const projection = ringProjection.current;
      if (!bounds || !projection) return;
      const change = ringDragDelta(
        { x: p.lastX - bounds.left, y: p.lastY - bounds.top },
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        projection,
      );
      rotation.current += change;
      velocity.current = Math.max(-orbitMotion.maxReleaseSpeed, Math.min(orbitMotion.maxReleaseSpeed, change / Math.max(4, event.timeStamp - p.lastTime)));
      p.directionDelta += change;
      if (Math.abs(p.directionDelta) > 0.002) {
        idleDirection.current = Math.sign(p.directionDelta);
        p.directionDelta = 0;
      }
    }
    p.lastX = event.clientX;
    p.lastY = event.clientY;
    p.lastTime = event.timeStamp;
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.dragging) {
      event.preventDefault();
      if (reducedMotion || event.timeStamp - p.lastTime > 100) velocity.current = 0;
      if (root.current?.hasPointerCapture(event.pointerId)) root.current.releasePointerCapture(event.pointerId);
    }
    pointer.current = null;
    root.current?.classList.remove("is-dragging");
  }

  return <div className={`cosmic-scene ${stage === "draw" && !paused ? "can-draw" : ""}`} ref={root}
    data-testid="cosmic-scene" onPointerDown={down} onPointerMove={move} onPointerUp={up}
    onPointerCancel={() => { pointer.current = null; velocity.current = 0; root.current?.classList.remove("is-dragging"); }}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div className="cosmic-panorama" ref={background} />
    <div className="cosmic-track" ref={track} aria-hidden="true" />
    <div className="cosmic-deck" aria-label="星空中的塔罗牌">
      {deck.map(({ card, orientation }, index) => {
        const chosen = selected.findIndex((item) => item.anchor === index);
        const faceUp = stage === "reading" && active?.anchor === index;
        return <button key={index} ref={(node) => { cards.current[index] = node; }} type="button"
          className={`cosmic-card ${chosen >= 0 ? "is-selected" : ""} ${faceUp ? "is-face-up" : ""}`}
          data-testid={`orbit-card-${index}`} data-anchor={index} data-card-id={card.id} data-orientation={orientation}
          data-selected={chosen >= 0} aria-label={`选择第 ${index + 1} 张牌${chosen >= 0 ? `，已选为第 ${chosen + 1} 张` : ""}`}
          aria-pressed={chosen >= 0} disabled={stage !== "draw" || chosen >= 0 || paused}
          tabIndex={stage === "draw" && chosen < 0 && !paused ? 0 : -1}
          onClick={() => { if (!pointer.current?.dragging) onSelect(index); }}>
          {chosen >= 0 && <span className="cosmic-card-marker">{chosen + 1}</span>}
          <span className="cosmic-card-flipper">
            <span className="cosmic-card-back" />
            <span className="cosmic-card-front">
              {faceUp && <Image src={card.image} alt={`${card.nameCn} · ${orientation === "upright" ? "正位" : "逆位"}`} width={100} height={170} unoptimized draggable={false} style={{ transform: orientation === "reversed" ? "rotate(180deg)" : undefined }} />}
            </span>
          </span>
        </button>;
      })}
    </div>
  </div>;
}

export function CosmicExperience() {
  const [stage, setStage] = useState<Stage>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [spread, setSpread] = useState<CosmicSpread>(cosmicSpreads[2]);
  const [question, setQuestion] = useState("");
  const [deck, setDeck] = useState<DeckCard[]>(initialDeck);
  const [selected, setSelected] = useState<OrbitalSelection[]>([]);
  const [current, setCurrent] = useState(0);
  const [turning, setTurning] = useState(false);
  const [search, setSearch] = useState("");
  const [arcana, setArcana] = useState("all");
  const [encyclopediaCard, setEncyclopediaCard] = useState(tarotCards[0]);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [journals, setJournals] = useState<DemoJournal[]>([]);
  const [saved, setSaved] = useState(false);
  const [visitor, setVisitor] = useState("");
  const [visitorInput, setVisitorInput] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const reducedMotion = useReducedMotion();
  const active = selected[current];
  const card = active ? cardData(active.cardId) : undefined;
  const keywords = card && active ? (active.orientation === "upright" ? card.uprightKeywords : card.reversedKeywords) : [];

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (panel && !modal.open) modal.showModal();
    if (!panel && modal.open) modal.close();
  }, [panel]);

  useEffect(() => {
    const next: Partial<Record<Stage, Stage>> = { travel: "shuffle", shuffle: "draw", summarizing: "summary" };
    const nextStage = next[stage];
    if (!nextStage) return;
    const timer = setTimeout(() => setStage(nextStage), reducedMotion ? 180 : stage === "travel" ? 2200 : 1900);
    return () => clearTimeout(timer);
  }, [stage, reducedMotion]);

  useEffect(() => {
    if (stage !== "reading" || !turning) return;
    const timer = setTimeout(() => setTurning(false), reducedMotion ? 80 : 1600);
    return () => clearTimeout(timer);
  }, [stage, current, turning, reducedMotion]);

  function openPanel(next: Panel) {
    if (next === "history") setRecords(readReadingRecords());
    setPanel(next);
  }
  function home() { setPanel(null); setStage("home"); setSelected([]); setCurrent(0); setSaved(false); }
  function begin(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setDeck(shuffleDeck(tarotCards).map((item) => ({ card: item, orientation: randomOrientation() })));
    setSelected([]); setCurrent(0); setSaved(false); setPanel(null); setStage("travel");
  }
  function select(anchor: number) {
    if (stage !== "draw" || panel) return;
    const entry = deck[anchor];
    const next = selectOrbitalCard(selected, { anchor, cardId: entry.card.id, orientation: entry.orientation }, spread.slots.length);
    setSelected(next);
    if (next.length === spread.slots.length) { setTurning(true); setStage("reading"); }
  }
  function changeCard(index: number) { setCurrent(index); setTurning(true); }
  function saveDemo() {
    if (saved) return;
    setJournals((items) => [{ id: Date.now(), question: question.trim(), spread: spread.name, cards: [...selected] }, ...items]);
    setSaved(true);
  }
  const shownCards = tarotCards.filter((item) => (arcana === "all" || item.arcana === arcana) && `${item.nameCn} ${item.nameEn}`.toLowerCase().includes(search.toLowerCase()));

  return <main className={`cosmic-experience stage-${stage}`} data-testid="cosmic-experience" data-stage={stage}>
    <CosmicScene stage={stage} deck={deck} selected={selected} current={current} onSelect={select} paused={panel !== null} />
    <header className="cosmic-header">
      <button className="cosmic-brand" onClick={home} aria-label="命运回廊，返回首页" tabIndex={stage === "home" ? -1 : 0} aria-hidden={stage === "home"}><Orbit size={25} strokeWidth={1} /><span>命运回廊</span></button>
      {stage === "home" && <nav aria-label="主导航">
        <button onClick={() => openPanel("encyclopedia")}><BookOpen size={15} />塔罗百科</button>
        <button onClick={() => openPanel("history")}><History size={15} />历史记录</button>
        <span className="nav-divider" />
        <button onClick={() => openPanel("login")}><UserRound size={15} />{visitor || "登录"}</button>
      </nav>}
    </header>
    <AnimatePresence mode="wait">
      {stage === "home" && <motion.section className="cosmic-hero" key="home" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 1.1, delay: reducedMotion ? 0 : 0.7, ease: motionEase }}>
        <p className="cosmic-eyebrow">循星而来 · 向心而行</p>
        <h1>命运回廊</h1>
        <p className="cosmic-english">CORRIDOR OF FATE</p>
        <p className="cosmic-hero-copy">让未说出口的问题，在星光中找到回响。</p>
        <motion.button className="cosmic-primary hero-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reducedMotion ? 0 : 1.8 }} onClick={() => openPanel("prepare")}><Sparkles size={19} strokeWidth={1.2} />开始占卜<ArrowRight size={20} strokeWidth={1.2} /></motion.button>
      </motion.section>}
      {(stage === "travel" || stage === "shuffle") && <motion.section className="cosmic-status" key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <p className="cosmic-eyebrow">{stage === "travel" ? "步入星空深处" : "让此刻，重新交汇"}</p>
        <h2>{stage === "travel" ? "每个问题，都有一条来路" : "星轨正在排列"}</h2>
        <p>{stage === "travel" ? question : "静心片刻，等待属于你的牌。"}</p>
      </motion.section>}
      {stage === "draw" && <motion.section className="cosmic-draw-heading" key="draw" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <p className="cosmic-eyebrow">{spread.name} · {selected.length} / {spread.slots.length}</p>
        <h2>选择与你共鸣的牌</h2>
        <p>{question}</p>
        <ol className="cosmic-slots">{spread.slots.map((slot, index) => <li key={slot} className={index < selected.length ? "is-filled" : ""}><span>{index < selected.length ? <Check size={12} /> : index + 1}</span>{slot}</li>)}</ol>
        <p className="cosmic-next-slot" aria-live="polite">下一张 · {spread.slots[selected.length]}</p>
      </motion.section>}
      {stage === "reading" && card && active && <motion.section className="cosmic-reading" key="reading" initial={{ opacity: 0, x: 35 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 25 }} transition={{ duration: 0.85, delay: reducedMotion ? 0 : 0.55 }} aria-label="逐牌解读">
        <AnimatePresence mode="wait"><motion.div key={active.cardId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: reducedMotion ? 0 : 0.35 }}>
          <p className="cosmic-eyebrow">{spread.slots[current]} · 第 {current + 1} / {selected.length} 张</p>
          <h2>{card.nameCn}<span>· {active.orientation === "upright" ? "正位" : "逆位"}</span></h2>
          <p className="cosmic-card-english">{card.nameEn}</p>
          <span className="cosmic-sample-label">示例解读</span>
          <div className="cosmic-reading-section"><h3><Sparkles size={19} strokeWidth={1} />牌面含义</h3><p>{card.meaning}</p><div className="cosmic-keywords">{keywords.map((word) => <span key={word}>{word}</span>)}</div></div>
          <div className="cosmic-reading-section"><h3><Sparkles size={19} strokeWidth={1} />与你的问题</h3><p className="cosmic-question">“{question}”</p><p>把「{keywords[0]}」作为观察{spread.slots[current]}的一个角度：你现在最在意的是什么？试着写下一件可以主动确认或改变的小事。</p></div>
        </motion.div></AnimatePresence>
        <div className="cosmic-reading-controls"><button className="cosmic-secondary" disabled={current === 0 || turning} onClick={() => changeCard(current - 1)}><ArrowLeft size={16} />上一张</button>
          {current < selected.length - 1 ? <button className="cosmic-primary" disabled={turning} onClick={() => changeCard(current + 1)}>下一张<ArrowRight size={17} /></button> : <button className="cosmic-primary" disabled={turning} onClick={() => setStage("summarizing")}>查看整体解读<ArrowRight size={17} /></button>}</div>
      </motion.section>}
      {stage === "summarizing" && <motion.section className="cosmic-status" key="summarizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><p className="cosmic-eyebrow">让散落的星光，连成答案</p><h2>回望这一路的线索</h2></motion.section>}
      {stage === "summary" && <motion.section key="summary" className="cosmic-summary" initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <div className="cosmic-summary-title"><p className="cosmic-eyebrow">{spread.name} · 此刻的回响</p><h2>命运手记</h2><span className="cosmic-sample-label">示例总结 · 仅供体验</span><p>“{question}”</p></div>
        <div className="cosmic-summary-cards">{selected.map((item, index) => { const data = cardData(item.cardId); return <button key={item.cardId} onClick={() => { changeCard(index); setStage("reading"); }}><Image src={data.image} alt={data.nameCn} width={100} height={170} unoptimized style={{ transform: item.orientation === "reversed" ? "rotate(180deg)" : undefined }} /><span>{spread.slots[index]}</span><strong>{data.nameCn} · {item.orientation === "upright" ? "正位" : "逆位"}</strong></button>; })}</div>
        <div className="cosmic-summary-prose"><h3>把线索，带回生活</h3><p>从「{cardData(selected[0].cardId).nameCn}」出发，依次回望{spread.slots.join("、")}。把每张牌引起的感受写下来，区分你已经知道的事实、尚未确认的猜测，以及可以采取的行动。</p><p>这份手记展示牌义与自我提问的组合。它尚未生成针对这个问题的 AI 整体分析。</p></div>
        <div className="cosmic-summary-actions"><button className="cosmic-secondary" onClick={saveDemo} disabled={saved}>{saved ? <Check size={16} /> : <BookOpen size={16} />}{saved ? "已保存本次示例" : "保存示例手记"}</button><button className="cosmic-primary" onClick={() => { home(); openPanel("prepare"); }}>再次占卜<ArrowRight size={17} /></button></div>
        <p className="cosmic-small-note">示例手记仅保留在本次浏览中。</p>
      </motion.section>}
    </AnimatePresence>
    <footer className="cosmic-footer"><span>THE STARS GUIDE. YOU DECIDE.</span><span>{stage === "home" ? "一段通往内心的旅程" : spread.name}</span></footer>

    <dialog ref={dialog} aria-label={panel === "prepare" ? "占卜准备" : panel === "encyclopedia" ? "塔罗百科" : panel === "history" ? "历史记录" : "演示登录"} className={`cosmic-dialog ${panel === "encyclopedia" ? "is-wide" : ""}`} onCancel={() => setPanel(null)} onClick={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
      <div className="cosmic-dialog-content"><button className="cosmic-close" aria-label="关闭面板" onClick={() => setPanel(null)}><X size={21} strokeWidth={1.2} /></button>
        {panel === "prepare" && <form onSubmit={begin}><p className="cosmic-eyebrow">在星轨开启之前</p><h2>让心中的问题，有一个形状</h2><p className="cosmic-dialog-intro">选一个适合此刻的牌阵，再写下你想探索的事。</p><fieldset className="cosmic-spread-options"><legend>选择牌阵</legend>{cosmicSpreads.map((item) => <button key={item.id} type="button" className={spread.id === item.id ? "is-active" : ""} aria-pressed={spread.id === item.id} onClick={() => setSpread(item)}><span>{item.name}</span><small>{item.slots.length} 张</small></button>)}</fieldset>
          <div className="cosmic-spread-detail"><strong>{spread.subtitle}</strong><p>{spread.slots.map((slot, index) => `${index + 1}. ${slot}`).join("　·　")}</p></div>
          <label className="cosmic-question-label" htmlFor="cosmic-question">你想问星空什么？</label><textarea id="cosmic-question" required maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="此刻，有什么问题萦绕在你心中……" rows={3} />
          <div className="cosmic-form-bottom"><span>{question.length} / 500</span><button type="submit" className="cosmic-primary" disabled={!question.trim()}>开启星轨<ArrowRight size={18} /></button></div><p className="cosmic-small-note">当前为前端体验版，牌阵位置暂按草案呈现，解读为示例内容。</p></form>}
        {panel === "encyclopedia" && <section><p className="cosmic-eyebrow">沿着图像，读懂象征</p><h2>塔罗百科</h2><div className="cosmic-encyclopedia-tools"><label><Search size={17} /><input aria-label="搜索塔罗牌" placeholder="搜索中文或英文牌名" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="筛选阿尔卡那" value={arcana} onChange={(event) => setArcana(event.target.value)}><option value="all">全部 78 张</option><option value="major">大阿尔卡那</option><option value="minor">小阿尔卡那</option></select></div>
          <div className="cosmic-encyclopedia-layout"><div className="cosmic-encyclopedia-list" aria-label="牌名目录">{shownCards.length ? shownCards.map((item) => <button key={item.id} onClick={() => setEncyclopediaCard(item)} className={encyclopediaCard.id === item.id ? "is-active" : ""}><span>{item.nameCn}<small>{item.nameEn}</small></span><ChevronRight size={15} /></button>) : <p>没有找到这张牌，换个名字试试。</p>}</div><article className="cosmic-encyclopedia-detail"><Image src={encyclopediaCard.image} alt={encyclopediaCard.nameCn} width={160} height={275} unoptimized /><div><p className="cosmic-eyebrow">{encyclopediaCard.arcana === "major" ? "大阿尔卡那" : "小阿尔卡那"}</p><h3>{encyclopediaCard.nameCn}</h3><p className="cosmic-card-english">{encyclopediaCard.nameEn}</p><p>{encyclopediaCard.meaning}</p><h4>正位关键词</h4><p>{encyclopediaCard.uprightKeywords.join(" · ")}</p><h4>逆位关键词</h4><p>{encyclopediaCard.reversedKeywords.join(" · ")}</p></div></article></div></section>}
        {panel === "history" && <section><p className="cosmic-eyebrow">曾经停留的星光</p><h2>历史记录</h2><p className="cosmic-dialog-intro">旧版保存的手记与本次浏览中的示例。</p>{!records.length && !journals.length ? <div className="cosmic-empty"><History size={34} strokeWidth={1} /><h3>还没有留下手记</h3><p>完成一次占卜后，可以在这里回望。</p></div> : <div className="cosmic-history-list">{journals.map((item) => <article key={item.id}><span className="cosmic-sample-label">本次浏览 · 示例</span><h3>{item.question}</h3><p>{item.spread} · {item.cards.map((entry) => cardData(entry.cardId).nameCn).join("、")}</p></article>)}{records.map((item) => <article key={item.id}><p className="cosmic-eyebrow">{new Date(item.createdAt).toLocaleDateString("zh-CN")} · 旧版手记</p><h3>{item.question}</h3><p>{item.summary}</p><details><summary>展开 {item.spread.length} 张牌的解读</summary>{item.spread.map((entry) => <div key={entry.position}><h4>{cardData(entry.cardId).nameCn} · {entry.orientation === "upright" ? "正位" : "逆位"}</h4><p>{entry.interpretation}</p></div>)}</details></article>)}</div>}</section>}
        {panel === "login" && <section><p className="cosmic-eyebrow">为这段旅程，留下名字</p><h2>{visitor ? `你好，${visitor}` : "遇见星空中的自己"}</h2><p className="cosmic-dialog-intro">演示身份仅在本次浏览中生效。</p>{visitor ? <div className="cosmic-login"><UserRound size={38} strokeWidth={1} /><p>你正在以「{visitor}」的身份探索命运回廊。</p><button className="cosmic-secondary" onClick={() => { setVisitor(""); setVisitorInput(""); }}>退出演示身份</button></div> : <form className="cosmic-login" onSubmit={(event) => { event.preventDefault(); if (visitorInput.trim()) { setVisitor(visitorInput.trim()); setPanel(null); } }}><label htmlFor="cosmic-visitor">怎么称呼你？</label><input id="cosmic-visitor" autoComplete="nickname" value={visitorInput} maxLength={20} required placeholder="你的昵称" onChange={(event) => setVisitorInput(event.target.value)} /><button className="cosmic-primary" disabled={!visitorInput.trim()}>以此身份进入<ArrowRight size={17} /></button></form>}</section>}
      </div>
    </dialog>
  </main>;
}
