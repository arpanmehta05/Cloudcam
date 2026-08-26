"use client";

import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { SignupForm } from "@/modules/auth";

const Feature = ({ title, desc }: { title: string; desc: string }) => (
  <div className="flex gap-4 mb-8">
    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A56DB] text-white shadow-md shadow-[#1A56DB]/30">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </div>
    <div>
      <h3 className="text-[15px] font-extrabold text-[#0F172A]">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#475569]">{desc}</p>
    </div>
  </div>
);

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex relative font-sans overflow-hidden">
      <div className="absolute inset-0 z-0 flex pointer-events-none">
        <div className="w-full md:w-[50%] bg-[#F8FAFC] h-full" />
        <div className="hidden md:block w-[70%] h-full absolute right-0 top-0 bottom-0" style={{ clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0% 100%)" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A56DB] via-[#3B82F6] to-[#06B6D4] opacity-95" />
          <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-white/20 rounded-full blur-[100px] opacity-60 mix-blend-overlay" />
          <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-[#06B6D4]/40 rounded-full blur-[80px] opacity-80 mix-blend-overlay" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row w-full z-10 max-w-[1600px] mx-auto min-h-screen">
        <div className="w-full md:w-[55%] flex flex-col justify-center px-8 py-12 md:px-12 lg:px-20 xl:px-28 bg-white/40 md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none">
          <BrandMark className="mb-12" logoClassName="h-16 w-16" />
          <div className="max-w-md">
            <Feature title="Cost Visibility" desc="Combine AWS, AI usage, and infrastructure costs in the same report. Create complex filters and set alerts for every resource." />
            <Feature title="AI-Powered Optimization" desc="Automatically identify idle instances and optimization opportunities. No infrastructure changes or financial commitments required." />
            <Feature title="Secure Connection" desc="Cloudcam uses read-only service accounts to access cost data cleanly and securely, ensuring compliance with DPDP guardrails." />
          </div>
          <div className="mt-14 max-w-[440px] rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hidden md:block relative z-20">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1A56DB] to-[#06B6D4] text-white font-bold shadow-inner">MN</div>
              <div><p className="text-sm font-extrabold text-[#0F172A]">Mira N.</p><p className="text-xs font-semibold text-[#64748B]">VP Cloud Services at PBS</p></div>
            </div>
            <p className="text-[14px] leading-[1.65] text-[#475569]">"Cloudcam has already helped us make our AWS spend natively understandable for engineers. The best part is we see AI costs and alerts in the same workflow."</p>
          </div>
        </div>

        <div className="w-full md:w-[45%] flex flex-col justify-center items-center px-6 py-12 md:pr-12 lg:pr-20 xl:pr-32 relative">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-[440px]">
            <div className="bg-white rounded-[24px] shadow-[0_32px_64px_-12px_rgba(26,86,219,0.25)] border border-white/50 p-8 sm:p-10 relative z-20">
              <SignupForm />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
