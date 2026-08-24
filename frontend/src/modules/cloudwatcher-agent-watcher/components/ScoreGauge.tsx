"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { scoreBand } from "../constants";

interface ScoreGaugeProps {
  score01: number; // 0..1
  size?: number;
  tone?: "light" | "dark";
}

/**
 * The hero score display — a large animated ring that sweeps to the score,
 * with the 0–100 value, letter grade, and band label stacked in the centre.
 */
export function ScoreGauge({ score01, size = 240, tone = "light" }: ScoreGaugeProps) {
  const reduce = useReducedMotion();
  const band = scoreBand(score01);
  const clamped = Math.max(0, Math.min(1, score01));
  const value = Math.round(clamped * 100);

  const isSmall = size < 200;
  const stroke = isSmall ? 12 : 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gapFraction = 0.16; // leave a bottom gap so the ring reads as a gauge
  const arc = c * (1 - gapFraction);
  const rotation = 90 + gapFraction * 180;

  // Dynamic style mappings
  const numFontSize = isSmall ? "text-[38px]" : "text-[58px]";
  const slashFontSize = isSmall ? "text-xs mt-1" : "text-xl mt-2";
  const badgeMt = isSmall ? "mt-1.5" : "mt-3";
  const badgePadding = isSmall ? "px-2 py-0.5" : "px-3 py-1";
  const badgeTextSize = isSmall ? "text-[9px]" : "text-xs";
  const circleSize = isSmall ? "h-3.5 w-3.5 text-[8px]" : "h-5 w-5 text-[11px]";

  // Count the number up as the ring fills.
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  const gradientId = `cw-gauge-${band.grade}`;
  const textColor = tone === "dark" ? "#FFFFFF" : "#020617";
  const mutedColor = tone === "dark" ? "#94A3B8" : "#94A3B8";
  const trackColor = tone === "dark" ? "rgba(255,255,255,0.12)" : "#E2E8F0";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={band.ring} />
            <stop offset="100%" stopColor={band.color} />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
        />
        {/* value arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: arc * (1 - clamped) }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-start">
          <span
            className={`${numFontSize} font-extrabold leading-none tracking-tight tabular-nums`}
            style={{ color: textColor }}
          >
            {display}
          </span>
          <span className={`font-bold ${slashFontSize}`} style={{ color: mutedColor }}>/100</span>
        </div>
        <div
          className={`${badgeMt} inline-flex items-center gap-1.5 rounded-full ${badgePadding} ${badgeTextSize} font-extrabold uppercase tracking-[0.12em]`}
          style={{ backgroundColor: band.soft, color: band.color }}
        >
          <span className={`grid ${circleSize} place-items-center rounded-full text-white`} style={{ backgroundColor: band.color }}>
            {band.grade}
          </span>
          {band.label}
        </div>
      </div>
    </div>
  );
}
