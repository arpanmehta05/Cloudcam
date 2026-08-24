"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

type RevealSectionProps = RevealProps & {
  id?: string;
};

function revealTransition(delay = 0) {
  return {
    duration: 0.45,
    delay,
    ease: [0.2, 0, 0.2, 1] as const,
  };
}

export function DocsReveal({ children, className = "", delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={revealTransition(delay)}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function DocsRevealSection({ children, className = "", delay = 0, id }: RevealSectionProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <section id={id} className={className}>
        {children}
      </section>
    );
  }

  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.14 }}
      transition={revealTransition(delay)}
      className={className}
    >
      {children}
    </motion.section>
  );
}
