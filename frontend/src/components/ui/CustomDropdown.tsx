"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check } from "@/icons";

export interface DropdownOption {
    value: string;
    label: string;
    description?: string;
    badge?: string;
}

export interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    searchable?: boolean; // Toggle search bar on and off
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
    allowCustom?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    options,
    value,
    onChange,
    label,
    placeholder = "Select option...",
    searchable = true,
    searchPlaceholder = "Search...",
    disabled = false,
    className = "",
    allowCustom = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value) || (value ? { value, label: value, description: "Custom Value" } : undefined);

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

    // Focus input when dropdown opens and search is enabled
    useEffect(() => {
        if (isOpen && searchable && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            setSearchQuery("");
        }
    }, [isOpen, searchable]);

    const filteredOptions = options.filter((opt) => {
        const query = searchQuery.toLowerCase();
        return (
            opt.label.toLowerCase().includes(query) ||
            (opt.description && opt.description.toLowerCase().includes(query)) ||
            opt.value.toLowerCase().includes(query)
        );
    });

    const showCustomOption = allowCustom && searchQuery.trim() !== "" && !options.some(
        opt => opt.value.toLowerCase() === searchQuery.trim().toLowerCase() || opt.label.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    const displayOptions = showCustomOption
        ? [
              {
                  value: searchQuery.trim(),
                  label: searchQuery.trim(),
                  description: "Use Custom Value",
                  badge: "CUSTOM",
              },
              ...filteredOptions,
          ]
        : filteredOptions;

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative w-full ${isOpen ? "z-50" : ""} ${className}`}>
            {label && (
                <span className="block mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#64748B] dark:text-[#94A3B8]">
                    {label}
                </span>
            )}
            
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex h-10 w-full items-center justify-between rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] outline-none transition focus:border-[#1A56DB] dark:border-[#334155] dark:bg-[#07111F] dark:text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                    isOpen ? "border-[#1A56DB] ring-1 ring-[#1A56DB]" : ""
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
                <div className="absolute left-0 right-0 z-50 mt-2 flex flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-950 max-h-80 select-none animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search Input (Conditional) */}
                    {searchable && (
                        <div className="relative mb-2 flex items-center border-b border-slate-100 dark:border-slate-800 pb-2">
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
                    )}

                    {/* Scrollable list */}
                    <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 max-h-56 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {displayOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs font-medium text-slate-400">
                                No options found
                            </div>
                        ) : (
                            displayOptions.map((opt) => {
                                const selected = opt.value === value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition-all focus:outline-none ${
                                            selected
                                                ? "bg-slate-100 text-[#1A56DB] dark:bg-slate-800 dark:text-white"
                                                : "text-slate-855 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                                        }`}
                                    >
                                        <div className="flex flex-col truncate pr-2">
                                            <div className="flex items-center space-x-2">
                                                <span className="truncate">{opt.label}</span>
                                                {opt.badge && (
                                                    <span className="rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 text-[9px] font-black tracking-wide uppercase">
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
