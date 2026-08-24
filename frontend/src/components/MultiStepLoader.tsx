"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "@/icons";

interface Step {
  title: string;
}

interface MultiStepLoaderProps {
  steps: Step[];
  currentStep: number;
}

export function MultiStepLoader({ steps, currentStep }: MultiStepLoaderProps) {
  const allDone = currentStep >= steps.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, transition: { duration: 0.15 } }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        {steps.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Initializing…
          </p>
        )}

        <div className="space-y-3.5">
          {steps.map((step, i) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;

            return (
              <div key={i}>
                <div className="flex items-center gap-3">
                  <motion.div
                    layout
                    style={{
                      borderColor: isCompleted
                        ? "#22c55e"
                        : isCurrent
                          ? "#64748b"
                          : "#3f3f46",
                    }}
                    animate={{
                      backgroundColor: isCompleted ? "#22c55e" : "#ffffff00",
                      borderColor: isCompleted
                        ? "#22c55e"
                        : isCurrent
                          ? "#64748b"
                          : "#3f3f46",
                    }}
                    transition={{ duration: 0.25 }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                  >
                    <AnimatePresence mode="wait">
                      {isCompleted ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Check
                            className="h-3.5 w-3.5 text-white"
                            strokeWidth={3}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="dot"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="h-2 w-2 rounded-full bg-foreground"
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-muted-foreground"
                        : isCurrent
                          ? "text-foreground font-medium"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {step.title}
                  </span>

                  {isCurrent && (
                    <div
                      className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  )}
                </div>

                {i < steps.length - 1 && (
                  <div className="ml-3 mt-1 h-3.5 w-px bg-border" />
                )}
              </div>
            );
          })}
        </div>

        {!allDone && steps.length > 0 && (
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{
                width: `${Math.min((currentStep / steps.length) * 100, 100)}%`,
              }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
