"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X } from "@/icons";
import { Button } from "@/components/ui/button";

const BRAND_NAME = "CloudWatcher";
const BRAND_SUBTITLE = "By Rabbitt Ai";
const BRAND_LOGO_SRC = "/Logo.svg";

export type NavbarLink = {
  label: string;
  href: string;
};

type NavbarProps = {
  links: NavbarLink[];
  brand?: {
    label?: string;
    subtitle?: string;
    href?: string;
    ariaLabel?: string;
  };
  secondaryLink?: NavbarLink;
  cta?: NavbarLink;
  mobileInlineAction?: ReactNode;
  variant?: "landing" | "docs";
};

function isActiveLink(pathname: string, href: string) {
  if (href.startsWith("#")) return false;
  if (href === "/") return pathname === "/";
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({
  links,
  brand = {},
  secondaryLink,
  cta,
  mobileInlineAction,
  variant = "landing",
}: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const brandHref = brand.href ?? "/";
  const brandLabel = brand.label ?? BRAND_NAME;
  const brandSubtitle = brand.subtitle ?? BRAND_SUBTITLE;
  const brandAriaLabel = brand.ariaLabel ?? `${brandLabel} home`;
  const navGap = variant === "docs" ? "gap-6" : "gap-8";

  return (
    <header
      data-variant={variant}
      className="sticky top-0 z-50 border-b border-white/55 bg-white/72 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/64"
    >
      <nav
        className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:h-[4.5rem] lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href={brandHref}
          className="flex items-center gap-2.5"
          aria-label={brandAriaLabel}
        >
          <span className="flex h-16 w-16 items-center justify-center overflow-visible rounded-[10px]">
            <Image
              src={BRAND_LOGO_SRC}
              alt="CloudWatcher Logo"
              width={88}
              height={88}
              className="h-[5.25rem] w-[5.25rem] max-w-none object-contain"
              priority={variant === "landing"}
            />
          </span>
          <span className="translate-y-[2px]">
            <span className="block bg-gradient-to-r from-[#061128] via-[#1842B4] to-[#2762E3] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
              {brandLabel}
            </span>
            {brandSubtitle ? (
              <span className="block text-xs font-medium leading-4 text-[#64748B]">
                {brandSubtitle}
              </span>
            ) : null}
          </span>
        </Link>

        <div className={`hidden items-center ${navGap} md:flex`}>
          {links.map((link) => {
            const active = isActiveLink(pathname, link.href);

            return (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`group relative py-2 text-sm font-medium transition-all duration-300 ${
                  active
                    ? "text-[#1A56DB]"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {link.label}
                <span
                  className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-[#1A56DB] transition-transform duration-200 ease-out ${
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {secondaryLink ? (
            <Link
              href={secondaryLink.href}
              className="text-sm font-semibold text-[#334155] transition-colors hover:text-[#1A56DB]"
            >
              {secondaryLink.label}
            </Link>
          ) : null}
          {cta ? (
            <motion.div whileHover={{ scale: 0.98 }} whileTap={{ scale: 0.96 }}>
              <Button
                asChild
                size="sm"
                className="rounded-[12px] bg-[#1A56DB] text-white hover:bg-[#1040A0]"
              >
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
            </motion.div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {mobileInlineAction}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-[12px] md:hidden"
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen ? (
        <div className="absolute left-0 right-0 top-full border-t border-[#E2E8F0] bg-white px-5 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] md:hidden">
          <div className="space-y-3">
            {links.map((link) => {
              const active = isActiveLink(pathname, link.href);

              return (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`block text-sm font-medium ${active ? "text-[#1A56DB]" : "text-[#475569]"}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            {secondaryLink ? (
              <Link
                href={secondaryLink.href}
                className="block text-sm font-medium text-[#475569]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {secondaryLink.label}
              </Link>
            ) : null}
            {cta ? (
              <Button
                asChild
                size="sm"
                className="w-full rounded-[12px] bg-[#1A56DB] text-white hover:bg-[#1040A0]"
              >
                <Link href={cta.href} onClick={() => setMobileMenuOpen(false)}>
                  {cta.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
