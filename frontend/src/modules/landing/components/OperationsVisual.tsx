"use client";

import { Activity, Check, DollarSign } from "@/icons";

export function OperationsVisual() {
  const workflows = [
    {
      eyebrow: "FinOps workflow",
      title: "Investigate spend",
      icon: DollarSign,
      accent: "#1A56DB",
      rows: [
        "Compute / platform / us-east-1",
        "Network egress / networking / ap-south-1",
        "Model gateway / ai-platform / us-east-1",
      ],
    },
    {
      eyebrow: "Operations workflow",
      title: "Debug reliability",
      icon: Activity,
      accent: "#06B6D4",
      rows: [
        "Client errors increased 18%",
        "TTFT p95 crossed 1.4s",
        "3 models affected",
      ],
    },
  ];
  const wf = workflows[0];

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center"
          style={{ color: wf.accent }}
        >
          <wf.icon className="h-7 w-7 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
        </span>
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
            {wf.eyebrow}
          </p>
          <p className="text-sm font-extrabold text-[#0F172A]">{wf.title}</p>
        </div>
        <span className="ml-auto rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#14532D]">
          Live
        </span>
      </div>

      <div className="space-y-2">
        {wf.rows.map((row, i) => (
          <div
            key={row}
            className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-sm"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
              style={{ backgroundColor: wf.accent }}
            >
              {i + 1}
            </span>
            <span className="text-xs font-semibold text-[#334155]">{row}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
            Ready for teams
          </p>
          <div className="mt-2 flex gap-4">
            {["Owner detected", "Evidence attached", "Next action ready"].map(
              (item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 text-[10px] font-semibold text-[#334155]"
                >
                  <Check className="h-3 w-3 text-[#22C55E]" />
                  {item}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
