"use client";

import { motion } from "framer-motion";
import {
  Server,
  Database,
  Cloud,
  Zap,
  Cpu,
  Activity,
  Shield,
  Network,
} from "@/icons";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.2, 0, 0.2, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const integrations = [
  { name: "EC2", icon: Server },
  { name: "RDS", icon: Database },
  { name: "S3", icon: Cloud },
  { name: "Lambda", icon: Zap },
  { name: "EKS", icon: Cpu },
  { name: "CloudWatch", icon: Activity },
  { name: "IAM", icon: Shield },
  { name: "VPC", icon: Network },
];

export function IntegrationSection() {
  return (
    <section className="border-y border-[#1f1f22] bg-[#050D1A] py-16 text-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          {/* text */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <p className="mb-3 text-sm font-bold text-[#6BA3F8]">
              Connect once. Monitor everything.
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              AWS visibility today. Multi-cloud next.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#CBD5E1]">
              Connect your AWS account to pull cost, metrics, identity, compute,
              storage, network, and AI observability signals into one workflow.
              Azure, GCP, and custom partner connectors are on the roadmap.
            </p>
          </motion.div>

          {/* grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {integrations.map((item) => (
              <motion.div
                key={item.name}
                variants={fadeUp}
                className="rounded-lg border border-white/10 bg-white/[0.06] p-4 transition-colors duration-300 hover:bg-white/[0.1]"
              >
                <item.icon className="mb-3 h-5 w-5 text-[#3B82F6]" />
                <p className="text-sm font-semibold">{item.name}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
