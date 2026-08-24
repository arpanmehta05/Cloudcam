"use client";

import Link from "next/link";
import { Check } from "@/icons";
import { BrandMark } from "@/components/BrandMark";

const BRAND_NAME = "CloudWatcher";

export function Footer() {
  return (
    <footer className="border-t border-[#E2E8F0] bg-white px-5 py-12 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_2fr]">
        {/* brand */}
        <div>
          <BrandMark href="/" logoClassName="h-10 w-10" titleClassName="text-base" subtitleClassName="text-[11px]" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#64748B]">
            CloudWatcher, also known as Rabbittize, helps engineering teams
            analyze, report on, and reduce cloud, AI, and infrastructure costs.
          </p>
        </div>

        {/* link columns */}
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#0F172A]">
              Platform
            </h3>
            <div className="mt-4 space-y-3 text-sm text-[#64748B]">
              <a href="#savings" className="block hover:text-[#1A56DB]">
                Cost management
              </a>
              <a href="#platform" className="block hover:text-[#1A56DB]">
                Cloud monitoring
              </a>
              <a href="#ai" className="block hover:text-[#1A56DB]">
                AI observability
              </a>
              <a href="#integrations" className="block hover:text-[#1A56DB]">
                Integrations
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#0F172A]">
              Services
            </h3>
            <div className="mt-4 space-y-3 text-sm text-[#64748B]">
              <a href="#ai" className="block hover:text-[#1A56DB]">
                AI assistants
              </a>
              <a href="#ai" className="block hover:text-[#1A56DB]">
                Chatbot solutions
              </a>
              <a href="#platform" className="block hover:text-[#1A56DB]">
                FinOps workflows
              </a>
              <a href="#customers" className="block hover:text-[#1A56DB]">
                Customer stories
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#0F172A]">
              Company
            </h3>
            <div className="mt-4 space-y-3 text-sm text-[#64748B]">
              <Link href="/login" className="block hover:text-[#1A56DB]">
                Sign in
              </Link>
              <Link href="/signup" className="block hover:text-[#1A56DB]">
                Start free
              </Link>
              <a href="#customers" className="block hover:text-[#1A56DB]">
                Customers
              </a>
              <a href="#platform" className="block hover:text-[#1A56DB]">
                Security
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-[#E2E8F0] pt-6 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
        <span>
          {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-[#1A56DB]">
            Privacy
          </a>
          <a href="#" className="hover:text-[#1A56DB]">
            Terms
          </a>
          <a href="#" className="hover:text-[#1A56DB]">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
