"use client";

import { useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";

const companyLogos = [
  "Joygrid",
  "Starburst",
  "Metronome",
  "Square",
  "PBS",
  "OrbitOps",
];

export function LogoStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useAnimationFrame((_, delta) => {
    if (shouldReduceMotion || !trackRef.current) return;

    const loopWidth = trackRef.current.scrollWidth / 2;
    const speed = isHovered ? 0.012 : 0.035;
    const nextX = x.get() - delta * speed;
    x.set(nextX <= -loopWidth ? nextX + loopWidth : nextX);
  });

  const marqueeLogos = [...companyLogos, ...companyLogos];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, ease: [0.2, 0, 0.2, 1] }}
      className="mx-auto max-w-6xl px-5 py-12 text-center lg:px-8 lg:py-16"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
        Trusted where cloud spend is mission critical
      </p>
      <div
        className="relative mt-6 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent dark:from-slate-950" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent dark:from-slate-950" />
        <motion.div
          ref={trackRef}
          className="flex w-max gap-4 py-1 text-sm font-bold text-[#475569]"
          style={{ x }}
        >
          {marqueeLogos.map((logo, index) => (
            <div
              key={`${logo}-${index}`}
              aria-hidden={index >= companyLogos.length}
              className="flex min-w-36 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-5 py-3 shadow-sm transition-[border-color,box-shadow,color] duration-300 hover:border-[#BFDBFE] hover:text-[#1A56DB] hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {logo}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
