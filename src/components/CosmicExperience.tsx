"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, History, Orbit, Search, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CosmicQuestion } from "@/components/CosmicQuestion";
import { cosmicCardBackSrc } from "@/lib/cosmic-assets";
import { tarotCards, tarotCardMap } from "@/data/tarotCards";
import { advanceOrbitMotion, applyReadingDragResistance, cosmicSpreads, homeCardStream, homeStreamPose, isRingDrag, nearestRotation, orbitMotion, readingArrivalPose, readingDragInputForPose, readingDragSensitivity, readingIdleMotion, readingIdlePose, readingPresentationMotion, resumeReadingPose, reverseStreamExtraTime, ringDragDelta, selectOrbitalCard, type CosmicSpread, type OrbitalSelection, type RingProjection } from "@/lib/cosmic-experience";
import { shuffleDeck, randomOrientation } from "@/lib/tarot-random";
import { readReadingRecords } from "@/lib/storage";
import type { TarotCardData, CardOrientation } from "@/types/tarot";
import type { ReadingRecord } from "@/types/reading";
import type { CosmicBackdrop } from "@/lib/cosmic-three-backdrop";
import { cameraTravelProgress, reverseCameraDurationMs } from "@/lib/cosmic-space-camera";
import { CosmicRingEntry, ringEntryMotion } from "@/lib/cosmic-ring-entry";
import "./cosmic-fonts.css";
import "./cosmic-experience.css";

type Stage = "home" | "reversing" | "prepare" | "returning" | "travel" | "draw" | "reading" | "summarizing" | "summary";
type Panel = "encyclopedia" | "history" | "login" | null;
interface DeckCard { card: TarotCardData; orientation: CardOrientation }
interface DemoJournal { id: number; question: string; spread: string; cards: OrbitalSelection[] }
interface ReadingPoseState {
  yaw: number; pitch: number; ready: boolean; idleOrigin: number;
  resume: { at: number; timelineMs: number; fromYaw: number; fromPitch: number } | null;
  hold: { id: number; anchor: number; x: number; y: number; lastX: number; lastY: number; since: number; capturedAt: number | null; rawYaw: number; rawPitch: number } | null;
}

const motionEase = [0.22, 1, 0.36, 1] as const;
const readingArrivalMs = readingPresentationMotion.arrivalMs;
const initialDeck: DeckCard[] = tarotCards.map((card) => ({ card, orientation: "upright" }));
const newDeck = (): DeckCard[] => shuffleDeck(tarotCards).map((card) => ({ card, orientation: randomOrientation() }));
const cardData = (id: string) => tarotCardMap.get(id)!;

function CosmicScene({ stage, deck, selected, current, onSelect, paused, onReady, onEntryComplete }: {
  stage: Stage; deck: DeckCard[]; selected: OrbitalSelection[]; current: number;
  onSelect: (anchor: number) => void; paused: boolean; onReady: (ready: boolean) => void;
  onEntryComplete: (stage: "draw") => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const background = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const rotation = useRef(-0.4);
  const ringProjection = useRef<RingProjection | null>(null);
  const camera = useRef<{ ring: number; reading: number; summary: number; travel: number; reverse: number; dive?: number }>({ ring: 0, reading: 0, summary: 0, travel: 0, reverse: 0 });
  const entry = useRef<CosmicRingEntry | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number; lastX: number; lastY: number; lastTime: number; directionDelta: number; dragging: boolean } | null>(null);
  const velocity = useRef(0);
  const idleDirection = useRef(1);
  const previousFrameTime = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const sceneStart = useRef<number | null>(null);
  const homeElapsed = useRef(0);
  const focusWeights = useRef<number[]>(Array(78).fill(0));
  const readingPose = useRef<ReadingPoseState>({ yaw: 0, pitch: 0, ready: false, idleOrigin: 0, resume: null, hold: null });
  const spaceHost = useRef<HTMLDivElement>(null);
  const space = useRef<CosmicBackdrop | null>(null);
  const deckRef = useRef(deck);
  const notifiedReady = useRef(false);
  const reducedMotion = useReducedMotion();
  const active = selected[current];

  useEffect(() => { deckRef.current = deck; space.current?.setDeck(deck); }, [deck]);

  useEffect(() => {
    const host = spaceHost.current;
    if (!host) return;
    let cancelled = false;
    import("@/lib/cosmic-three-backdrop").then(({ createCosmicBackdrop }) => {
      if (!cancelled) { space.current = createCosmicBackdrop(host); space.current.setDeck(deckRef.current); }
    }).catch(() => { if (!cancelled) { host.dataset.renderer = "fallback"; host.dataset.streamReady = "true"; } });
    return () => { cancelled = true; space.current?.dispose(); space.current = null; };
  }, []);

  useEffect(() => {
    const surface = root.current;
    if (!surface) return;
    let frame = 0;
    const arrivalStart = performance.now();
    if (stage === "travel") entry.current = new CosmicRingEntry(homeElapsed.current);
    if (stage === "home" || (stage === "reversing" && entry.current)) {
      entry.current = null;
      camera.current = { ring: 0, reading: 0, summary: 0, travel: 0, reverse: 0 };
    }
    let entryComplete = false;
    let previousStreamExtra = 0;
    const readingButton = stage === "reading" && active ? cards.current[active.anchor] : null;
    const poseNode = readingButton?.querySelector<HTMLElement>(".cosmic-card-pose");
    if (readingButton) readingPose.current = { yaw: 0, pitch: 0, ready: false, idleOrigin: arrivalStart + readingArrivalMs - readingPresentationMotion.idleLeadMs, resume: null, hold: null };
    const revealClock = stage === "reading" && active
      ? cards.current[active.anchor]?.querySelector(".cosmic-card-flipper")?.getAnimations().find((animation) => animation instanceof CSSTransition && animation.transitionProperty === "transform")
      : undefined;
    const fromCamera = { ...camera.current };
    const fromFocus = [...focusWeights.current];
    const fromRotation = rotation.current;
    const readingRotation = active ? nearestRotation(fromRotation, active.anchor, deck.length) : fromRotation;
    const render = (now: number) => {
      const frameElapsed = Math.max(0, now - (previousFrameTime.current ?? now));
      const delta = Math.min(frameElapsed, 100);
      previousFrameTime.current = now;
      if (sceneStart.current === null) sceneStart.current = now;
      const elapsed = now - sceneStart.current;
      const w = surface.clientWidth;
      const h = surface.clientHeight;
      const reading = stage === "reading" || stage === "summarizing" || stage === "summary";
      const streamStage = ["home", "reversing", "prepare", "returning"].includes(stage);
      const ring = !streamStage;
      const summary = stage === "summarizing" || stage === "summary";
      const cam = camera.current;
      const entryElapsed = stage === "travel" ? reducedMotion ? ringEntryMotion.durationMs : now - arrivalStart : 0;
      const entryState = stage === "travel" ? entry.current?.state(entryElapsed) : null;
      const ease = reducedMotion ? 1 : 1 - Math.exp(-delta / 650);
      if (stage === "reversing" || stage === "returning") {
        const progress = reducedMotion ? 1 : cameraTravelProgress(now - arrivalStart);
        cam.reverse = fromCamera.reverse + (Number(stage === "reversing") - fromCamera.reverse) * progress;
      } else if (streamStage) cam.reverse = stage === "prepare" ? 1 : 0;
      else cam.reverse += (0 - cam.reverse) * ease;
      // Use the flip transition's clock so a late RAF cannot desynchronize the approach.
      const arrivalElapsed = typeof revealClock?.currentTime === "number" ? revealClock.currentTime : now - arrivalStart;
      const arrival = reducedMotion ? 1 : Math.min(1, Math.max(0, arrivalElapsed) / readingArrivalMs);
      const approach = 1 - (1 - arrival) ** 3;
      const readingElapsed = now - (typeof revealClock?.startTime === "number" ? revealClock.startTime : arrivalStart);
      if (stage === "reading") {
        // Camera, ring and enlargement arrive together with the card's CSS reveal.
        cam.ring = fromCamera.ring + (1 - fromCamera.ring) * approach;
        cam.reading = fromCamera.reading + (1 - fromCamera.reading) * approach;
        cam.summary = fromCamera.summary * (1 - approach);
        cam.travel = fromCamera.travel * (1 - approach);
      } else {
        cam.ring += (Number(ring) - cam.ring) * ease;
        cam.reading += (Number(reading) - cam.reading) * ease;
        cam.summary += (Number(summary) - cam.summary) * ease;
        cam.travel += (Number(stage === "travel") - cam.travel) * ease;
      }
      if (entryState) { cam.dive = entryState.camera; cam.ring = 1; cam.reverse = 0; }
      // One clock continues through the first camera move and all time spent writing the question.
      const streamExtra = stage === "reversing" && !reducedMotion ? reverseStreamExtraTime(now - arrivalStart, reverseCameraDurationMs) : 0;
      if (streamStage && !reducedMotion) homeElapsed.current += frameElapsed + streamExtra - previousStreamExtra;
      previousStreamExtra = streamExtra;
      surface.dataset.streamTransitionExtra = streamExtra.toFixed(2);
      if (stage === "reading" && active) {
        velocity.current = 0;
        rotation.current = fromRotation + (readingRotation - fromRotation) * approach;
      } else if (entryState) {
        idleDirection.current = 1;
        rotation.current = entryState.rotation; velocity.current = entryState.speed;
      } else if (stage === "draw") {
        if (paused || reducedMotion) {
          velocity.current = 0;
        } else if (!pointer.current?.dragging) {
          const target = orbitMotion.idleSpeed * idleDirection.current;
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
      space.current?.render(cam, w, h, homeElapsed.current, entryState && entry.current ? { queue: entry.current, elapsed: entryElapsed } : undefined);
      if (!notifiedReady.current && spaceHost.current?.dataset.streamReady === "true") {
        notifiedReady.current = true; onReady(true);
      }
      const meshStream = spaceHost.current?.dataset.renderer === "webgl" && spaceHost.current.dataset.streamRenderer === "mesh";
      surface.dataset.streamRenderer = meshStream ? "mesh" : "fallback";
      const homePoses = Array.from({ length: homeCardStream.count }, (_, index) => homeStreamPose(index, homeElapsed.current, w / h));
      const spatialCards = space.current?.ring.layout(meshStream ? cam : { ...cam, dive: undefined }, w, h, rotation.current, homePoses);
      surface.dataset.ringSpace = spatialCards ? "world" : "loading";
      surface.dataset.streamSpace = spatialCards ? "world" : "fallback";
      const cx = w * (0.5 - cam.reading * 0.16 + cam.summary * 0.16);
      const cy = h * (0.60 - cam.reading * 0.22 + cam.summary * 0.07);
      const rx = w * (0.405 - cam.reading * 0.065 - cam.summary * 0.08);
      const ry = h * (0.18 + cam.reading * 0.07 - cam.summary * 0.07);
      ringProjection.current = { cx, cy, rx, ry };
      const depths = deck.map((_, index) => spatialCards?.[index].depth ?? (Math.sin(index / deck.length * Math.PI * 2 + rotation.current) + 1) / 2);
      const homeSize = Math.min(w / 1440, h / 900);
      const homeDepthWeight = cam.ring < 0.99 ? 1 - cam.ring : 0;
      const displayDepths = depths.map((depth, index) => spatialCards ? depth : homePoses[index % homeCardStream.count].progress * homeDepthWeight + depth * (1 - homeDepthWeight));
      const depthOrder = deck.map((_, index) => index).sort((a, b) => displayDepths[a] - displayDepths[b]);
      const zIndices = new Array<number>(deck.length);
      depthOrder.forEach((index, rank) => { zIndices[index] = rank; });
      deck.forEach((_, index) => {
        const element = cards.current[index];
        if (!element) return;
        const angle = index / deck.length * Math.PI * 2 + rotation.current;
        const depth = depths[index];
        const selectedIndex = selected.findIndex((item) => item.anchor === index);
        const focused = stage === "reading" && active?.anchor === index;
        const pose = homePoses[index % homeCardStream.count];
        const homeX = w * pose.x;
        const homeY = h * pose.y;
        const homeScale = pose.scale * homeSize;
        const ringX = spatialCards?.[index].x ?? cx + Math.cos(angle) * rx;
        const ringY = spatialCards?.[index].y ?? cy + Math.sin(angle) * ry;
        const perspective = spatialCards?.[index].scale ?? (0.47 + depth * 0.7) * (1 - cam.summary * 0.2);
        focusWeights.current[index] = stage === "reading"
          ? fromFocus[index] + (Number(focused) - fromFocus[index]) * approach
          : focusWeights.current[index] + (Number(focused) - focusWeights.current[index]) * ease;
        const focusScale = 1 + focusWeights.current[index] * 1.8 + (selectedIndex >= 0 ? 0.065 : 0);
        const scale = spatialCards ? perspective * (1 + (focusScale - 1) * cam.ring) : homeScale * (1 - cam.ring) + perspective * focusScale * cam.ring;
        const x = spatialCards ? ringX : homeX * (1 - cam.ring) + ringX * cam.ring;
        const y = spatialCards ? ringY : homeY * (1 - cam.ring) + ringY * cam.ring;
        const homeTilt = pose.tilt;
        const tilt = homeTilt * (1 - cam.ring) + Math.cos(angle) * (12 - focusWeights.current[index] * 7) * cam.ring;
        const intro = reducedMotion ? 1 : Math.min(1, elapsed / 1000);
        const introEase = 1 - Math.pow(1 - intro, 3);
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) perspective(${900 - focusWeights.current[index] * 520}px) rotateY(${Math.cos(angle) * cam.ring * 20 * (1 - focusWeights.current[index])}deg) rotateZ(${tilt}deg) scale(${scale})`;
        // Keep real depth order: raising selected cards can completely cover a neighbor.
        element.style.zIndex = String(focused ? 160 : zIndices[index]);
        // A partially transparent parent flattens its 3D children during the reveal.
        element.style.opacity = focused ? "1" : String((meshStream ? streamStage || stage === "travel" ? 0 : cam.ring : index < homeCardStream.count ? pose.opacity * (1 - cam.ring) + cam.ring : cam.ring) * introEase);
        element.style.pointerEvents = (stage === "draw" || focused) && !paused ? "auto" : "none";
      });
      if (poseNode) {
        const state = readingPose.current;
        state.ready = arrival >= 1;
        const idleElapsed = Math.max(0, readingElapsed - readingArrivalMs + readingPresentationMotion.idleLeadMs);
        state.idleOrigin = now - idleElapsed;
        if (state.resume && now - state.resume.at >= readingIdleMotion.returnMs) state.resume = null;
        let pose = reducedMotion ? { yaw: state.yaw, pitch: state.pitch, turning: false }
          : arrival < 1 ? readingArrivalPose(readingElapsed)
          : state.resume ? resumeReadingPose(now - state.resume.at, state.resume.timelineMs, state.resume.fromYaw, state.resume.fromPitch)
          : readingIdlePose(idleElapsed);
        const hold = state.hold;
        if (hold && hold.capturedAt === null && !state.resume && !pose.turning && now - hold.since >= readingIdleMotion.holdMs) {
          hold.capturedAt = now;
          state.yaw = pose.yaw; state.pitch = pose.pitch;
          const input = readingDragInputForPose(pose.yaw, pose.pitch);
          hold.rawYaw = input.yaw; hold.rawPitch = input.pitch;
          hold.lastX = hold.x; hold.lastY = hold.y;
        }
        if (hold && hold.capturedAt !== null) {
          hold.rawYaw += (hold.x - hold.lastX) * readingDragSensitivity;
          hold.rawPitch -= (hold.y - hold.lastY) * readingDragSensitivity;
          pose = { ...applyReadingDragResistance(hold.rawYaw, hold.rawPitch), turning: false };
          hold.lastX = hold.x; hold.lastY = hold.y;
        }
        state.yaw = pose.yaw; state.pitch = pose.pitch;
        // One Y angle drives the sway and the full turn; there is no reset between them.
        poseNode.style.transition = "none";
        poseNode.style.transform = `rotateX(${pose.pitch}deg) rotateY(${pose.yaw}deg)`;
      }
      if (stage === "travel" && entryElapsed >= ringEntryMotion.durationMs && (!reducedMotion || now - arrivalStart >= 180) && !entryComplete) {
        entryComplete = true; onEntryComplete("draw");
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      if (readingButton) {
        const hold = readingPose.current.hold;
        readingPose.current.hold = null;
        readingPose.current.ready = false;
        if (hold && readingButton.hasPointerCapture(hold.id)) readingButton.releasePointerCapture(hold.id);
        readingButton.classList.remove("is-card-held");
        poseNode?.style.removeProperty("transition");
        poseNode?.style.removeProperty("transform");
      }
    };
  }, [stage, deck, selected, active, paused, reducedMotion, onReady, onEntryComplete]);

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
      const dragPrevious = { x: p.lastX - bounds.left, y: p.lastY - bounds.top };
      const dragNext = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const change = space.current ? space.current.ring.dragDelta(dragPrevious, dragNext) : ringDragDelta(
        dragPrevious,
        dragNext,
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

  function startCardDrag(event: PointerEvent<HTMLButtonElement>, anchor: number) {
    if (stage !== "reading" || active?.anchor !== anchor || paused || event.button !== 0 || !readingPose.current.ready) return;
    event.preventDefault(); event.stopPropagation();
    const state = readingPose.current;
    const recapture = state.resume !== null;
    const input = recapture ? readingDragInputForPose(state.yaw, state.pitch) : { yaw: 0, pitch: 0 };
    // A return is interruptible: grab the currently displayed pose without waiting or resetting its clock.
    if (recapture) state.resume = null;
    state.hold = { id: event.pointerId, anchor, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, since: event.timeStamp, capturedAt: recapture ? event.timeStamp : null, rawYaw: input.yaw, rawPitch: input.pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("is-card-held");
  }
  function moveCardDrag(event: PointerEvent<HTMLButtonElement>) {
    const hold = readingPose.current.hold;
    if (!hold || hold.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    hold.x = event.clientX; hold.y = event.clientY;
  }
  function endCardDrag(event: PointerEvent<HTMLButtonElement>) {
    const state = readingPose.current, hold = state.hold;
    if (!hold || hold.id !== event.pointerId || String(hold.anchor) !== event.currentTarget.dataset.anchor) return;
    event.stopPropagation();
    if (hold.capturedAt !== null && !reducedMotion) {
      state.resume = { at: event.timeStamp, timelineMs: Math.max(0, event.timeStamp - state.idleOrigin), fromYaw: state.yaw, fromPitch: state.pitch };
    }
    state.hold = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.classList.remove("is-card-held");
  }

  return <div className={`cosmic-scene ${stage === "draw" && !paused ? "can-draw" : ""}`} ref={root}
    data-testid="cosmic-scene" onPointerDown={down} onPointerMove={move} onPointerUp={up}
    onPointerCancel={() => { pointer.current = null; velocity.current = 0; root.current?.classList.remove("is-dragging"); }}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div className="cosmic-panorama" ref={background} />
    <div className="cosmic-space" ref={spaceHost} data-testid="cosmic-space" aria-hidden="true" />
    <div className="cosmic-deck" aria-label="星空中的塔罗牌">
      {deck.map(({ card, orientation }, index) => {
        const chosen = selected.findIndex((item) => item.anchor === index);
        const faceUp = stage === "reading" && active?.anchor === index;
        return <button key={index} ref={(node) => { cards.current[index] = node; }} type="button"
          className={`cosmic-card ${chosen >= 0 ? "is-selected" : ""} ${faceUp ? "is-face-up" : ""}`}
          data-testid={`orbit-card-${index}`} data-anchor={index} data-card-id={card.id} data-orientation={orientation}
          data-selected={chosen >= 0} aria-label={faceUp ? `${card.nameCn}牌面，按住可转动` : `选择第 ${index + 1} 张牌${chosen >= 0 ? `，已选为第 ${chosen + 1} 张` : ""}`}
          aria-pressed={chosen >= 0} disabled={paused || (!faceUp && (stage !== "draw" || chosen >= 0))}
          tabIndex={stage === "draw" && chosen < 0 && !paused ? 0 : -1}
          onPointerDown={(event) => startCardDrag(event, index)} onPointerMove={moveCardDrag} onPointerUp={endCardDrag} onPointerCancel={endCardDrag} onLostPointerCapture={endCardDrag}
          onClick={() => { if (!pointer.current?.dragging) onSelect(index); }}>
          {chosen >= 0 && <span className="cosmic-card-marker">{chosen + 1}</span>}
          <span className="cosmic-card-pose"><span className="cosmic-card-flipper">
            <span className="cosmic-card-back" />
            <span className="cosmic-card-front">
              {chosen >= 0 && <Image src={card.image} alt={`${card.nameCn} · ${orientation === "upright" ? "正位" : "逆位"}`} width={100} height={170} unoptimized draggable={false} style={{ transform: orientation === "reversed" ? "rotate(180deg)" : undefined }} />}
            </span>
          </span></span>
        </button>;
      })}
    </div>
  </div>;
}

function SummaryView({ spread, selected, question, saved, scrollPositionRef, onReview, onSave, onRestart, reducedMotion }: {
  spread: CosmicSpread; selected: OrbitalSelection[]; question: string; saved: boolean;
  scrollPositionRef: { current: number }; onReview: (index: number) => void; onSave: () => void; onRestart: () => void;
  reducedMotion: boolean | null;
}) {
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (body.current) body.current.scrollTop = scrollPositionRef.current;
    heading.current?.focus({ preventScroll: true });
  }, [scrollPositionRef]);
  const first = selected[0], last = selected[selected.length - 1];
  const keyword = (item: OrbitalSelection) => {
    const data = cardData(item.cardId);
    return (item.orientation === "upright" ? data.uprightKeywords : data.reversedKeywords)[0];
  };
  return <motion.section className="cosmic-summary" aria-label="整体总结" initial={reducedMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.7, ease: motionEase }}>
    <section className="cosmic-summary-overview" aria-label="本次牌组">
      <div className="cosmic-summary-overview-title"><p className="cosmic-eyebrow">{spread.name} · {selected.length} 张牌</p><h3>回望本次星轨</h3></div>
      <div className="cosmic-summary-cards" data-count={selected.length}>{selected.map((item, index) => {
        const data = cardData(item.cardId);
        return <button key={item.cardId} aria-label={`回看${spread.slots[index]}：${data.nameCn}，${item.orientation === "upright" ? "正位" : "逆位"}`} onClick={() => onReview(index)}>
          <span className="cosmic-summary-position">{String(index + 1).padStart(2, "0")} · {spread.slots[index]}</span>
          <Image src={data.image} alt={data.nameCn} width={170} height={290} unoptimized style={{ transform: item.orientation === "reversed" ? "rotate(180deg)" : undefined }} />
          <strong>{data.nameCn}</strong><small>{item.orientation === "upright" ? "正位" : "逆位"}</small>
        </button>;
      })}</div>
      <p className="cosmic-summary-review-hint">选择任意一张牌，回看逐牌解读</p>
    </section>
    <div className="cosmic-summary-reading">
      <header className="cosmic-summary-title"><p className="cosmic-eyebrow">此刻的回响</p><div><h2 ref={heading} tabIndex={-1}>命运手记</h2><span className="cosmic-sample-label">示例总结 · 仅供体验</span></div></header>
      <div ref={body} className="cosmic-summary-body" role="region" aria-label="整体分析正文" tabIndex={0} onScroll={(event) => { scrollPositionRef.current = event.currentTarget.scrollTop; }}>
        <div className="cosmic-summary-question"><span>你此刻的问题</span><p>“{question}”</p></div>
        <section className="cosmic-summary-prose"><h3>整体脉络</h3><p>{selected.length === 1 ? `这张「${cardData(first.cardId).nameCn}」对应${spread.slots[0]}。` : `从「${spread.slots[0]}」到「${spread.slots[selected.length - 1]}」，这 ${selected.length} 张牌组成了本次回顾的线索。`}先留意牌面引起的感受，再回到已经发生的事实，看看哪些部分与你的处境有关。</p></section>
        <section className="cosmic-summary-prose"><h3>{selected.length === 1 ? "值得留意的线索" : "牌与牌的联系"}</h3><p>{selected.length === 1 ? `以「${keyword(first)}」作为一个观察角度：` : `把「${keyword(first)}」与「${keyword(last)}」放在一起观察：`}哪些感受彼此呼应，哪些判断还需要确认？牌面可以帮助整理想法，具体答案仍需要结合你掌握的信息。</p><div className="cosmic-summary-themes">{selected.map((item, index) => <span key={item.cardId}>{spread.slots[index]}<strong>{keyword(item)}</strong></span>)}</div></section>
        <section className="cosmic-summary-prose"><h3>把线索，带回生活</h3><ol><li>写下一件与问题有关、已经发生的事实。</li><li>找出一个尚未证实、值得进一步确认的判断。</li><li>选一件今天就能开始的小事，作为下一步行动。</li></ol></section>
        <p className="cosmic-summary-reflection">如果只带走一个提醒，你希望它是什么？</p>
      </div>
      <footer className="cosmic-summary-footer"><div className="cosmic-summary-actions"><button className="cosmic-secondary" onClick={onSave} disabled={saved}>{saved ? <Check size={16} /> : <BookOpen size={16} />}{saved ? "已保存本次示例" : "保存示例手记"}</button><button className="cosmic-primary" onClick={onRestart}>再次占卜<ArrowRight size={17} /></button></div><p className="cosmic-small-note" aria-live="polite">示例手记仅保留在本次浏览中。</p></footer>
    </div>
  </motion.section>;
}

export function CosmicExperience() {
  const [stage, setStage] = useState<Stage>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [spread, setSpread] = useState<CosmicSpread>(cosmicSpreads[2]);
  const [question, setQuestion] = useState("");
  const [deck, setDeck] = useState<DeckCard[]>(initialDeck);
  const [sceneReady, setSceneReady] = useState(false);
  const [selected, setSelected] = useState<OrbitalSelection[]>([]);
  const [current, setCurrent] = useState(0);
  const [turning, setTurning] = useState(false);
  const [search, setSearch] = useState("");
  const [arcana, setArcana] = useState("all");
  const [encyclopediaCard, setEncyclopediaCard] = useState(tarotCards[0]);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [journals, setJournals] = useState<DemoJournal[]>([]);
  const [saved, setSaved] = useState(false);
  const [reviewingSummary, setReviewingSummary] = useState(false);
  const summaryScroll = useRef(0);
  const [visitor, setVisitor] = useState("");
  const [visitorInput, setVisitorInput] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const reducedMotion = useReducedMotion();
  const active = selected[current];
  const card = active ? cardData(active.cardId) : undefined;
  const keywords = card && active ? (active.orientation === "upright" ? card.uprightKeywords : card.reversedKeywords) : [];

  useEffect(() => {
    // Randomize once after hydration, before the scene's resources enable Start. Submitting never reshuffles.
    const frame = requestAnimationFrame(() => setDeck(newDeck()));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (stage !== "prepare") return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.isComposing) setStage("returning"); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [stage]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (panel && !modal.open) modal.showModal();
    if (!panel && modal.open) modal.close();
  }, [panel]);

  useEffect(() => {
    const next: Partial<Record<Stage, Stage>> = { reversing: "prepare", returning: "home", summarizing: "summary" };
    const nextStage = next[stage];
    if (!nextStage) return;
    const duration = stage === "reversing" || stage === "returning" ? reverseCameraDurationMs : 1900;
    const timer = setTimeout(() => setStage(nextStage), reducedMotion ? 180 : duration);
    return () => clearTimeout(timer);
  }, [stage, reducedMotion]);

  useEffect(() => {
    if (stage !== "reading" || !turning) return;
    const timer = setTimeout(() => setTurning(false), reducedMotion ? 80 : readingArrivalMs);
    return () => clearTimeout(timer);
  }, [stage, current, turning, reducedMotion]);

  function openPanel(next: Panel) {
    if (next === "history") setRecords(readReadingRecords());
    setPanel(next);
  }
  function home() {
    if (stage === "reversing" || stage === "returning") return;
    if (stage === "prepare") { setStage("returning"); return; }
    if (stage !== "home") setDeck(newDeck());
    setPanel(null); setStage("home"); setSelected([]); setCurrent(0); setSaved(false); setReviewingSummary(false); summaryScroll.current = 0;
  }
  function begin() {
    if (!question.trim() || stage !== "prepare") return;
    setSelected([]); setCurrent(0); setSaved(false); setReviewingSummary(false); summaryScroll.current = 0; setPanel(null); setStage("travel");
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

  return <main className={`cosmic-experience stage-${stage}`} data-testid="cosmic-experience" data-stage={stage} style={{ "--cosmic-card-back-image": `url("${cosmicCardBackSrc}")`, "--cosmic-reading-arrival": `${readingArrivalMs}ms`, "--cosmic-reading-flip-delay": `${readingPresentationMotion.flipDelayMs}ms`, "--cosmic-reading-flip-duration": `${readingArrivalMs - readingPresentationMotion.flipDelayMs}ms` } as CSSProperties}>
    <CosmicScene stage={stage} deck={deck} selected={selected} current={current} onSelect={select} paused={panel !== null} onReady={setSceneReady} onEntryComplete={setStage} />
    <motion.div className="cosmic-summary-shade" aria-hidden="true" initial={false} animate={{ opacity: stage === "summary" ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.6 }} />
    {stage !== "travel" && <header className="cosmic-header">
      <button className="cosmic-brand" onClick={home} aria-label="命运回廊，返回首页" disabled={stage === "reversing" || stage === "returning"} tabIndex={stage === "home" ? -1 : 0} aria-hidden={stage === "home"}>{stage === "prepare" ? <><ArrowLeft size={15} strokeWidth={1.2} /><span>返回首页</span></> : <><Orbit size={25} strokeWidth={1} /><span>命运回廊</span></>}</button>
      {stage === "home" && <nav aria-label="主导航">
        <button onClick={() => openPanel("encyclopedia")}><BookOpen size={16} strokeWidth={1.3} />塔罗百科</button>
        <button onClick={() => openPanel("history")}><History size={16} strokeWidth={1.3} />历史记录</button>
        <button onClick={() => openPanel("login")}><UserRound size={16} strokeWidth={1.3} />{visitor || "登录"}</button>
      </nav>}
    </header>}
    <AnimatePresence mode="wait">
      {stage === "home" && <motion.section className="cosmic-hero" key="home" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.45, delay: 0 } }} transition={{ duration: 1.1, delay: reducedMotion ? 0 : 0.7, ease: motionEase }}>
        <h1><span className="sr-only">命运回廊</span><Image className="hero-title-art" src="/assets/cosmic/home-astrolabe-title-v3.webp" alt="" aria-hidden="true" width={1254} height={730} unoptimized priority /></h1>
        <p className="cosmic-hero-copy">写下此刻的困惑，选择你的塔罗牌，开启一段自我探索的旅程。</p>
        <motion.button className="hero-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reducedMotion ? 0 : 1.8 }} disabled={!sceneReady} onClick={() => setStage("reversing")}><Image className="hero-start-frame" src="/assets/cosmic/home-astrolabe-start-v3.webp" alt="" aria-hidden="true" width={885} height={228} unoptimized priority draggable={false} /><span className="sr-only">开始占卜</span></motion.button>
        <Image className="hero-pendant" src="/assets/cosmic/home-astrolabe-pendant-v3.webp" alt="" aria-hidden="true" width={354} height={120} unoptimized draggable={false} />
      </motion.section>}
      {stage === "prepare" && <CosmicQuestion key="prepare" question={question} spread={spread} onQuestion={setQuestion} onSpread={setSpread} onBegin={begin} />}
      {stage === "draw" && <motion.section className="cosmic-draw-heading" key="draw" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <h2>选择与你共鸣的牌</h2>
        <p className="cosmic-draw-question">{question}</p>
        <ol className="cosmic-slots">{spread.slots.map((slot, index) => <li key={slot} className={index < selected.length ? "is-filled" : ""}><span>{index < selected.length ? <Check size={12} /> : index + 1}</span>{slot}</li>)}</ol>
        <p className="cosmic-next-slot" aria-live="polite">下一张 · {spread.slots[selected.length]}</p>
      </motion.section>}
      {stage === "reading" && card && active && <motion.section className="cosmic-reading" key="reading" initial={reducedMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: reducedMotion ? 0 : "100%", transition: { duration: reducedMotion ? 0 : 0.35, delay: 0 } }} transition={{ duration: reducedMotion ? 0 : 1.1, delay: reducedMotion ? 0 : 0.35, ease: motionEase }} aria-label="逐牌解读">
        <AnimatePresence mode="wait"><motion.div className="cosmic-reading-copy" key={active.cardId} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 0.25 } }} exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.18 } }}>
          <p className="cosmic-eyebrow">{spread.slots[current]} · 第 {current + 1} / {selected.length} 张</p>
          <h2>{card.nameCn}<span>· {active.orientation === "upright" ? "正位" : "逆位"}</span></h2>
          <p className="cosmic-card-english">{card.nameEn}</p>
          <span className="cosmic-sample-label">示例解读</span>
          <div className="cosmic-reading-section"><h3><Sparkles size={19} strokeWidth={1} />牌面含义</h3><p>{card.meaning}</p><div className="cosmic-keywords">{keywords.map((word) => <span key={word}>{word}</span>)}</div></div>
          <div className="cosmic-reading-section"><h3><Sparkles size={19} strokeWidth={1} />与你的问题</h3><p className="cosmic-question">“{question}”</p><p>把「{keywords[0]}」作为观察{spread.slots[current]}的一个角度：你现在最在意的是什么？试着写下一件可以主动确认或改变的小事。</p></div>
        </motion.div></AnimatePresence>
        <div className="cosmic-reading-controls"><button className="cosmic-secondary" disabled={current === 0 || turning} onClick={() => changeCard(current - 1)}><ArrowLeft size={16} />上一张</button>
          {reviewingSummary && current < selected.length - 1 && <button className="cosmic-secondary" aria-label="返回整体解读" disabled={turning} onClick={() => setStage("summarizing")}>返回总览</button>}
          {current < selected.length - 1 ? <button className="cosmic-primary" disabled={turning} onClick={() => changeCard(current + 1)}>下一张<ArrowRight size={17} /></button> : <button className="cosmic-primary" disabled={turning} onClick={() => setStage("summarizing")}>查看整体解读<ArrowRight size={17} /></button>}</div>
      </motion.section>}
      {stage === "summarizing" && <motion.section className="cosmic-status" key="summarizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><p className="cosmic-eyebrow">让散落的星光，连成答案</p><h2>回望这一路的线索</h2></motion.section>}
      {stage === "summary" && <SummaryView key="summary" spread={spread} selected={selected} question={question} saved={saved} scrollPositionRef={summaryScroll} reducedMotion={reducedMotion} onReview={(index) => { setReviewingSummary(true); changeCard(index); setStage("reading"); }} onSave={saveDemo} onRestart={() => { home(); setStage("reversing"); }} />}
    </AnimatePresence>
    {stage !== "home" && stage !== "travel" && <footer className="cosmic-footer"><span>THE STARS GUIDE. YOU DECIDE.</span>{stage === "prepare" && <span className="cosmic-prepare-note">体验版 · 解读为示例内容</span>}<span>{spread.name}</span></footer>}

    <dialog ref={dialog} aria-label={panel === "encyclopedia" ? "塔罗百科" : panel === "history" ? "历史记录" : "演示登录"} className={`cosmic-dialog ${panel === "encyclopedia" ? "is-wide" : ""}`} onCancel={() => setPanel(null)} onClick={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
      <div className="cosmic-dialog-content"><button className="cosmic-close" aria-label="关闭面板" onClick={() => setPanel(null)}><X size={21} strokeWidth={1.2} /></button>

        {panel === "encyclopedia" && <section><p className="cosmic-eyebrow">沿着图像，读懂象征</p><h2>塔罗百科</h2><div className="cosmic-encyclopedia-tools"><label><Search size={17} /><input aria-label="搜索塔罗牌" placeholder="搜索中文或英文牌名" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="筛选阿尔卡那" value={arcana} onChange={(event) => setArcana(event.target.value)}><option value="all">全部 78 张</option><option value="major">大阿尔卡那</option><option value="minor">小阿尔卡那</option></select></div>
          <div className="cosmic-encyclopedia-layout"><div className="cosmic-encyclopedia-list" aria-label="牌名目录">{shownCards.length ? shownCards.map((item) => <button key={item.id} onClick={() => setEncyclopediaCard(item)} className={encyclopediaCard.id === item.id ? "is-active" : ""}><span>{item.nameCn}<small>{item.nameEn}</small></span><ChevronRight size={15} /></button>) : <p>没有找到这张牌，换个名字试试。</p>}</div><article className="cosmic-encyclopedia-detail"><Image src={encyclopediaCard.image} alt={encyclopediaCard.nameCn} width={160} height={275} unoptimized /><div><p className="cosmic-eyebrow">{encyclopediaCard.arcana === "major" ? "大阿尔卡那" : "小阿尔卡那"}</p><h3>{encyclopediaCard.nameCn}</h3><p className="cosmic-card-english">{encyclopediaCard.nameEn}</p><p>{encyclopediaCard.meaning}</p><h4>正位关键词</h4><p>{encyclopediaCard.uprightKeywords.join(" · ")}</p><h4>逆位关键词</h4><p>{encyclopediaCard.reversedKeywords.join(" · ")}</p></div></article></div></section>}
        {panel === "history" && <section><p className="cosmic-eyebrow">曾经停留的星光</p><h2>历史记录</h2><p className="cosmic-dialog-intro">旧版保存的手记与本次浏览中的示例。</p>{!records.length && !journals.length ? <div className="cosmic-empty"><History size={34} strokeWidth={1} /><h3>还没有留下手记</h3><p>完成一次占卜后，可以在这里回望。</p></div> : <div className="cosmic-history-list">{journals.map((item) => <article key={item.id}><span className="cosmic-sample-label">本次浏览 · 示例</span><h3>{item.question}</h3><p>{item.spread} · {item.cards.map((entry) => cardData(entry.cardId).nameCn).join("、")}</p></article>)}{records.map((item) => <article key={item.id}><p className="cosmic-eyebrow">{new Date(item.createdAt).toLocaleDateString("zh-CN")} · 旧版手记</p><h3>{item.question}</h3><p>{item.summary}</p><details><summary>展开 {item.spread.length} 张牌的解读</summary>{item.spread.map((entry) => <div key={entry.position}><h4>{cardData(entry.cardId).nameCn} · {entry.orientation === "upright" ? "正位" : "逆位"}</h4><p>{entry.interpretation}</p></div>)}</details></article>)}</div>}</section>}
        {panel === "login" && <section><p className="cosmic-eyebrow">为这段旅程，留下名字</p><h2>{visitor ? `你好，${visitor}` : "遇见星空中的自己"}</h2><p className="cosmic-dialog-intro">演示身份仅在本次浏览中生效。</p>{visitor ? <div className="cosmic-login"><UserRound size={38} strokeWidth={1} /><p>你正在以「{visitor}」的身份探索命运回廊。</p><button className="cosmic-secondary" onClick={() => { setVisitor(""); setVisitorInput(""); }}>退出演示身份</button></div> : <form className="cosmic-login" onSubmit={(event) => { event.preventDefault(); if (visitorInput.trim()) { setVisitor(visitorInput.trim()); setPanel(null); } }}><label htmlFor="cosmic-visitor">怎么称呼你？</label><input id="cosmic-visitor" autoComplete="nickname" value={visitorInput} maxLength={20} required placeholder="你的昵称" onChange={(event) => setVisitorInput(event.target.value)} /><button className="cosmic-primary" disabled={!visitorInput.trim()}>以此身份进入<ArrowRight size={17} /></button></form>}</section>}
      </div>
    </dialog>
  </main>;
}
