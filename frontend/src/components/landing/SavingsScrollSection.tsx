"use client";

import { useRef, useEffect, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

/* ═══════════════════════════════════════════════════════════════
   GRAPH PATH GENERATION
   Builds an SVG path string for each scroll phase.
   All paths share the same x-space (0-640) so morphing is smooth.
   ═══════════════════════════════════════════════════════════════ */

/** Generate a wavy, unstable cost path (phase 1 — rising chaos) */
function unstablePath(): string {
  const pts = [
    [0, 195],
    [45, 180],
    [90, 190],
    [135, 170],
    [180, 185],
    [225, 165],
    [270, 175],
    [315, 155],
    [360, 168],
    [405, 148],
    [450, 160],
    [495, 140],
    [540, 152],
    [585, 135],
    [640, 145],
  ];
  return ptsToPath(pts);
}

/** Cost spike path (phase 2 — aggressive rise) */
function spikePath(): string {
  const pts = [
    [0, 195],
    [45, 185],
    [90, 178],
    [135, 165],
    [180, 155],
    [225, 138],
    [270, 118],
    [315, 95],
    [360, 72],
    [405, 52],
    [450, 38],
    [495, 28],
    [540, 22],
    [585, 18],
    [640, 15],
  ];
  return ptsToPath(pts);
}

/** Stabilizing path (phase 3 — optimization kicking in) */
function stabilizePath(): string {
  const pts = [
    [0, 195],
    [45, 182],
    [90, 170],
    [135, 152],
    [180, 130],
    [225, 110],
    [270, 95],
    [315, 88],
    [360, 92],
    [405, 105],
    [450, 118],
    [495, 128],
    [540, 135],
    [585, 138],
    [640, 140],
  ];
  return ptsToPath(pts);
}

/** Savings path (phase 4 — optimized, low baseline) */
function savingsPath(): string {
  const pts = [
    [0, 195],
    [45, 188],
    [90, 180],
    [135, 168],
    [180, 152],
    [225, 132],
    [270, 115],
    [315, 108],
    [360, 118],
    [405, 145],
    [450, 168],
    [495, 182],
    [540, 190],
    [585, 195],
    [640, 198],
  ];
  return ptsToPath(pts);
}

/** Convert point array to smooth SVG cubic bezier path */
function ptsToPath(pts: number[][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.5;
    const cpy1 = prev[1];
    const cpx2 = prev[0] + (curr[0] - prev[0]) * 0.5;
    const cpy2 = curr[1];
    d += ` C${cpx1} ${cpy1} ${cpx2} ${cpy2} ${curr[0]} ${curr[1]}`;
  }
  return d;
}

/* ═══════════════════════════════════════════════════════════════
   PHASE DATA
   ═══════════════════════════════════════════════════════════════ */

const phases = [
  {
    eyebrow: "THE PROBLEM",
    heading: "Your cloud costs are unpredictable and rising",
    description:
      "Without visibility, teams overspend on idle resources, unoptimized instances, and untracked AI workloads. The bill keeps climbing.",
    path: unstablePath(),
    lineColor: "#94A3B8",
    fillColor: "rgba(148, 163, 184, 0.08)",
    markerLabel: null as string | null,
    markerColor: "",
  },
  {
    eyebrow: "THE SPIKE",
    heading: "Costs spike due to inefficiencies and lack of visibility",
    description:
      "Unchecked resources, zombie instances, and unmonitored AI token usage compound into budget-breaking cost spikes.",
    path: spikePath(),
    lineColor: "#EF4444",
    fillColor: "rgba(239, 68, 68, 0.06)",
    markerLabel: "Cost spike detected",
    markerColor: "#EF4444",
  },
  {
    eyebrow: "THE FIX",
    heading: "CloudWatcher identifies waste and optimizes usage in real-time",
    description:
      "AI-powered detection surfaces idle resources, rightsizing opportunities, and budget overruns — then routes fixes to the right owners.",
    path: stabilizePath(),
    lineColor: "#1A56DB",
    fillColor: "rgba(26, 86, 219, 0.06)",
    markerLabel: "Optimization active",
    markerColor: "#1A56DB",
  },
  {
    eyebrow: "THE RESULT",
    heading: "Consistent savings and predictable cost control",
    description:
      "Teams ship with confidence knowing every dollar is tracked, every spike is caught, and every optimization compounds over time.",
    path: savingsPath(),
    lineColor: "#22C55E",
    fillColor: "rgba(34, 197, 94, 0.08)",
    markerLabel: null,
    markerColor: "#22C55E",
  },
];

/* ═══════════════════════════════════════════════════════════════
   TEXT LAYER — Fades in/out per phase
   ═══════════════════════════════════════════════════════════════ */

function PhaseText({
  eyebrow,
  heading,
  description,
  opacity,
  y,
}: {
  eyebrow: string;
  heading: string;
  description: string;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}) {
  return (
    <motion.div className="absolute inset-0 flex flex-col justify-center" style={{ opacity, y }}>
      <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
        {eyebrow}
      </p>
      <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl">
        {heading}
      </h2>
      <p className="mt-4 max-w-md text-base leading-7 text-[#475569]">
        {description}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATED COUNTER — counts up to target
   ═══════════════════════════════════════════════════════════════ */

function AnimatedCounter({
  target,
  active,
  prefix = "$",
  suffix = "K",
}: {
  target: number;
  active: boolean;
  prefix?: string;
  suffix?: string;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let frame: number;
    const duration = 1800;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return (
    <span className="tabular-nums">
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATED SVG GRAPH
   ═══════════════════════════════════════════════════════════════ */

function AnimatedGraph({
  scrollProgress,
  activePhase,
  mouseOffset,
}: {
  scrollProgress: MotionValue<number>;
  activePhase: number;
  mouseOffset: { x: number; y: number };
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const phase = phases[activePhase];

  // Measure path length for strokeDashoffset animation
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [phase.path]);

  // Map scroll progress → strokeDashoffset (draw-on effect)
  const dashOffset = useTransform(scrollProgress, [0, 1], [pathLength, 0]);

  // Parallax offset from mouse
  const px = mouseOffset.x * 0.015;
  const py = mouseOffset.y * 0.015;

  // Fill path (area under curve)
  const fillPath = phase.path + " L640 220 L0 220 Z";

  // marker position — put it on the spike point for phase 1-2, stabilization for 3
  const markerPositions = [null, { cx: 540, cy: 22 }, { cx: 405, cy: 105 }, null];
  const marker = markerPositions[activePhase];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
      style={{ transform: `translate(${px}px, ${py}px)` }}
    >
      {/* background grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* y-axis labels */}
      <div className="pointer-events-none absolute left-3 top-4 flex flex-col justify-between" style={{ height: "calc(100% - 48px)" }}>
        {["High", "", "Med", "", "Low"].map((label, i) => (
          <span key={i} className="text-[9px] font-semibold text-[#94A3B8]">
            {label}
          </span>
        ))}
      </div>

      {/* SVG graph */}
      <svg
        viewBox="0 0 640 220"
        fill="none"
        className="relative z-10 h-[280px] w-full sm:h-[320px]"
        preserveAspectRatio="none"
      >
        {/* horizontal grid lines */}
        {[55, 110, 165].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="640"
            y2={y}
            stroke="#E2E8F0"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* fill area */}
        <motion.path
          d={fillPath}
          fill={phase.fillColor}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          key={`fill-${activePhase}`}
        />

        {/* main line */}
        <motion.path
          ref={pathRef}
          d={phase.path}
          stroke={phase.lineColor}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: dashOffset,
          }}
          key={`line-${activePhase}`}
        />

        {/* baseline reference */}
        <line
          x1="0"
          y1="195"
          x2="640"
          y2="195"
          stroke="#E2E8F0"
          strokeWidth="1"
        />

        {/* marker dot */}
        {marker && (
          <motion.g
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            key={`marker-${activePhase}`}
          >
            {/* pulse ring */}
            <motion.circle
              cx={marker.cx}
              cy={marker.cy}
              r="12"
              fill="none"
              stroke={phase.markerColor}
              strokeWidth="2"
              opacity="0.3"
              animate={{ r: [12, 20, 12], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* dot */}
            <circle
              cx={marker.cx}
              cy={marker.cy}
              r="5"
              fill={phase.markerColor}
            />
            <circle
              cx={marker.cx}
              cy={marker.cy}
              r="2"
              fill="white"
            />
          </motion.g>
        )}

        {/* savings endpoint dot (phase 4) */}
        {activePhase === 3 && (
          <motion.g
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <circle cx="640" cy="198" r="6" fill="#22C55E" />
            <circle cx="640" cy="198" r="2.5" fill="white" />
          </motion.g>
        )}
      </svg>

      {/* floating marker label */}
      {phase.markerLabel && marker && (
        <motion.div
          className="absolute z-20 rounded-lg border px-3 py-1.5 text-xs font-bold shadow-sm"
          style={{
            left: `${(marker.cx / 640) * 100}%`,
            top: `${(marker.cy / 220) * 100 - 14}%`,
            backgroundColor: "white",
            borderColor: phase.markerColor,
            color: phase.markerColor,
            transform: "translateX(-50%)",
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          key={`label-${activePhase}`}
        >
          {phase.markerLabel}
        </motion.div>
      )}

      {/* savings badge (phase 4) */}
      {activePhase === 3 && (
        <motion.div
          className="absolute right-4 top-4 z-20 rounded-xl border border-[#DCFCE7] bg-white px-4 py-3 shadow-md"
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.2, 0, 0.2, 1] }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#22C55E]">
            Total savings
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#0F172A]">
            <AnimatedCounter target={184} active={activePhase === 3} />
          </p>
        </motion.div>
      )}

      {/* phase indicator pills */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {phases.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: i === activePhase ? 24 : 8,
              backgroundColor:
                i === activePhase ? phases[i].lineColor : "#CBD5E1",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SECTION
   ═══════════════════════════════════════════════════════════════ */

export function SavingsScrollSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Determine active phase from scroll position
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v < 0.25) setActivePhase(0);
    else if (v < 0.5) setActivePhase(1);
    else if (v < 0.75) setActivePhase(2);
    else setActivePhase(3);
  });

  // Mouse parallax (desktop only)
  useEffect(() => {
    function handleMouse(e: MouseEvent) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setMouseOffset({ x: e.clientX - cx, y: e.clientY - cy });
    }
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  /* ── per-phase text opacity + y transforms ──── */
  // Phase 0: 0.0 → 0.25
  const o0 = useTransform(scrollYProgress, [0, 0.06, 0.19, 0.25], [0, 1, 1, 0]);
  const y0 = useTransform(scrollYProgress, [0, 0.06, 0.19, 0.25], [40, 0, 0, -30]);

  // Phase 1: 0.25 → 0.50
  const o1 = useTransform(scrollYProgress, [0.25, 0.31, 0.44, 0.50], [0, 1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0.25, 0.31, 0.44, 0.50], [40, 0, 0, -30]);

  // Phase 2: 0.50 → 0.75
  const o2 = useTransform(scrollYProgress, [0.50, 0.56, 0.69, 0.75], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.50, 0.56, 0.69, 0.75], [40, 0, 0, -30]);

  // Phase 3: 0.75 → 1.0
  const o3 = useTransform(scrollYProgress, [0.75, 0.81, 0.94, 1.0], [0, 1, 1, 0]);
  const y3 = useTransform(scrollYProgress, [0.75, 0.81, 0.94, 1.0], [40, 0, 0, -30]);

  /* ── progress bar ──── */
  const barWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={sectionRef} id="savings" className="relative" style={{ height: "300vh" }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            {/* ── LEFT: text column ──────────────────────────── */}
            <div className="relative min-h-[260px]">
              <PhaseText eyebrow={phases[0].eyebrow} heading={phases[0].heading} description={phases[0].description} opacity={o0} y={y0} />
              <PhaseText eyebrow={phases[1].eyebrow} heading={phases[1].heading} description={phases[1].description} opacity={o1} y={y1} />
              <PhaseText eyebrow={phases[2].eyebrow} heading={phases[2].heading} description={phases[2].description} opacity={o2} y={y2} />
              <PhaseText eyebrow={phases[3].eyebrow} heading={phases[3].heading} description={phases[3].description} opacity={o3} y={y3} />
            </div>

            {/* ── RIGHT: animated graph ─────────────────────── */}
            <div>
              <AnimatedGraph
                scrollProgress={scrollYProgress}
                activePhase={activePhase}
                mouseOffset={mouseOffset}
              />
            </div>
          </div>

          {/* bottom progress bar */}
          <div className="mt-8 h-1 w-full max-w-md overflow-hidden rounded-full bg-[#E2E8F0]">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: barWidth,
                backgroundColor: phases[activePhase].lineColor,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
