"use client";

import Image from "next/image";
import { useState } from "react";
import { cosmicOpeningArtSrc, cosmicOpeningSkySrc } from "@/lib/cosmic-assets";

// Coordinates follow the selected artwork, including its black margins.
const stars = [[472, 222], [413, 353], [485, 435], [434, 498], [356, 530], [623, 471], [603, 651], [512, 703], [387, 767], [282, 742], [221, 843], [259, 967], [365, 1040], [475, 1184], [531, 1277], [545, 1341]] as const;
const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15]] as const;
export const cosmicOpeningFormationMs = 900;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function CosmicOpeningCard({ progress, elapsedMs, reducedMotion }: { progress: number; elapsedMs: number; reducedMotion: boolean }) {
  const [artLoaded, setArtLoaded] = useState(false);
  const horizontal = reducedMotion ? 1 : clamp((elapsedMs - 160) / 320);
  const vertical = reducedMotion ? 1 : clamp((elapsedMs - 480) / 420);
  const finished = progress >= 1 && artLoaded;
  const left = 481 - 320 * horizontal;
  const right = 481 + 320 * horizontal;
  const top = 807 - 641 * vertical;
  const bottom = 807 + 641 * vertical;

  return <div className="cosmic-opening-art" aria-hidden="true">
    <Image className="cosmic-opening-sky" src={cosmicOpeningSkySrc} alt="" fill sizes="300px" unoptimized style={{ opacity: vertical }} />
    <svg className="cosmic-opening-drawing" viewBox="0 0 962 1635" fill="none" aria-hidden="true" style={{ opacity: finished ? 0 : 1 }}>
      <g stroke="#d7e3ff" strokeWidth="2" className="cosmic-opening-frame">
        <line x1={left} y1={top} x2={right} y2={top} />
        <line x1={left} y1={bottom} x2={right} y2={bottom} />
        <line x1={left} y1={top} x2={left} y2={bottom} />
        <line x1={right} y1={top} x2={right} y2={bottom} />
      </g>
      {[[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y], index) => <g key={index} className="cosmic-opening-point" opacity={horizontal}>
        <circle cx={x} cy={y} r="4" fill="#fff" />
        <path d={`M${x - 13} ${y}H${x + 13}M${x} ${y - 13}V${y + 13}`} stroke="#dce5ff" strokeWidth="1.2" />
      </g>)}
      {horizontal === 0 && <circle cx="481" cy="807" r="5" fill="#e6edff" />}
      <g stroke="#d8d9ff" strokeWidth="1.2">
        {connections.map(([from, to], index) => {
          const amount = clamp(progress * connections.length - index);
          return <line key={`${from}-${to}`} x1={stars[from][0]} y1={stars[from][1]} x2={stars[from][0] + (stars[to][0] - stars[from][0]) * amount} y2={stars[from][1] + (stars[to][1] - stars[from][1]) * amount} />;
        })}
      </g>
      {stars.map(([x, y], index) => <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 0 || index === 6 || index === 12 ? 6 : 4} fill="#e8edff" opacity={index === 0 ? clamp(progress * connections.length) : clamp(progress * connections.length - (connections.findIndex(([, to]) => to === index)))} className="cosmic-opening-point" />)}
    </svg>
    <Image className="cosmic-opening-final" src={cosmicOpeningArtSrc} alt="" fill sizes="300px" unoptimized onLoad={() => setArtLoaded(true)} onError={() => setArtLoaded(false)} style={{ opacity: finished ? 1 : 0 }} />
  </div>;
}
