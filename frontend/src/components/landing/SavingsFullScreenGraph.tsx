"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

function pts(raw: number[][]): string {
  if (raw.length < 2) return "";
  let d = `M${raw[0][0]} ${raw[0][1]}`;
  for (let i = 1; i < raw.length; i += 1) {
    const [px, py] = raw[i - 1];
    const [cx, cy] = raw[i];
    const mx = px + (cx - px) * 0.5;
    d += ` C${mx} ${py} ${mx} ${cy} ${cx} ${cy}`;
  }
  return d;
}

const graphPaths = [
  pts([
    [0, 470], [90, 456], [180, 482], [270, 442], [360, 466],
    [450, 430], [540, 452], [630, 408], [720, 432], [810, 392],
    [900, 414], [990, 378], [1080, 398], [1170, 368], [1260, 384],
    [1350, 356], [1440, 366],
  ]),
  pts([
    [0, 470], [90, 462], [180, 448], [270, 426], [360, 398],
    [450, 360], [540, 314], [630, 264], [720, 218], [810, 182],
    [900, 158], [990, 144], [1080, 136], [1170, 132], [1260, 130],
    [1350, 128], [1440, 126],
  ]),
  pts([
    [0, 470], [90, 448], [180, 420], [270, 382], [360, 344],
    [450, 308], [540, 284], [630, 278], [720, 290], [810, 308],
    [900, 324], [990, 334], [1080, 338], [1170, 334], [1260, 338],
    [1350, 342], [1440, 344],
  ]),
  pts([
    [0, 470], [90, 458], [180, 440], [270, 412], [360, 376],
    [450, 342], [540, 318], [630, 326], [720, 366], [810, 412],
    [900, 448], [990, 472], [1080, 488], [1170, 498], [1260, 504],
    [1350, 508], [1440, 510],
  ]),
];

const phases = [
  {
    eyebrow: "THE PROBLEM",
    heading: "Costs are unpredictable and growing",
    description:
      "Idle resources, unoptimized instances, and AI workloads hide inside a bill that keeps climbing.",
    stroke: "#94A3B8",
    tint: "rgba(148,163,184,0.12)",
    metric: "$1.23M",
    metricLabel: "monthly spend",
  },
  {
    eyebrow: "THE SPIKE",
    heading: "Small inefficiencies become budget shocks",
    description:
      "Zombie infrastructure, egress surprises, and token usage spikes compound before teams know where to look.",
    stroke: "#EF4444",
    tint: "rgba(239,68,68,0.12)",
    metric: "+31%",
    metricLabel: "forecast variance",
  },
  {
    eyebrow: "THE FIX",
    heading: "Cloudcam turns waste into owned actions",
    description:
      "AI-powered detection groups evidence, finds owners, and routes the right optimization work to the right team.",
    stroke: "#1A56DB",
    tint: "rgba(26,86,219,0.12)",
    metric: "42",
    metricLabel: "fixes prioritized",
  },
  {
    eyebrow: "THE RESULT",
    heading: "Predictable costs and continuous savings",
    description:
      "Every spike is caught, every dollar is attributed, and every optimization keeps compounding over time.",
    stroke: "#22C55E",
    tint: "rgba(34,197,94,0.14)",
    metric: "$184K",
    metricLabel: "annual savings",
  },
];

function fillPath(path: string) {
  return `${path} L1440 640 L0 640 Z`;
}

function PhaseCopy({
  phase,
  progress,
  range,
}: {
  phase: (typeof phases)[number];
  progress: MotionValue<number>;
  range: [number, number, number, number];
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  const y = useTransform(progress, range, [34, 0, 0, -26]);

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-30 flex h-full w-full transform-gpu items-start px-6 pt-[11vh] sm:px-10 lg:px-16"
      style={{ opacity, y, willChange: "opacity, transform" }}
    >
      <div className="max-w-[560px] rounded-lg border border-white/65 bg-white/72 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-md sm:p-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: phase.stroke }}>
          {phase.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-extrabold leading-[1.08] text-[#0F172A] sm:text-4xl lg:text-5xl">
          {phase.heading}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-[#475569] sm:text-base">
          {phase.description}
        </p>
      </div>
    </motion.div>
  );
}

function StatBadge({ phase }: { phase: (typeof phases)[number] }) {
  return (
    <motion.div
      key={phase.eyebrow}
      className="absolute right-5 top-[12vh] z-30 rounded-lg border border-white/70 bg-white/82 px-5 py-4 shadow-[0_22px_70px_rgba(15,23,42,0.14)] backdrop-blur-md sm:right-10 lg:right-16"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: phase.stroke }}>
        {phase.metricLabel}
      </p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl">
        {phase.metric}
      </p>
    </motion.div>
  );
}

export function SavingsFullScreenGraph() {
  const sectionRef = useRef<HTMLElement>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phaseIndexRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const progress = useSpring(scrollYProgress, {
    stiffness: 64,
    damping: 24,
    mass: 0.35,
  });

  useMotionValueEvent(progress, "change", (value) => {
    const nextPhase = Math.min(3, Math.floor(value * 4));
    if (nextPhase !== phaseIndexRef.current) {
      phaseIndexRef.current = nextPhase;
      setPhaseIndex(nextPhase);
    }
  });

  const currentPhase = phases[phaseIndex];
  const linePath = useTransform(progress, [0, 0.33, 0.66, 1], graphPaths);
  const areaPath = useTransform(linePath, fillPath);
  const stroke = useTransform(progress, [0, 0.33, 0.66, 1], phases.map((phase) => phase.stroke));
  const fill = useTransform(progress, [0, 0.33, 0.66, 1], phases.map((phase) => phase.tint));
  const graphY = useTransform(progress, [0, 1], ["2%", "-4%"]);
  const gridOpacity = useTransform(progress, [0, 0.45, 1], [0.75, 1, 0.8]);
  const barWidth = useTransform(progress, [0, 1], ["0%", "100%"]);

  const textRanges: [number, number, number, number][] = [
    [0, 0.07, 0.2, 0.29],
    [0.24, 0.33, 0.45, 0.54],
    [0.49, 0.58, 0.7, 0.79],
    [0.73, 0.82, 0.96, 1],
  ];

  return (
    <section ref={sectionRef} id="savings" className="relative h-[360vh]">
      <div className="sticky top-0 h-screen w-full transform-gpu overflow-hidden bg-[#F8FAFC]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#EFF6FF_48%,#F8FAFC_100%)]" />
        <motion.div
          className="pointer-events-none absolute inset-0 transform-gpu bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:64px_64px]"
          style={{ opacity: gridOpacity, willChange: "opacity" }}
        />
        <motion.div
          className="absolute inset-x-[-12%] bottom-[-18%] top-[16%] z-[1] transform-gpu"
          style={{ y: graphY, willChange: "transform" }}
        >
          <svg viewBox="0 0 1440 640" fill="none" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="savings-graph-fill" x1="0" y1="0" x2="0" y2="1">
                <motion.stop offset="0%" stopColor={fill} />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            {[128, 256, 384, 512].map((gy) => (
              <line key={gy} x1="0" y1={gy} x2="1440" y2={gy} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="7 9" />
            ))}
            <line x1="0" y1="470" x2="1440" y2="470" stroke="#94A3B8" strokeWidth="1" opacity="0.5" />
            <motion.path d={areaPath} fill="url(#savings-graph-fill)" />
            <motion.path
              d={linePath}
              stroke={stroke}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
              opacity="0.12"
            />
            <motion.path
              d={linePath}
              stroke={stroke}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 1.45, ease: [0.22, 1, 0.36, 1] }}
            />
            {[
              { y: 135, label: "High" },
              { y: 312, label: "Med" },
              { y: 470, label: "Low" },
            ].map((item) => (
              <text key={item.label} x="26" y={item.y} fill="#64748B" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif">
                {item.label}
              </text>
            ))}
          </svg>
        </motion.div>

        {phases.map((phase, index) => (
          <PhaseCopy
            key={phase.eyebrow}
            phase={phase}
            progress={progress}
            range={textRanges[index]}
          />
        ))}

        <StatBadge phase={currentPhase} />

        <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-6 sm:px-10 lg:px-16">
          <div className="mb-3 flex items-center gap-2">
            {phases.map((phase, index) => (
              <div key={phase.eyebrow} className="flex items-center gap-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: index === phaseIndex ? 30 : 10,
                    backgroundColor: index === phaseIndex ? phase.stroke : "#CBD5E1",
                  }}
                />
                {index === phaseIndex ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: phase.stroke }}>
                    {phase.eyebrow}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="h-[3px] w-full max-w-sm overflow-hidden rounded-full bg-black/5">
            <motion.div className="h-full rounded-full" style={{ width: barWidth, backgroundColor: stroke }} />
          </div>
        </div>
      </div>
    </section>
  );
}
