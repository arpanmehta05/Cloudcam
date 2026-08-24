"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "@/icons";

import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/landing/Hero";
import { LogoStrip } from "@/components/landing/LogoStrip";
import { ScrollSection } from "@/components/landing/ScrollSection";
import { SavingsFullScreenGraph } from "@/components/landing/SavingsFullScreenGraph";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { IndustryCards } from "@/components/landing/IndustryCards";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { IntegrationSection } from "@/components/landing/IntegrationSection";
import { BottomCTA } from "@/components/landing/BottomCTA";
import { Footer } from "@/components/landing/Footer";
import { SimulationVisual as InteractiveSimulationVisual } from "@/components/landing/SimulationVisual";

import { AIObservabilityVisual } from "./AIObservabilityVisual";
import { OperationsVisual } from "./OperationsVisual";

const BRAND_NAME = "CloudWatcher";
const BRAND_SUBTITLE = "By Rabbitt Ai";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } },
};

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Savings", href: "#savings" },
  { label: "AI", href: "#ai" },
  { label: "Agent Watcher", href: "/agent-watcher" },
  { label: "Simulation", href: "#simulation" },
  { label: "Plans", href: "/plans" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "/docs" },
  { label: "Customers", href: "#customers" },
];

const faqs = [
  {
    question: "What is CloudWatcher?",
    answer:
      "CloudWatcher is an engineering-first cloud cost optimization and observability platform. It helps engineering, DevOps, and FinOps teams monitor multi-cloud infrastructure, reduce waste, analyze AI model spend, and automate savings recommendations in real-time.",
  },
  {
    question: "Is CloudWatcher the same product as Rabbittize?",
    answer:
      "Yes. CloudWatcher is the official product platform name, and it is hosted at the rabbitt.ai domain. The platform has been upgraded and fully optimized to support legacy Rabbittize integrations alongside all new CloudWatcher FinOps capabilities.",
  },
  {
    question: "How does CloudWatcher help reduce cloud costs?",
    answer:
      "CloudWatcher continuously scans your cloud infrastructure for idle databases, unattached storage, and oversized instances. It then provides actionable, safe optimization recommendations (like right-sizing and reservations) with built-in Terraform previews and simulation dry-runs.",
  },
  {
    question: "Who should use CloudWatcher?",
    answer:
      "CloudWatcher is built for modern engineering teams, DevOps engineers, and FinOps leaders who want cost visibility and optimization workflows integrated directly into their existing developer workflows, rather than locked inside isolated finance tools.",
  },
];

export function LandingPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <Navbar
        links={navLinks}
        brand={{ label: BRAND_NAME, ariaLabel: `${BRAND_NAME} home`, subtitle: BRAND_SUBTITLE }}
        secondaryLink={user ? { label: "Go to Dashboard", href: "/dashboard" } : { label: "Sign in", href: "/login" }}
        cta={user ? undefined : { label: "Start free", href: "/signup" }}
      />

      <main>
        <Hero />
        <LogoStrip />
        <ScrollSection />

        <SavingsFullScreenGraph />

        <FeatureSection
          id="ai"
          eyebrow="AI Observability"
          heading="Trace every LLM request directly to its business cost"
          description="Gain absolute visibility into your AI workloads. Track tokens, latencies, error rates, and costs across OpenAI, Anthropic, Gemini, Bedrock, and custom gateways. Map API usage to features, identify optimization opportunities, and trigger auto-alerts before billing shocks happen."
          ctaLabel="View AI observability"
          ctaHref="/ai-observability"
          metric="2.3M"
          metricLabel="tokens tracked"
          accent="#06B6D4"
          reversed
          visual={<AIObservabilityVisual />}
        />

        <FeatureSection
          id="simulation"
          eyebrow="Architecture Simulation"
          heading="Plan infrastructure changes in a cost-aware canvas"
          description="Build cloud architecture diagrams on an interactive simulation canvas. Connect compute, database, and storage nodes to instantly calculate price differences and preview deployment impact before launching to production."
          ctaLabel="Explore simulation mode"
          ctaHref="/simulation"
          metric="-24%"
          metricLabel="Average cost reduction planned"
          accent="#1A56DB"
          reversed={false}
          visual={<InteractiveSimulationVisual />}
        />

        <IndustryCards />

        <FeatureSection
          id="platform"
          eyebrow="Operations"
          heading="Unify cloud infrastructure and LLM performance metrics"
          description="Bridge the gap between DevOps and AI engineering. Correlate compute instance load, database spikes, and network egress costs with LLM response times and error spikes on a single dashboard—no tool-hopping required."
          ctaLabel="Explore the platform"
          ctaHref="/dashboard"
          metric="7"
          metricLabel="active alerts"
          accent="#F97316"
          reversed={true}
          visual={<OperationsVisual />}
        />

        <IntegrationSection />

        <section
          id="faq"
          className="border-y border-[#E2E8F0] bg-[#F8FAFC] px-5 py-20 lg:px-8 lg:py-28"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
            >
              <motion.p variants={fadeUp} className="mb-4 text-sm font-bold text-[#1A56DB]">
                CloudWatcher FAQ
              </motion.p>
              <motion.h2
                id="faq-heading"
                variants={fadeUp}
                className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl"
              >
                Cloud cost optimization questions, answered
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-5 max-w-xl text-base leading-7 text-[#475569]">
                Clear answers for teams comparing CloudWatcher, Rabbittize,
                and modern multi-cloud cost optimization workflows.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="space-y-4"
            >
              {faqs.map((item, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <motion.article
                    key={item.question}
                    variants={fadeUp}
                    className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-[#BFDBFE] hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="flex w-full items-center justify-between p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1A56DB]"
                      aria-expanded={isExpanded}
                    >
                      <span className="text-base font-extrabold text-[#0F172A]">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-[#64748B] shrink-0 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 text-sm leading-6 text-[#64748B]">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </section>

        <TestimonialsSection />
        <BottomCTA />
      </main>

      <Footer />
    </div>
  );
}
