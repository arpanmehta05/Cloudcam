import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const BRAND_NAME = "Cloudcam";
const BRAND_SUBTITLE = "By Fonder";
// Bump this URL whenever the logo artwork changes so Next.js and browsers do
// not reuse a previously optimized SVG with its old white background.
const BRAND_LOGO_SRC = "/Logo.svg?v=3";

type BrandMarkProps = {
  href?: string;
  className?: string;
  logoClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  showSubtitle?: boolean;
};

export function BrandMark({
  href = "/",
  className,
  logoClassName,
  titleClassName,
  subtitleClassName,
  showSubtitle = true,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      className={cn("flex w-fit items-center gap-2.5", className)}
      aria-label={`${BRAND_NAME} home`}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center overflow-visible rounded-md",
          logoClassName,
        )}
      >
        <Image
          src={BRAND_LOGO_SRC}
          alt="Cloudcam Logo"
          width={256}
          height={256}
          className="h-[125%] w-[125%] max-w-none object-contain"
          priority
        />
      </span>
      <span>
        <span
          className={cn(
            "block bg-gradient-to-r from-[#061128] via-[#1842B4] to-[#2762E3] bg-clip-text text-[22px] font-extrabold tracking-tight text-transparent dark:from-[#F8FAFC] dark:via-[#8CB7FF] dark:to-[#38BDF8]",
            titleClassName,
          )}
        >
          {BRAND_NAME}
        </span>
        {showSubtitle ? (
          <span
            className={cn(
              "block text-xs font-semibold leading-4 text-[#64748B] dark:text-[#7DD3FC]",
              subtitleClassName,
            )}
          >
            {BRAND_SUBTITLE}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
