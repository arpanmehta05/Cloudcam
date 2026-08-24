"use client";

import { Boxes, Database } from "@/icons";
import type { DeepReport } from "../reportData";
import { SectionShell, SectionHead } from "./primitives";

export function ArchitectureBlueprint({ deep }: { deep: DeepReport }) {
  if (!deep.recommendedModules.length && !deep.dataModels.length) return null;

  return (
    <SectionShell padded={false}>
      <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <SectionHead
          eyebrow="Target architecture"
          title="The harness we recommend building"
          sub="Concrete modules and data models the audit recommends to close the gaps — a build sheet, not a wish list."
          icon={Boxes}
          accent="#1A56DB"
        />
      </div>
      <div className="grid gap-px bg-[#E2E8F0] lg:grid-cols-2">
        <BlueprintColumn
          icon={Boxes}
          accent="#1A56DB"
          title="Recommended modules"
          items={deep.recommendedModules}
          empty="No module recommendations submitted."
        />
        <BlueprintColumn
          icon={Database}
          accent="#64748B"
          title="Recommended data models"
          items={deep.dataModels}
          empty="No data models submitted."
        />
      </div>
    </SectionShell>
  );
}

function BlueprintColumn({
  icon: Icon,
  accent,
  title,
  items,
  empty,
}: {
  icon: typeof Boxes;
  accent: string;
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${accent}12`, color: accent }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-extrabold text-[#0F172A]">{title}</p>
        <span className="ml-auto text-xs font-bold text-[#94A3B8]">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3.5 py-2.5">
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-extrabold"
                style={{ backgroundColor: `${accent}14`, color: accent }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-xs font-semibold leading-5 text-[#334155]">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[#94A3B8]">{empty}</p>
      )}
    </div>
  );
}
