"use client";

import { animate, motion, useIsPresent, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { CornerDownLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cosmicSpreads, type CosmicSpread } from "@/lib/cosmic-experience";

const traceDuration = 2.2, orbitDuration = 11;
const joiningSpeed = traceDuration / orbitDuration;
const revealEase = (value: number) => joiningSpeed * value + (1 - joiningSpeed) * value * value * (3 - 2 * value);

/** Clockwise perimeter coordinates; decreasing phase makes the border light travel counterclockwise. */
function capsulePoint(phase: number, width: number, height: number) {
  const radius = height / 2, straight = width - height;
  let distance = ((phase % 1 + 1) % 1) * (straight * 2 + Math.PI * height);
  if (distance < straight) return { x: -straight / 2 + distance, y: -radius, nx: 0, ny: -1 };
  distance -= straight;
  if (distance < Math.PI * radius) {
    const angle = distance / radius - Math.PI / 2;
    return { x: straight / 2 + radius * Math.cos(angle), y: radius * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle) };
  }
  distance -= Math.PI * radius;
  if (distance < straight) return { x: straight / 2 - distance, y: radius, nx: 0, ny: 1 };
  const angle = (distance - straight) / radius + Math.PI / 2;
  return { x: -straight / 2 + radius * Math.cos(angle), y: radius * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle) };
}

function QuestionSparks({ reveal, reducedMotion }: { reveal: MotionValue<number>; reducedMotion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const context = surface.getContext("2d");
    if (!context) return;
    const frame = surface.parentElement!;
    const padding = 76;
    let width = 0, height = 0, frameId = 0, previous = performance.now(), emission = 0;
    let perimeter = 0, border = new Path2D(), finishedAt: number | undefined;
    const sparks: Array<{ x: number; y: number; vx: number; vy: number; age: number; life: number; size: number }> = [];
    const resize = () => {
      width = frame.clientWidth; height = frame.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.round((width + padding * 2) * ratio);
      surface.height = Math.round((height + padding * 2) * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      sparks.length = 0;
      const radius = height / 2, x = padding, y = padding;
      perimeter = 2 * (width - height) + Math.PI * height;
      // Begin at the upper midpoint and trace left, around the bottom, and back across the top.
      border = new Path2D();
      border.moveTo(x + width / 2, y); border.lineTo(x + radius, y);
      border.arc(x + radius, y + radius, radius, -Math.PI / 2, -Math.PI * 1.5, true);
      border.lineTo(x + width - radius, y + height);
      border.arc(x + width - radius, y + radius, radius, Math.PI / 2, -Math.PI / 2, true);
      border.lineTo(x + width / 2, y);
      if (reducedMotion) draw(performance.now());
    };
    const glow = (x: number, y: number, opacity: number, radius = 15) => {
      const light = context.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, `rgba(255,246,211,${opacity})`);
      light.addColorStop(0.16, `rgba(255,216,143,${opacity * 0.8})`);
      light.addColorStop(1, "rgba(217,165,76,0)");
      context.fillStyle = light;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      context.clearRect(0, 0, width + padding * 2, height + padding * 2);
      context.globalCompositeOperation = "lighter";
      const open = reducedMotion ? 1 : reveal.get();
      if (open >= 1 && finishedAt === undefined) finishedAt = now;
      if (open < 1 || surface.dataset.traceProgress !== "1.0000") surface.dataset.traceProgress = open.toFixed(4);
      const start = (width - height) / (2 * perimeter);
      const idle = finishedAt === undefined ? 0 : (now - finishedAt) / (orbitDuration * 1000);
      const phase = start - open - idle;
      const cx = width / 2 + padding, cy = height / 2 + padding;
      if (!reducedMotion) emission += delta * (open < 1 ? 14400 : 8000) * Math.min(1, open * 12);
      while (emission >= 1) {
        emission--;
        const point = capsulePoint(start - Math.random() * open, width, height), speed = 18 + Math.random() * 37;
        sparks.push({ x: cx + point.x, y: cy + point.y, vx: point.nx * speed + (Math.random() - 0.5) * 14,
          vy: point.ny * speed + (Math.random() - 0.5) * 14, age: 0, life: 0.65 + Math.random() * 0.45, size: 0.45 + Math.random() * 0.9 });
      }
      context.fillStyle = "#ffdc9f";
      for (let index = sparks.length - 1; index >= 0; index--) {
        const spark = sparks[index];
        spark.age += delta;
        if (spark.age >= spark.life) { sparks[index] = sparks[sparks.length - 1]; sparks.pop(); continue; }
        spark.x += spark.vx * delta; spark.y += spark.vy * delta;
        const opacity = (1 - spark.age / spark.life) ** 2 * 0.85;
        context.globalAlpha = opacity;
        context.fillRect(spark.x, spark.y, spark.size, spark.size);
        if (spark.size > 1.25) {
          context.fillRect(spark.x - 2, spark.y, 5, 0.6);
          context.fillRect(spark.x, spark.y - 2, 0.6, 5);
        }
      }
      context.globalAlpha = 1;
      context.strokeStyle = "#eac889"; context.lineWidth = 1; context.lineCap = "round";
      context.setLineDash([perimeter * open, perimeter]);
      context.stroke(border); context.setLineDash([]);
      if (!reducedMotion) {
        for (let index = 15; index >= 0; index--) {
          if (open < 1 && index * 0.0018 > open) continue;
          const point = capsulePoint(phase + index * 0.0018, width, height);
          glow(cx + point.x, cy + point.y, (1 - index / 16) * 0.55, index ? 5 : 16);
        }
      }
      if (!reducedMotion && !document.hidden) frameId = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(frameId);
      previous = performance.now();
      if (!reducedMotion && !document.hidden) frameId = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame); resize();
    if (!reducedMotion) visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, [reveal, reducedMotion]);
  return <canvas ref={canvas} className="cosmic-question-sparks" aria-hidden="true" data-motion={reducedMotion ? "static" : "flowing"} />;
}

export function CosmicQuestion({ question, spread, onQuestion, onSpread, onBegin }: {
  question: string; spread: CosmicSpread; onQuestion: (question: string) => void;
  onSpread: (spread: CosmicSpread) => void; onBegin: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false), submitted = useRef(false);
  const present = useIsPresent(), reducedMotion = Boolean(useReducedMotion());
  const [ready, setReady] = useState(false);
  const reveal = useMotionValue(0);
  const bodyOpacity = useTransform(reveal, [0, 0.6, 1], [0, 0, 1]);
  const textOpacity = useTransform(reveal, [0, 0.85, 1], [0, 0, 1]);

  useEffect(() => {
    if (!present) return;
    const controls = animate(reveal, 1, { duration: reducedMotion ? 0 : traceDuration, delay: reducedMotion ? 0 : 0.12, ease: revealEase,
      onComplete: () => setReady(true) });
    return () => controls.stop();
  }, [present, reducedMotion, reveal]);

  useEffect(() => { if (ready && present) input.current?.focus({ preventScroll: true }); }, [ready, present]);

  function submit() {
    if (!ready || !present || composing.current || submitted.current || !question.trim()) return;
    submitted.current = true;
    onBegin();
  }

  return <motion.section className="cosmic-prepare" aria-label="占卜准备" data-ready={ready}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.4 }}>
    <h2>让心中的问题，有一个形状</h2>
    <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="cosmic-question-frame">
        <motion.div className="cosmic-question-capsule" style={{ opacity: bodyOpacity }}>
          <motion.input ref={input} id="cosmic-question" type="text" aria-label="你想问星空什么？" aria-describedby="cosmic-question-hint"
            placeholder="输入你的问题" maxLength={500} autoComplete="off" value={question} disabled={!ready || !present} style={{ opacity: textOpacity }}
            onChange={(event) => onQuestion(event.target.value.slice(0, 500))}
            onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || composing.current) { if (event.key === "Escape") event.stopPropagation(); return; }
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!event.repeat && event.nativeEvent.keyCode !== 229) submit();
            }} />
          <motion.div className="cosmic-question-meta" style={{ opacity: textOpacity }} aria-hidden="true">
            <kbd>Enter <CornerDownLeft size={13} strokeWidth={1.3} /></kbd>
          </motion.div>
        </motion.div>
        <QuestionSparks reveal={reveal} reducedMotion={reducedMotion} />
      </div>
      <span id="cosmic-question-hint" className="sr-only">按 Enter 开启星轨，按 Esc 返回首页并保留问题。</span>
      <motion.fieldset className="cosmic-spread-options" disabled={!ready || !present}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 1.8 }}>
        <legend className="sr-only">选择牌阵</legend>
        {cosmicSpreads.map((item) => <button key={item.id} type="button" aria-label={`${item.name} ${item.slots.length} 张`}
          className={spread.id === item.id ? "is-active" : ""} aria-pressed={spread.id === item.id}
          onClick={() => { onSpread(item); input.current?.focus({ preventScroll: true }); }}>{item.name}</button>)}
      </motion.fieldset>
    </form>
  </motion.section>;
}
