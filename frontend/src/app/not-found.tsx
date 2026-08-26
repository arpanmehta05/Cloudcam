"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  Search,
  Sparkles,
} from "@/icons";
import { Button } from "@/components/ui/button";

const BRAND_NAME = "Cloudcam";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6">
      {/* ── Background: Landing Page Palette ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div 
          className="absolute -top-[15%] -left-[10%] h-[60%] w-[60%] rounded-full blur-[140px] opacity-[0.12]"
          style={{ background: "radial-gradient(circle, #1A56DB 0%, transparent 70%)" }}
        />
        <div 
          className="absolute -bottom-[15%] -right-[10%] h-[60%] w-[60%] rounded-full blur-[140px] opacity-[0.15]"
          style={{ background: "radial-gradient(circle, #F97316 0%, transparent 70%)" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1.5px,transparent_1.5px),linear-gradient(90deg,rgba(15,23,42,0.03)_1.5px,transparent_1.5px)] bg-[size:44px_44px]" />
      </div>

      {/* ── Content Wrapper ── */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        
        {/* Huge Stylised 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mb-2 select-none"
        >
          <motion.h1 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="text-[12rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-[linear-gradient(135deg,#1A56DB_0%,#06B6D4_100%)] opacity-[0.07] sm:text-[18rem]"
          >
            404
          </motion.h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-[0_20px_50px_rgba(26,86,219,0.15)] border border-[#EFF6FF]"
            >
              <Activity className="h-12 w-12 text-[#1A56DB]" />
            </motion.div>
          </div>
        </motion.div>

        {/* Messaging */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#1A56DB] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Route Signal Lost
          </div>
          
          <h2 className="text-5xl font-extrabold tracking-tight text-[#0F172A] sm:text-6xl">
            This page drifted <br className="hidden sm:block" /> 
            <span className="text-[#1A56DB]">off the service graph.</span>
          </h2>
          
          <p className="mx-auto max-w-lg text-lg leading-relaxed text-[#64748B]">
            Our observability sensors can&apos;t find the resource you&apos;re looking for. 
            It might have been moved, deleted, or never existed in this region.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button
            asChild
            size="lg"
            className="h-14 rounded-2xl bg-[#1A56DB] px-8 text-base font-bold text-white shadow-xl shadow-blue-500/25 hover:bg-[#1040A0] transition-all active:scale-95"
          >
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              Return Home
            </Link>
          </Button>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-14 rounded-2xl border-[#E2E8F0] bg-white px-6 text-base font-bold text-[#0F172A] hover:bg-[#F8FAFC] active:scale-95 transition-all"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Try Again
            </Button>
            <Link
              href="/docs"
              className="flex h-14 items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-6 text-base font-bold text-[#0F172A] hover:bg-[#F8FAFC] active:scale-95 transition-all"
            >
              <Search className="h-5 w-5" />
              Docs
            </Link>
          </div>
        </motion.div>

        {/* System Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-20 flex items-center gap-3 text-sm font-bold tracking-tight text-[#94A3B8]"
        >
          <div className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          {BRAND_NAME} Infrastructure: Active
        </motion.div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 text-xs font-bold tracking-[0.2em] uppercase text-[#CBD5E1]">
        © {new Date().getFullYear()} Cloudcam Observability Platform
      </div>
    </main>
  );
}
