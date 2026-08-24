"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from "@/icons";

interface CustomDatePickerProps {
    value: string; // Format: YYYY-MM-DD
    onChange: (value: string) => void;
    maxDate?: string; // Format: YYYY-MM-DD
    minDate?: string; // Format: YYYY-MM-DD
    placeholder?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    value,
    onChange,
    maxDate,
    minDate,
    placeholder = "Select Date"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse initial value
    const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
        if (!value) return null;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    });

    // Calendar navigation state
    const [currentMonth, setCurrentMonth] = useState<number>(() => {
        const d = selectedDate || new Date();
        return d.getMonth();
    });
    const [currentYear, setCurrentYear] = useState<number>(() => {
        const d = selectedDate || new Date();
        return d.getFullYear();
    });

    // Sync selectedDate from prop if it changes externally
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setSelectedDate(d);
                setCurrentMonth(d.getMonth());
                setCurrentYear(d.getFullYear());
            }
        } else {
            setSelectedDate(null);
        }
    }, [value]);

    // Close popover when clicking outside
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

    // Month Names
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Day calculations
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    // Prepare calendar cells
    const cells: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const tempDate = new Date(currentYear, currentMonth - 1, d);
        cells.push({ day: d, isCurrentMonth: false, date: tempDate });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const tempDate = new Date(currentYear, currentMonth, d);
        cells.push({ day: d, isCurrentMonth: true, date: tempDate });
    }

    // Next month filler days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const tempDate = new Date(currentYear, currentMonth + 1, d);
        cells.push({ day: d, isCurrentMonth: false, date: tempDate });
    }

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const isSelected = (date: Date) => {
        if (!selectedDate) return false;
        return (
            date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
        );
    };

    const isDateDisabled = (date: Date) => {
        const dateString = date.toISOString().split("T")[0];
        
        if (maxDate && dateString > maxDate) {
            return true;
        }
        if (minDate && dateString < minDate) {
            return true;
        }
        return false;
    };

    const handleSelectDay = (date: Date) => {
        if (isDateDisabled(date)) return;
        
        // Format to local date string YYYY-MM-DD
        const year = date.getFullYear();
        const monthStr = String(date.getMonth() + 1).padStart(2, "0");
        const dayStr = String(date.getDate()).padStart(2, "0");
        const formatted = `${year}-${monthStr}-${dayStr}`;

        setSelectedDate(date);
        onChange(formatted);
        setIsOpen(false);
    };

    // Format display label
    const getFormattedValue = () => {
        if (!selectedDate) return placeholder;

        const dayName = selectedDate.toLocaleDateString([], { weekday: "short" });
        const monthName = selectedDate.toLocaleDateString([], { month: "short" });
        const day = selectedDate.getDate();
        const year = selectedDate.getFullYear();

        return `${dayName}, ${monthName} ${day}, ${year}`;
    };

    return (
        <div ref={containerRef} className="relative w-fit min-w-[180px]">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex h-9 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 ${
                    isOpen ? "ring-2 ring-blue-500 border-blue-500 dark:ring-blue-600 dark:border-blue-600" : ""
                }`}
            >
                <div className="flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>{getFormattedValue()}</span>
                </div>
                <ChevronRight className="h-3 w-3 text-slate-400 rotate-90" />
            </button>

            {isOpen && (
                <div className="absolute left-0 z-50 mt-2 flex flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 w-[280px] select-none animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between pb-3">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                            {months[currentMonth]} {currentYear}
                        </span>
                        <div className="flex items-center space-x-1">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Weekday labels */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pb-1">
                        <span>Su</span>
                        <span>Mo</span>
                        <span>Tu</span>
                        <span>We</span>
                        <span>Th</span>
                        <span>Fr</span>
                        <span>Sa</span>
                    </div>

                    {/* Grid Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((cell, idx) => {
                            const disabled = isDateDisabled(cell.date);
                            const selected = isSelected(cell.date);
                            const current = cell.isCurrentMonth;
                            const today = isToday(cell.date);

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleSelectDay(cell.date)}
                                    className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all focus:outline-none ${
                                        selected
                                            ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md scale-105"
                                            : today
                                            ? "border border-blue-500 text-blue-600 dark:text-blue-400"
                                            : current
                                            ? "text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            : "text-slate-300 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                                    } ${disabled ? "opacity-20 cursor-not-allowed text-slate-300 dark:text-slate-700 hover:bg-transparent dark:hover:bg-transparent" : ""}`}
                                >
                                    {cell.day}
                                    {today && !selected && (
                                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500 dark:bg-blue-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
