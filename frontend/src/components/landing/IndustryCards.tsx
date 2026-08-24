"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Building2, Bot } from "@/icons";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.2, 0, 0.2, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const cards = [
  {
    icon: Zap,
    title: "Infrastructure for innovation",
    description:
      "Power new products, cost controls, and AI capabilities with a data foundation that scales with your engineering org.",
    href: "#",
    accent: "#F97316",
    bgAccent: "bg-[#FFF7ED]",
  },
  {
    icon: Building2,
    title: "Clarity at enterprise scale",
    description:
      "Unify cost management, monitoring, and AI observability on one trusted platform — no spreadsheet gymnastics required.",
    href: "#",
    accent: "#1A56DB",
    bgAccent: "bg-[#EFF6FF]",
  },
  {
    icon: Bot,
    title: "AI that learns from the truth",
    description:
      "Feed your FinOps workflows clean, enriched cloud data that makes cost intelligence actionable — not noisy.",
    href: "#",
    accent: "#06B6D4",
    bgAccent: "bg-[#ECFEFF]",
  },
];

export function IndustryCards() {
  return (
    <section className="bg-[#F8FAFC] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          className="mx-auto mb-14 max-w-3xl text-center"
        >
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
            Built for every team
          </p>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl">
            One platform, every cloud challenge
          </h2>
          <p className="mt-4 text-base leading-7 text-[#475569]">
            Whether you&apos;re a startup shipping fast or an enterprise
            managing millions, CloudWatcher adapts to your scale.
          </p>
        </motion.div>

        {/* cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="grid gap-6 md:grid-cols-3"
        >
          {cards.map((card) => (
            <motion.div
              key={card.title}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
              className="group rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-xl cursor-pointer"
            >
              <div
                className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${card.bgAccent}`}
              >
                <card.icon
                  className="h-5 w-5"
                  style={{ color: card.accent }}
                />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-[#0F172A]">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#64748B]">
                {card.description}
              </p>
              <div className="mt-6 border-t border-[#E2E8F0] pt-5">
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 text-sm font-extrabold transition-colors group-hover:opacity-80"
                  style={{ color: card.accent }}
                >
                  Learn more{" "}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
