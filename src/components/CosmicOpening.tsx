"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { CosmicOpeningCard, cosmicOpeningFormationMs } from "@/components/CosmicOpeningCard";
import { cosmicOpeningArtSrc, cosmicOpeningSkySrc } from "@/lib/cosmic-assets";
import "./cosmic-opening.css";

const homeImages = [...["title", "start", "pendant"].map((part) => `/assets/cosmic/home-astrolabe-${part}-v3.webp`), cosmicOpeningArtSrc, cosmicOpeningSkySrc];
const resourceCount = 79 + homeImages.length + 2;
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const getServerReducedMotion = () => false;

export function CosmicOpening({ sceneReady, sceneProgress, onReveal, onComplete }: {
  sceneReady: boolean; sceneProgress: number;
  onReveal: (revealed: boolean) => void; onComplete: (visible: boolean) => void;
}) {
  const [settled, setSettled] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phase, setPhase] = useState<"loading" | "sealed" | "revealing">("loading");
  const started = useRef(0);
  const drawn = useRef(0);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, getServerReducedMotion);
  const ready = sceneReady && settled === homeImages.length + 2;
  const target = ready ? 1 : Math.min(.99, (sceneProgress * 79 + settled) / resourceCount);

  useEffect(() => {
    started.current = performance.now();
    let cancelled = false;
    let finished = 0;
    const done = () => { if (!cancelled) { finished++; setSettled((count) => Math.max(count, finished)); } };
    const tasks = homeImages.map((src) => new Promise<void>((resolve) => {
      const image = new window.Image();
      image.onload = () => { image.decode().catch(() => {}).then(resolve); };
      image.onerror = () => resolve();
      image.src = src;
    }));
    tasks.push(document.fonts.load('400 18px "Fate Serif"', "写下此刻的困惑，选择你的塔罗牌，开启一段自我探索的旅程。").then(() => {}));
    tasks.push(document.fonts.load('400 15px "Fate Sans"', "塔罗百科历史记录登录开始占卜").then(() => {}));
    tasks.forEach((task) => { task.then(done, done); });
    // Decorative requests must not leave a usable scene behind a permanent curtain.
    const timeout = setTimeout(() => { if (!cancelled) setSettled(homeImages.length + 2); }, 12000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const draw = (now: number) => {
      const delta = Math.max(0, Math.min(64, now - previous));
      previous = now;
      const elapsed = Math.max(0, now - started.current);
      setElapsedMs(elapsed);
      const ceiling = reducedMotion ? target : Math.min(target, Math.max(0, elapsed - cosmicOpeningFormationMs) / 650);
      drawn.current = Math.max(drawn.current, reducedMotion ? ceiling : Math.min(ceiling, drawn.current + delta / 280));
      setProgress(drawn.current);
      if (ready && drawn.current >= 1) { setPhase("sealed"); return; }
      frame = requestAnimationFrame(draw);
    };
    if (phase === "loading") frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [target, ready, reducedMotion, phase]);

  useEffect(() => {
    if (phase !== "sealed") return;
    const timer = setTimeout(() => { setPhase("revealing"); onReveal(true); }, reducedMotion ? 0 : 280);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, onReveal]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const timer = setTimeout(() => onComplete(false), reducedMotion ? 160 : 600);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, onComplete]);

  return <div className="cosmic-opening" data-phase={phase} data-testid="cosmic-opening" role="status" aria-label={ready ? "加载完成" : "正在加载塔罗牌"} style={{ "--opening-progress": progress } as CSSProperties}>
    <div className="cosmic-opening-seal">
      <CosmicOpeningCard progress={progress} elapsedMs={elapsedMs} reducedMotion={Boolean(reducedMotion)} />
    </div>
  </div>;
}
