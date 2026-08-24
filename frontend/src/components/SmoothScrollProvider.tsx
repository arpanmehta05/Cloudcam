"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

type SmoothScrollProviderProps = {
  children: ReactNode;
};

const NATIVE_SCROLL_SELECTOR = [
  "[data-lenis-prevent]",
  "[role='dialog']",
  ".react-flow",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
].join(",");

function shouldUseNativeScroll(node: HTMLElement) {
  if (node.closest(NATIVE_SCROLL_SELECTOR)) {
    return true;
  }

  const style = window.getComputedStyle(node);
  const hasScrollableOverflow = /(auto|scroll)/.test(
    `${style.overflow}${style.overflowY}`,
  );

  return hasScrollableOverflow && node.scrollHeight > node.clientHeight;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    const isLandingPage = pathname === "/";

    if (!isLandingPage) {
      document.documentElement.removeAttribute("data-smooth-scroll");
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) {
      document.documentElement.removeAttribute("data-smooth-scroll");
      return;
    }

    document.documentElement.dataset.smoothScroll = "landing";

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.075,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.82,
      touchMultiplier: 1,
      orientation: "vertical",
      gestureOrientation: "vertical",
      overscroll: true,
      anchors: {
        duration: 1.25,
        easing: (time) => 1 - Math.pow(1 - time, 4),
        offset: -16,
      },
      prevent: shouldUseNativeScroll,
    });

    const syncFramerScroll = () => {
      window.dispatchEvent(new Event("scroll"));
    };

    lenis.on("scroll", syncFramerScroll);

    return () => {
      lenis.destroy();
      document.documentElement.removeAttribute("data-smooth-scroll");
    };
  }, [pathname]);

  return children;
}
