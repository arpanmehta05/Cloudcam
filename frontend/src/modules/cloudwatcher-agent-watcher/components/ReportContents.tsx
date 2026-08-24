"use client";

import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
}

/**
 * Sticky "contents" rail for the report. Anchors smooth-scroll to each section
 * and the active item tracks scroll position via IntersectionObserver. Sits
 * directly under the global navbar (sticky top-0, h-16).
 */
export function ReportContents({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 3) return null;

  const handleClick = (id: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  };

  return (
    <div className="sticky top-16 z-30 -mx-4 border-y border-[#E7ECF2] bg-white/90 backdrop-blur-md lg:-mx-6">
      <nav className="mx-auto max-w-7xl px-4 lg:px-6">
        <ul className="flex items-stretch justify-center gap-6 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => {
            const isActive = active === section.id;
            return (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  onClick={handleClick(section.id)}
                  className={`-mb-px flex items-center whitespace-nowrap border-b-2 py-3 text-[13px] font-bold tracking-tight transition-colors ${
                    isActive ? "border-[#0F172A] text-[#0F172A]" : "border-transparent text-[#94A3B8] hover:text-[#475569]"
                  }`}
                >
                  {section.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
