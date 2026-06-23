import type { CSSProperties } from "react";

export type AmbientMode = "home" | "transition" | "shuffle" | "draw" | "reading" | "final";

type AmbientStyle = CSSProperties & {
  "--ambient-candle-low": number;
  "--ambient-candle-mid": number;
  "--ambient-candle-high": number;
  "--ambient-candle-peak": number;
  "--ambient-sweep-low": number;
  "--ambient-sweep-high": number;
  "--ambient-center-low": number;
  "--ambient-center-high": number;
  "--ambient-dust": number;
};

type DustStyle = CSSProperties & {
  "--dust-left": string;
  "--dust-top": string;
  "--dust-size": string;
  "--dust-x": string;
  "--dust-y": string;
  "--dust-duration": string;
  "--dust-delay": string;
};

function fixed(value: number) {
  return Number(value.toFixed(3));
}

function createAmbientStyle(candle: number, center: number, dust: number, flicker: number): AmbientStyle {
  return {
    "--ambient-candle-low": fixed(0.34 * candle),
    "--ambient-candle-mid": fixed(0.44 * candle),
    "--ambient-candle-high": fixed(0.52 * candle * flicker),
    "--ambient-candle-peak": fixed(0.58 * candle * flicker),
    "--ambient-sweep-low": fixed(0.09 * candle),
    "--ambient-sweep-high": fixed(0.18 * candle),
    "--ambient-center-low": fixed(0.14 * center),
    "--ambient-center-high": fixed(0.24 * center),
    "--ambient-dust": dust,
  };
}

const ambientStyles: Record<AmbientMode, AmbientStyle> = {
  home: createAmbientStyle(1, 1, 1, 1),
  transition: createAmbientStyle(1.05, 1.15, 0.75, 1),
  shuffle: createAmbientStyle(0.75, 0.85, 0.35, 0.75),
  draw: createAmbientStyle(0.65, 0.65, 0.25, 0.55),
  reading: createAmbientStyle(0.45, 0.5, 0.1, 0.35),
  final: createAmbientStyle(0.3, 0.35, 0, 0.15),
};

const dustPoints: DustStyle[] = [
  {
    "--dust-left": "8.5%",
    "--dust-top": "9%",
    "--dust-size": "1.5px",
    "--dust-x": "10px",
    "--dust-y": "-18px",
    "--dust-duration": "8.5s",
    "--dust-delay": "-0.6s",
  },
  {
    "--dust-left": "11.5%",
    "--dust-top": "14%",
    "--dust-size": "2px",
    "--dust-x": "-8px",
    "--dust-y": "-22px",
    "--dust-duration": "11s",
    "--dust-delay": "-4.1s",
  },
  {
    "--dust-left": "15%",
    "--dust-top": "10.5%",
    "--dust-size": "1px",
    "--dust-x": "14px",
    "--dust-y": "12px",
    "--dust-duration": "9.5s",
    "--dust-delay": "-2.3s",
  },
  {
    "--dust-left": "17.5%",
    "--dust-top": "21%",
    "--dust-size": "2.5px",
    "--dust-x": "-18px",
    "--dust-y": "-10px",
    "--dust-duration": "13s",
    "--dust-delay": "-7.4s",
  },
  {
    "--dust-left": "7.2%",
    "--dust-top": "19%",
    "--dust-size": "1.4px",
    "--dust-x": "19px",
    "--dust-y": "8px",
    "--dust-duration": "10.2s",
    "--dust-delay": "-1.8s",
  },
  {
    "--dust-left": "13.8%",
    "--dust-top": "25%",
    "--dust-size": "1.8px",
    "--dust-x": "6px",
    "--dust-y": "-24px",
    "--dust-duration": "12.4s",
    "--dust-delay": "-5.2s",
  },
  {
    "--dust-left": "19%",
    "--dust-top": "16%",
    "--dust-size": "1.2px",
    "--dust-x": "-20px",
    "--dust-y": "14px",
    "--dust-duration": "7.6s",
    "--dust-delay": "-3s",
  },
  {
    "--dust-left": "10.2%",
    "--dust-top": "27%",
    "--dust-size": "1.7px",
    "--dust-x": "16px",
    "--dust-y": "-14px",
    "--dust-duration": "14s",
    "--dust-delay": "-8.8s",
  },
  {
    "--dust-left": "87%",
    "--dust-top": "7%",
    "--dust-size": "1.6px",
    "--dust-x": "-10px",
    "--dust-y": "-16px",
    "--dust-duration": "8.9s",
    "--dust-delay": "-1.1s",
  },
  {
    "--dust-left": "90.5%",
    "--dust-top": "12.5%",
    "--dust-size": "2.4px",
    "--dust-x": "9px",
    "--dust-y": "-20px",
    "--dust-duration": "12.8s",
    "--dust-delay": "-6.1s",
  },
  {
    "--dust-left": "93.2%",
    "--dust-top": "18.5%",
    "--dust-size": "1.2px",
    "--dust-x": "-15px",
    "--dust-y": "10px",
    "--dust-duration": "9.8s",
    "--dust-delay": "-3.8s",
  },
  {
    "--dust-left": "84.5%",
    "--dust-top": "16%",
    "--dust-size": "1.8px",
    "--dust-x": "20px",
    "--dust-y": "-9px",
    "--dust-duration": "13.6s",
    "--dust-delay": "-9.4s",
  },
  {
    "--dust-left": "89%",
    "--dust-top": "23%",
    "--dust-size": "1.3px",
    "--dust-x": "-6px",
    "--dust-y": "-23px",
    "--dust-duration": "10.9s",
    "--dust-delay": "-2.7s",
  },
  {
    "--dust-left": "94.5%",
    "--dust-top": "9.5%",
    "--dust-size": "2px",
    "--dust-x": "-17px",
    "--dust-y": "15px",
    "--dust-duration": "7.8s",
    "--dust-delay": "-4.6s",
  },
  {
    "--dust-left": "82.5%",
    "--dust-top": "25%",
    "--dust-size": "1.5px",
    "--dust-x": "18px",
    "--dust-y": "-12px",
    "--dust-duration": "11.8s",
    "--dust-delay": "-7.9s",
  },
  {
    "--dust-left": "91.8%",
    "--dust-top": "27%",
    "--dust-size": "1.1px",
    "--dust-x": "-12px",
    "--dust-y": "-18px",
    "--dust-duration": "14.2s",
    "--dust-delay": "-10.2s",
  },
];

export function AmbientLightEffects({ mode }: { mode: AmbientMode }) {
  return (
    <div className="ambient-light pointer-events-none absolute inset-0" style={ambientStyles[mode]} aria-hidden="true">
      <div className="ambient-light__candle ambient-light__candle--left" />
      <div className="ambient-light__candle ambient-light__candle--right" />
      <div className="ambient-light__sweep" />
      <div className="ambient-light__center" />
      <div className="ambient-light__dust-field">
        {dustPoints.map((point, index) => (
          <span key={index} className="ambient-light__dust" style={point} />
        ))}
      </div>
    </div>
  );
}
