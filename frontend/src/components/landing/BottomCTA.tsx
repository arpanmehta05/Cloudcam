"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "@/icons";
import { Button } from "@/components/ui/button";

const scaleIn = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.2, 0, 0.2, 1] as const },
  },
};

export function BottomCTA() {
  return (
    <section className="border-t border-[#E2E8F0] bg-white px-5 py-20 lg:px-8 lg:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={scaleIn}
        className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[#CBD5E1] bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_48%,#FFF7ED_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-14"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          {/* text */}
          <div>
            <p className="mb-4 text-sm font-bold text-[#1A56DB]">
              Get started today
            </p>
            <h2 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-6xl">
              Stop cloud cost drift today
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#475569]">
              Join engineering teams using Cloudcam to automate cloud optimization,
              audit model provider spend, and drive operational accountability in minutes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <motion.div
                whileHover={{ scale: 0.98 }}
                whileTap={{ scale: 0.96 }}
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 bg-[#1A56DB] px-6 text-white hover:bg-[#1040A0]"
                >
                  <Link href="/signup">
                    Talk to an expert <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-6 text-sm font-bold text-[#0F172A] shadow-sm transition-colors hover:bg-[#F8FAFC]"
              >
                Sign up for free
              </Link>
            </div>
          </div>

          {/* checklist card */}
          <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#64748B]">
                Launch checklist
              </p>
              <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#14532D]">
                Fast setup
              </span>
            </div>
            {[
              "Connect your cloud accounts securely",
              "Review savings and alerts",
              "Invite engineering owners",
            ].map((item, index) => (
              <div
                key={item}
                className="mb-3 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 last:mb-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-extrabold text-[#1A56DB]">
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-[#334155]">
                    {item}
                  </span>
                </div>
                <Check className="h-4 w-4 text-[#22C55E]" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
