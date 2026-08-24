"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle, X } from "@/icons";
import {
  ACTION_EXECUTION_EVENT,
  type ActionExecutionEventDetail,
} from "@/lib/action-events";

type ToastType = "success" | "warning" | "error";

interface ToastState {
  id: string;
  type: ToastType;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

function toToast(detail: ActionExecutionEventDetail): ToastState {
  const status = (detail.status || "").toLowerCase();

  if (detail.message && detail.message.trim()) {
    return {
      id: `${detail.actionRequestId || "unknown"}-${status || "event"}-${Date.now()}`,
      type:
        status === "failed"
          ? "error"
          : status === "partially_failed"
            ? "warning"
            : "success",
      message: detail.message,
    };
  }

  if (status === "failed") {
    return {
      id: `${detail.actionRequestId || "unknown"}-${status}-${Date.now()}`,
      type: "error",
      message: `Action ${detail.actionId || "execution"} failed.`,
    };
  }

  if (status === "partially_failed") {
    return {
      id: `${detail.actionRequestId || "unknown"}-${status}-${Date.now()}`,
      type: "warning",
      message: `Action ${detail.actionId || "execution"} completed with partial failures.`,
    };
  }

  if (
    status === "completed" ||
    status === "simulated" ||
    status === "rolled_back"
  ) {
    const verb = status === "rolled_back" ? "rolled back" : status;
    return {
      id: `${detail.actionRequestId || "unknown"}-${status}-${Date.now()}`,
      type: "success",
      message: `Action ${detail.actionId || "execution"} ${verb}.`,
    };
  }

  return {
    id: `${detail.actionRequestId || "unknown"}-${status || "event"}-${Date.now()}`,
    type: "success",
    message: detail.message || "Action status updated.",
  };
}

export function ActionExecutionToast() {
  const pathname = usePathname();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFingerprintRef = useRef<string>("");

  useEffect(() => {
    const closeToast = () => {
      setToast(null);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onActionEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ActionExecutionEventDetail>;
      const detail = customEvent.detail || {};

      const fingerprint = `${detail.actionRequestId || "na"}|${detail.actionId || "na"}|${detail.status || "na"}|${detail.message || ""}`;
      if (fingerprint === lastFingerprintRef.current) {
        return;
      }
      lastFingerprintRef.current = fingerprint;

      const nextToast = toToast(detail);
      setToast(nextToast);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(closeToast, AUTO_DISMISS_MS);
    };

    window.addEventListener(
      ACTION_EXECUTION_EVENT,
      onActionEvent as EventListener,
    );
    return () => {
      window.removeEventListener(
        ACTION_EXECUTION_EVENT,
        onActionEvent as EventListener,
      );
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const isCanvasPage = pathname === "/simulation" || pathname?.startsWith("/simulations/live-canvas");

  if (isCanvasPage || !toast) return null;

  const tone =
    toast.type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : toast.type === "warning"
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-emerald-50 border-emerald-200 text-emerald-700";

  return (
    <div className="fixed top-4 right-4 z-[95] w-[min(92vw,380px)]">
      <div
        className={`relative rounded-lg border shadow-lg p-3 pr-10 ${tone}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-2 text-sm">
          {toast.type === "error" ? (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : toast.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="absolute top-2 right-2 p-1 rounded text-current/70 hover:text-current"
          aria-label="Dismiss action notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
