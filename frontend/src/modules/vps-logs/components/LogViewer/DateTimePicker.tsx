"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowRight, Calendar as CalendarIcon, Check, Clock3, Info } from "@/icons";

interface DateTimePickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

export function DateTimePicker({ label, value, onChange }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const date = value ? new Date(value) : null;

  const displayValue = date
    ? date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Select date & time";

  const dateStr = value ? value.split("T")[0] : "";
  const timeStr = value && value.includes("T") ? value.split("T")[1].slice(0, 5) : "";

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
        <Clock3 className="h-3 w-3" /> {label}
      </Label>
      <Button
        variant="outline"
        className="w-[240px] justify-between text-left font-bold h-11 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center">
          <CalendarIcon className="mr-2.5 h-4 w-4 text-primary" />
          <span className="text-slate-900">{displayValue}</span>
        </div>
        <ArrowRight className="h-3 w-3 text-slate-300" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[360px] p-0 overflow-hidden border-slate-200 shadow-2xl rounded-2xl">
          <DialogHeader className="bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)] border-b border-slate-100 p-5 space-y-0 text-left">
            <DialogTitle className="flex items-center gap-2 mb-1">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-extrabold text-slate-900">{label}</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500 leading-relaxed">
              Pick a specific moment to filter your logs.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Date</Label>
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  value={dateStr}
                  onChange={(e) => {
                    const nextTime = timeStr || "00:00";
                    onChange(`${e.target.value}T${nextTime}:00`);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Time</Label>
                <input
                  type="time"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  value={timeStr}
                  onChange={(e) => {
                    const nextDate = dateStr || new Date().toISOString().split("T")[0];
                    onChange(`${nextDate}T${e.target.value}:00`);
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-blue-55 bg-blue-50/50 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <p className="text-[11px] font-medium text-blue-700 leading-normal">
                  Logs are archived in S3 every hour. Real-time logs from the last 24h are always available instantly.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-11 font-bold text-slate-600 rounded-xl" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1 h-11 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20" onClick={() => setIsOpen(false)}>
                <Check className="h-4 w-4 mr-2" /> Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
