"use client";

import { useState } from "react";

type Faq = {
  question: string;
  answer: string;
};

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ul className="mt-6 divide-y divide-[#E8EDF5] dark:divide-slate-800 border-y border-[#E8EDF5] dark:border-slate-800">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;

        return (
          <li key={faq.question}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${index}`}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-start justify-between gap-6 py-5 text-left transition-colors hover:text-primary"
            >
              <span className="text-base font-semibold leading-7 text-[#0F172A] dark:text-white">{faq.question}</span>
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#D8E1F0] dark:border-slate-700 text-sm font-semibold text-[#1A56DB] dark:text-primary">
                {isOpen ? "-" : "+"}
              </span>
            </button>

            <div
              id={`faq-answer-${index}`}
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="pb-5 pr-12 text-base leading-7 text-[#526072] dark:text-slate-400">{faq.answer}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
