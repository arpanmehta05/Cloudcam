"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { ForgotPasswordForm } from "@/modules/auth";

const Feature = ({ title, desc }: { title: string; desc: string }) => (
  <div className="flex gap-4 mb-8">
    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A56DB] text-white shadow-md shadow-[#1A56DB]/30">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </div>
    <div>
      <h3 className="text-[15px] font-extrabold text-[#0F172A]">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#475569]">{desc}</p>
    </div>
  </div>
);

function ForgotPasswordPageContent() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex relative font-sans overflow-hidden">
      <div className="absolute inset-0 z-0 flex pointer-events-none">
        <div className="w-full md:w-[50%] bg-[#F8FAFC] h-full" />
        <div className="hidden md:block w-[70%] h-full absolute right-0 top-0 bottom-0" style={{ clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0% 100%)" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A56DB] via-[#3B82F6] to-[#06B6D4] opacity-95" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row w-full z-10 max-w-[1600px] mx-auto min-h-screen">
        <div className="w-full md:w-[55%] flex flex-col justify-center px-8 py-12 md:px-12 lg:px-20 xl:px-28 bg-white/40 md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none">
          <BrandMark className="mb-12" logoClassName="h-10 w-10" />
          <div className="max-w-md">
            <Feature title="Recover access safely" desc="Start with the email on your account. We will send a one-time code before any password change is allowed." />
            <Feature title="Verify before reset" desc="The reset form appears only after the OTP is verified, keeping password updates behind email ownership." />
            <Feature title="Back to work quickly" desc="Once your new password is saved, you can sign in and return to your cloud cost workspace." />
          </div>
        </div>

        <div className="w-full md:w-[45%] flex flex-col justify-center items-center px-6 py-12 md:pr-12 lg:pr-20 xl:pr-32 relative">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-[440px]">
            <ForgotPasswordForm />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
