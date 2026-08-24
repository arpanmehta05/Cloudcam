"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "@/icons";

/* ── data ────────────────────────────────────────────────────── */
const testimonials = [
  {
    tab: "Cost clarity",
    quote:
      "CloudWatcher made cloud spend understandable for engineers, not just finance.",
    name: "Mira N.",
    role: "VP Cloud Services",
    company: "PBS",
    metric: "31%",
    metricLabel: "waste reduced",
    title: "Cost clarity for every engineering decision.",
    desc: "PBS uses CloudWatcher to turn monthly cloud bills into daily engineering signals, so teams can see which workloads changed and why.",
    products: [
      "Cost allocation",
      "Budget alerts",
      "Executive reports",
      "Savings recommendations",
    ],
    accent: "#F97316",
  },
  {
    tab: "AI visibility",
    quote:
      "The team finally has one place for cost, monitoring, and AI request visibility.",
    name: "Youssef I.",
    role: "Cloud Economics Lead",
    company: "Block",
    metric: "4.2x",
    metricLabel: "faster reporting",
    title: "AI and infrastructure visibility in one workflow.",
    desc: "Block connects AI observability with cloud cost data to understand token usage, error rate, latency, and spend from the same dashboard.",
    products: [
      "AI observability",
      "Model analytics",
      "Live cloud metrics",
      "Error tracing",
    ],
    accent: "#1A56DB",
  },
  {
    tab: "Savings momentum",
    quote:
      "We can see the impact of optimizations without waiting for month-end reports.",
    name: "Rami L.",
    role: "Platform Engineering",
    company: "Extend",
    metric: "$184K",
    metricLabel: "savings found",
    title: "Savings momentum that compounds over time.",
    desc: "Extend uses CloudWatcher to track optimization work, validate savings, and keep owners accountable after recommendations are implemented.",
    products: [
      "Watchdog",
      "Idle resource cleanup",
      "Virtual tagging",
      "FinOps workflows",
    ],
    accent: "#22C55E",
  },
];

/* ── animation variants ─────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.2, 0, 0.2, 1] as const },
  },
};

const scaleIn = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.2, 0, 0.2, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ── component ──────────────────────────────────────────────── */
export function TestimonialsSection() {
  const featured = testimonials[1];
  const side = [testimonials[0], testimonials[2]];

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
      {/* header */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
            Customer stories
          </p>
          <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl">
            Trusted by businesses that take cloud costs seriously
          </h2>
        </div>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1 text-sm font-bold text-[#1A56DB]"
        >
          See more customer stories <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>

      {/* cards grid */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
        className="grid gap-5 lg:grid-cols-12"
      >
        {/* featured card */}
        <motion.article
          variants={scaleIn}
          className="relative overflow-hidden rounded-2xl border border-[#CBD5E1] bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_48%,#FFF7ED_100%)] p-6 text-[#0F172A] shadow-[0_24px_80px_rgba(15,23,42,0.1)] lg:col-span-7 lg:min-h-[520px] lg:p-8"
        >
          {/* decorative blurs */}
          <div
            className="absolute -left-28 -top-28 h-80 w-80 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(circle, rgba(26,86,219,0.22) 0%, rgba(6,182,212,0.12) 42%, transparent 72%)",
            }}
          />
          <div
            className="absolute -right-24 top-8 h-72 w-72 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(circle, rgba(249,115,22,0.2) 0%, rgba(251,146,60,0.11) 44%, transparent 74%)",
            }}
          />

          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#1A56DB]">
                  Featured customer
                </p>
                <h3 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
                  {featured.title}
                </h3>
              </div>
              <div className="rounded-2xl border border-[#DBEAFE] bg-white/80 px-5 py-4 text-right shadow-sm backdrop-blur">
                <p className="text-3xl font-extrabold">{featured.metric}</p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">
                  {featured.metricLabel}
                </p>
              </div>
            </div>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#475569]">
              {featured.desc}
            </p>

            <div className="mt-auto pt-10">
              <div className="rounded-2xl border border-[#DBEAFE] bg-white/85 p-5 shadow-sm backdrop-blur">
                <p className="text-2xl font-extrabold leading-snug">
                  &ldquo;{featured.quote}&rdquo;
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#E2E8F0] pt-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1A56DB] text-base font-extrabold text-white">
                      {featured.company.slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{featured.name}</p>
                      <p className="text-xs text-[#64748B]">
                        {featured.role}, {featured.company}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-full bg-[#1A56DB] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Read story <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.article>

        {/* side cards */}
        <div className="grid gap-5 lg:col-span-5">
          {side.map((item) => (
            <motion.article
              key={item.company}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
              className="group relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-xl cursor-pointer"
            >
              <div
                className="absolute -right-12 -top-12 h-40 w-40 rounded-full blur-xl"
                style={{
                  background: `radial-gradient(circle, ${item.accent}33 0%, rgba(219,234,254,0.22) 44%, transparent 74%)`,
                }}
              />
              <div className="relative">
                <div className="mb-7 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-sm"
                      style={{ backgroundColor: item.accent }}
                    >
                      {item.company.slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-lg font-extrabold text-[#0F172A]">
                        {item.company}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                        {item.tab}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-right shadow-sm">
                    <p className="text-xl font-extrabold text-[#0F172A]">
                      {item.metric}
                    </p>
                    <p className="text-[10px] font-semibold text-[#64748B]">
                      {item.metricLabel}
                    </p>
                  </div>
                </div>

                <p className="text-2xl font-extrabold leading-tight tracking-tight text-[#0F172A]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <p className="mt-4 text-sm leading-6 text-[#475569]">
                  {item.desc}
                </p>

                <div className="mt-7 flex items-center justify-between border-t border-[#CBD5E1] pt-5">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      {item.name}
                    </p>
                    <p className="text-xs text-[#64748B]">{item.role}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#94A3B8] transition-transform group-hover:translate-x-1 group-hover:text-[#1A56DB]" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
