"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "@/icons";
import type { ReactNode } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const scaleIn = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const sectionStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.06,
    },
  },
};

type FeatureSectionProps = {
  eyebrow: string;
  heading: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  metric: string;
  metricLabel: string;
  visual: ReactNode;
  reversed?: boolean;
  accent?: string;
  id?: string;
};

export function FeatureSection({
  eyebrow,
  heading,
  description,
  ctaLabel,
  ctaHref,
  metric,
  metricLabel,
  visual,
  reversed = false,
  accent = "#1A56DB",
  id,
}: FeatureSectionProps) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.16 }}
      variants={sectionStagger}
      className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"
    >
      <div
        className={`grid items-center gap-10 lg:gap-16 ${
          reversed
            ? "lg:grid-cols-[1.1fr_0.9fr]"
            : "lg:grid-cols-[0.9fr_1.1fr]"
        }`}
      >
        {/* text */}
        <motion.div
          variants={fadeUp}
          className={reversed ? "lg:order-2" : ""}
        >
          <p
            className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          >
            {eyebrow}
          </p>
          <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl">
            {heading}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#475569]">
            {description}
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 text-sm font-extrabold transition-colors hover:opacity-80"
              style={{ color: accent }}
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* stat card */}
          <motion.div
            variants={scaleIn}
            className="mt-8 inline-block rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#64748B]">
              {metricLabel}
            </p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight text-[#0F172A]">
              {metric}
            </p>
            <div className="mt-4 h-2 w-32 overflow-hidden rounded-full bg-[#E2E8F0]">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "72%" }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: accent }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* visual */}
        <motion.div
          variants={scaleIn}
          className={reversed ? "lg:order-1" : ""}
        >
          {visual}
        </motion.div>
      </div>
    </motion.section>
  );
}
