"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "@/icons";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat/ChatWindow";

const HIDDEN_PATHS = new Set(["/", "/login", "/signup", "/simulation", "/simulations/live-canvas"]);

export function GlobalAiAgentWidget() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const isHidden = useMemo(() => HIDDEN_PATHS.has(pathname), [pathname]);

    useEffect(() => {
        // Close on route changes to avoid carrying stale context unexpectedly.
        setIsOpen(false);
    }, [pathname]);

    useEffect(() => {
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, []);

    if (isHidden) return null;

    return (
        <>
            {isOpen && (
                <button
                    type="button"
                    aria-label="Close AI agent"
                    className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 pointer-events-none">
                <div
                    aria-hidden={!isOpen}
                    className={`h-[min(78vh,740px)] w-[min(94vw,420px)] rounded-2xl border border-border shadow-2xl overflow-hidden bg-card transition-all duration-200 ${isOpen
                        ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                        : "opacity-0 translate-y-2 scale-[0.98] pointer-events-none"
                        }`}
                >
                    <ChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
                </div>

                <Button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    className="pointer-events-auto h-12 w-12 rounded-full shadow-xl"
                    aria-label={isOpen ? "Close AI agent" : "Open AI agent"}
                >
                    {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </Button>
            </div>
        </>
    );
}
