"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from "@/icons";

interface CustomDateTimePickerProps {
    value: string; // Format: YYYY-MM-DDTHH:mm or ISO string
    onChange: (value: string) => void;
    placeholder?: string;
    minDate?: Date;
}

export const CustomDateTimePicker: React.FC<CustomDateTimePickerProps> = ({
    value,
    onChange,
    placeholder = "Select date & time",
    minDate = new Date()
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse initial value or default to now/tomorrow
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

    // Time picker states
    const [hour, setHour] = useState<number>(() => {
        if (selectedDate) {
            const h = selectedDate.getHours();
            return h === 0 ? 12 : h > 12 ? h - 12 : h;
        }
        return 12;
    });
    const [minute, setMinute] = useState<number>(() => {
        if (selectedDate) {
            return selectedDate.getMinutes();
        }
        return 0;
    });
    const [ampm, setAmpm] = useState<"AM" | "PM">(() => {
        if (selectedDate) {
            return selectedDate.getHours() >= 12 ? "PM" : "AM";
        }
        return "PM";
    });

    // Sync selectedDate from prop if it changes externally
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setSelectedDate(d);
                setCurrentMonth(d.getMonth());
                setCurrentYear(d.getFullYear());
                const h = d.getHours();
                setHour(h === 0 ? 12 : h > 12 ? h - 12 : h);
                setMinute(d.getMinutes());
                setAmpm(h >= 12 ? "PM" : "AM");
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

    const isPast = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date.getTime() < today.getTime();
    };

    // Construct final datetime ISO string and call onChange
    const updateDateTime = (date: Date, h: number, m: number, ap: "AM" | "PM") => {
        const finalDate = new Date(date);
        
        // Convert 12 hour to 24 hour format
        let rawHour = h;
        if (ap === "PM" && h < 12) rawHour = h + 12;
        if (ap === "AM" && h === 12) rawHour = 0;

        finalDate.setHours(rawHour, m, 0, 0);

        // Format to local date-time string YYYY-MM-DDTHH:mm
        const year = finalDate.getFullYear();
        const monthStr = String(finalDate.getMonth() + 1).padStart(2, "0");
        const dayStr = String(finalDate.getDate()).padStart(2, "0");
        const hourStr = String(finalDate.getHours()).padStart(2, "0");
        const minStr = String(finalDate.getMinutes()).padStart(2, "0");

        const localStr = `${year}-${monthStr}-${dayStr}T${hourStr}:${minStr}`;
        setSelectedDate(finalDate);
        onChange(localStr);
    };

    const handleSelectDay = (date: Date) => {
        if (isPast(date)) return;
        updateDateTime(date, hour, minute, ampm);
    };

    const handleTimeChange = (newHour: number, newMin: number, newAmPm: "AM" | "PM") => {
        setHour(newHour);
        setMinute(newMin);
        setAmpm(newAmPm);

        const baseDate = selectedDate || new Date();
        updateDateTime(baseDate, newHour, newMin, newAmPm);
    };

    // Format display label for the button
    const getFormattedValue = () => {
        if (!selectedDate) return placeholder;

        const dayName = selectedDate.toLocaleDateString([], { weekday: "short" });
        const monthName = selectedDate.toLocaleDateString([], { month: "short" });
        const day = selectedDate.getDate();
        const tString = selectedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

        return `${dayName}, ${monthName} ${day} at ${tString}`;
    };

    // Minutes array (options)
    const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 ${
                    isOpen ? "ring-2 ring-blue-500 border-blue-500 dark:ring-blue-600 dark:border-blue-600" : ""
                }`}
            >
                <div className="flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>{getFormattedValue()}</span>
                </div>
                <Clock className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 z-50 mt-2 flex flex-col md:flex-row rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 md:w-[480px] select-none animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {/* Calendar Section (Left) */}
                    <div className="flex-1 pr-0 md:pr-4">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between pb-3">
                            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
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
                                const disabled = isPast(cell.date);
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
                                        } ${disabled ? "opacity-30 cursor-not-allowed text-slate-300 dark:text-slate-700 hover:bg-transparent dark:hover:bg-transparent" : ""}`}
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

                    {/* Time Picker Section (Right) */}
                    <div className="mt-4 flex flex-col border-t border-slate-100 pt-4 md:mt-0 md:w-36 md:border-l md:border-t-0 md:pl-4 md:pt-0 dark:border-slate-800">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-2 flex items-center space-x-1.5">
                            <Clock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                            <span>Select Time</span>
                        </span>

                        <div className="flex flex-1 items-center space-x-2 md:flex-col md:space-x-0 md:space-y-3 justify-center">
                            {/* Hours Select Grid */}
                            <div className="flex flex-col space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Hour</label>
                                <select
                                    value={hour}
                                    onChange={(e) => handleTimeChange(Number(e.target.value), minute, ampm)}
                                    className="h-8 w-16 md:w-28 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                        <option key={h} value={h}>
                                            {String(h).padStart(2, "0")}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Minutes Select Grid */}
                            <div className="flex flex-col space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Minute</label>
                                <select
                                    value={minute}
                                    onChange={(e) => handleTimeChange(hour, Number(e.target.value), ampm)}
                                    className="h-8 w-16 md:w-28 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                                >
                                    {minuteOptions.map((m) => (
                                        <option key={m} value={m}>
                                            {String(m).padStart(2, "0")}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* AM/PM Toggle Buttons */}
                            <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 mt-2 bg-slate-50 dark:bg-slate-900 w-fit">
                                <button
                                    type="button"
                                    onClick={() => handleTimeChange(hour, minute, "AM")}
                                    className={`px-2 py-1 text-[10px] font-black rounded-md transition-colors ${
                                        ampm === "AM"
                                            ? "bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                                            : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                    }`}
                                >
                                    AM
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTimeChange(hour, minute, "PM")}
                                    className={`px-2 py-1 text-[10px] font-black rounded-md transition-colors ${
                                        ampm === "PM"
                                            ? "bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                                            : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                    }`}
                                >
                                    PM
                                </button>
                            </div>
                        </div>

                        {/* Apply Button */}
                        <button
                            type="button"
                            onClick={() => {
                                // Default selection to now if not set
                                if (!selectedDate) {
                                    updateDateTime(new Date(), hour, minute, ampm);
                                }
                                setIsOpen(false);
                            }}
                            className="mt-4 flex h-8 items-center justify-center space-x-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-md transition-opacity hover:opacity-90 w-full"
                        >
                            <Check className="h-3.5 w-3.5" />
                            <span>Confirm</span>
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
};
