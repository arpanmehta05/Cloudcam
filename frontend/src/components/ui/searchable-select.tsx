"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check } from "@/icons";

interface SearchableSelectOption {
    value: string;
    label: string;
    description?: string;
    badge?: string;
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    disabled = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            setSearchQuery("");
        }
    }, [isOpen]);

    const filteredOptions = options.filter((opt) => {
        const query = searchQuery.toLowerCase();
        return (
            opt.label.toLowerCase().includes(query) ||
            (opt.description && opt.description.toLowerCase().includes(query)) ||
            opt.value.toLowerCase().includes(query)
        );
    });

    const handleSelect = (val: string) => {
        onValueChange(val);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isOpen ? "ring-2 ring-blue-500 border-blue-500 dark:ring-blue-600 dark:border-blue-600" : ""
                }`}
            >
                <div className="flex flex-col items-start text-left truncate pr-2">
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    {selectedOption?.description && (
                        <span className="text-[10px] text-slate-400 font-normal truncate max-w-full">
                            {selectedOption.description}
                        </span>
                    )}
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 z-50 mt-2 flex flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-2.5 shadow-2xl backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 max-h-80 select-none animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search Input */}
                    <div className="relative mb-2 flex items-center border-b border-slate-100 dark:border-slate-850 pb-2">
                        <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full bg-transparent pl-8 pr-3 py-1 text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 dark:text-slate-100"
                        />
                    </div>

                    {/* Scrollable list */}
                    <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 max-h-56 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs font-medium text-slate-400">
                                No options found
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const selected = opt.value === value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all focus:outline-none ${
                                            selected
                                                ? "bg-slate-100 text-blue-600 dark:bg-slate-850 dark:text-blue-400"
                                                : "text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                                        }`}
                                    >
                                        <div className="flex flex-col truncate pr-2">
                                            <div className="flex items-center space-x-2">
                                                <span className="truncate">{opt.label}</span>
                                                {opt.badge && (
                                                    <span className="rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 text-[9px] font-black tracking-wide uppercase">
                                                        {opt.badge}
                                                    </span>
                                                )}
                                            </div>
                                            {opt.description && (
                                                <span className={`text-[10px] font-normal truncate mt-0.5 ${selected ? "text-blue-500/70 dark:text-blue-400/70" : "text-slate-400"}`}>
                                                    {opt.description}
                                                </span>
                                            )}
                                        </div>
                                        {selected && <Check className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400 ml-1" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
