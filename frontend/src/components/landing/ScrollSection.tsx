"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

const slides = [
  {
    kicker: "Cloud spend clarity",
    heading: "Stop guessing where your cloud budget goes",
    sub: "CloudWatcher breaks down every dollar across services, teams, and regions so the expensive parts of your architecture are easy to spot.",
    metric: "$1.23M",
    label: "monthly spend mapped",
    accent: "#1A56DB",
  },
  {
    kicker: "AI observability",
    heading: "Trace AI cost from request to owner",
    sub: "Every model call, token surge, and provider charge lands in the same operating view as your infrastructure spend.",
    metric: "2.3M",
    label: "tokens attributed",
    accent: "#06B6D4",
  },
  {
    kicker: "Live controls",
    heading: "See budget risk before it becomes the bill",
    sub: "Budget alerts, anomaly signals, idle resource detection, and service trends move together instead of living in separate tabs.",
    metric: "7",
    label: "active alerts",
    accent: "#F97316",
  },
  {
    kicker: "Engineering ownership",
    heading: "Give teams the evidence to fix what they ship",
    sub: "Cost, reliability, and AI usage stay connected to owners, regions, and next actions so cleanup work can actually happen.",
    metric: "18%",
    label: "waste reduced",
    accent: "#22C55E",
  },
];

function TextLayer({
  slide,
  progress,
  range,
}: {
  slide: (typeof slides)[number];
  progress: MotionValue<number>;
  range: [number, number, number, number];
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  const y = useTransform(progress, range, [42, 0, 0, -42]);
  const scale = useTransform(progress, range, [0.98, 1, 1, 0.985]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center"
      style={{ opacity, y, scale, willChange: "opacity, transform" }}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#38BDF8]">
        {slide.kicker}
      </p>
      <h2 className="mt-4 max-w-4xl text-3xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
        {slide.heading}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#C7D2FE] sm:text-lg">
        {slide.sub}
      </p>
      <div className="mt-8 flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.06] px-5 py-3 shadow-[0_18px_60px_rgba(2,6,23,0.22)] backdrop-blur-md">
        <span className="text-2xl font-extrabold tabular-nums text-white">
          {slide.metric}
        </span>
        <span className="h-8 w-px bg-white/15" />
        <span className="text-left text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
          {slide.label}
        </span>
      </div>
    </motion.div>
  );
}

function ActiveTick({
  accent,
  progress,
  range,
}: {
  accent: string;
  progress: MotionValue<number>;
  range: [number, number, number, number];
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  return (
    <motion.span
      className="h-10 w-[3px] rounded-full"
      style={{ backgroundColor: accent, opacity }}
    />
  );
}

function SignalRail({ progress }: { progress: MotionValue<number> }) {
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);
  const dotX = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <div className="absolute bottom-8 left-1/2 w-[min(640px,calc(100%-40px))] -translate-x-1/2">
      <div className="relative h-[3px] overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,#1A56DB,#06B6D4,#F97316,#22C55E)]"
          style={{ width }}
        />
      </div>
      <motion.div
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-[#38BDF8] shadow-[0_0_24px_rgba(56,189,248,0.8)]"
        style={{ left: dotX }}
      />
    </div>
  );
}

export function ScrollSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 56,
    damping: 22,
    mass: 0.35,
  });
  const displayProgress = shouldReduceMotion ? scrollYProgress : smoothProgress;

  const bgShift = useTransform(displayProgress, [0, 1], ["0%", "100%"]);
  const gridY = useTransform(displayProgress, [0, 1], ["0%", "-12%"]);
  const glowX = useTransform(displayProgress, [0, 1], ["-18%", "18%"]);

  const ranges: [number, number, number, number][] = [
    [0, 0.08, 0.18, 0.26],
    [0.24, 0.33, 0.43, 0.52],
    [0.48, 0.58, 0.68, 0.77],
    [0.72, 0.82, 0.94, 1],
  ];

  return (
    <section ref={sectionRef} className="relative h-[420vh]">
      <motion.div className="sticky top-0 h-screen transform-gpu overflow-hidden bg-[#06111F]">
        <motion.div
          className="absolute inset-0 transform-gpu opacity-90"
          style={{
            background:
              "linear-gradient(120deg,#06111F 0%,#0B1B33 28%,#102A43 48%,#06111F 70%,#0F172A 100%)",
            backgroundSize: "220% 220%",
            backgroundPositionX: bgShift,
            willChange: "background-position",
          }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 transform-gpu bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px]"
          style={{ y: gridY, willChange: "transform" }}
        />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[18%] h-48 w-[44rem] -translate-x-1/2 transform-gpu rounded-full bg-[#1A56DB]/20 blur-3xl"
          style={{ x: glowX, willChange: "transform" }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#06111F] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#06111F] to-transparent" />

        {slides.map((slide, index) => (
          <TextLayer
            key={slide.heading}
            slide={slide}
            progress={displayProgress}
            range={ranges[index]}
          />
        ))}

        <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
          {slides.map((slide, index) => (
            <ActiveTick
              key={slide.kicker}
              accent={slide.accent}
              progress={displayProgress}
              range={ranges[index]}
            />
          ))}
        </div>

        <SignalRail progress={displayProgress} />
      </motion.div>
    </section>
  );
}
