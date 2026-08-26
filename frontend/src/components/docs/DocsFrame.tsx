import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Info, Lightbulb } from "@/icons";
import { Navbar } from "@/components/Navbar";
import { FaqAccordion } from "@/components/docs/FaqAccordion.client";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock.client";
import { DocsDesktopNav, DocsMobileNav } from "@/components/docs/DocsNav.client";
import { DocsReveal, DocsRevealSection } from "@/components/docs/DocsMotion.client";
import type { DocsPage, DocsSection } from "@/lib/docs-content";

const BRAND_NAME = "Cloudcam";
const BRAND_SUBTITLE = "By Fonder";

const docsHeaderLinks = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
  { label: "Getting Started", href: "/docs/getting-started" },
  { label: "Cloud Setup", href: "/docs/multicloud-setup" },
  { label: "AI Observability", href: "/docs/ai-observability" },
  { label: "FAQ", href: "/docs/faq" },
];

function Note({
  note,
}: {
  note: NonNullable<DocsSection["note"]>;
}) {
  const styles = {
    info: {
      icon: Info,
      border: "border-[#DBEAFE] dark:border-blue-900/40",
      bg: "bg-[#F8FBFF] dark:bg-blue-950/20",
      iconColor: "text-[#1A56DB] dark:text-[#6BA3F8]",
    },
    tip: {
      icon: Lightbulb,
      border: "border-[#DDF3E4] dark:border-green-900/40",
      bg: "bg-[#F7FFF9] dark:bg-green-950/20",
      iconColor: "text-[#16A34A] dark:text-[#4ADE80]",
    },
    warning: {
      icon: AlertTriangle,
      border: "border-[#FED7AA] dark:border-orange-900/40",
      bg: "bg-[#FFF9F3] dark:bg-orange-950/20",
      iconColor: "text-[#EA6C1A] dark:text-[#FB923C]",
    },
  }[note.tone];

  const Icon = styles.icon;

  return (
    <div className={`mt-6 border-l-2 pl-4 ${styles.border}`}>
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${styles.bg}`}>
        <Icon className={`h-4 w-4 ${styles.iconColor}`} />
      </div>
      <p className="mt-3 text-sm font-semibold text-[#0F172A] dark:text-white">{note.title}</p>
      <p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-slate-400">{note.body}</p>
    </div>
  );
}

function Toc({ sections }: { sections: DocsSection[] }) {
  if (sections.length === 0) return null;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-[104px]">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-slate-400">On this page</p>
        <div className="space-y-2 border-l border-[#E8EDF5] dark:border-slate-800 pl-4">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="block text-sm text-[#64748B] dark:text-slate-400 transition-colors hover:text-[#1A56DB] dark:hover:text-primary">
              {section.title}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Pager({ prev, next }: { prev: DocsPage | null; next: DocsPage | null }) {
  return (
    <div className="mt-12 grid gap-6 border-t border-[#E8EDF5] dark:border-slate-800 pt-8 md:grid-cols-2">
      {prev ? (
        <Link href={prev.path} className="group text-left">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-slate-400">Previous</p>
          <p className="mt-3 text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white transition-colors group-hover:text-primary">
            {prev.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-slate-400">{prev.title}</p>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link href={next.path} className="group text-right">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-slate-400">Next</p>
          <p className="mt-3 text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white transition-colors group-hover:text-primary">
            {next.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-slate-400">{next.title}</p>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

export function DocsFrame({
  page,
  prev,
  next,
  children,
}: {
  page: DocsPage;
  prev: DocsPage | null;
  next: DocsPage | null;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        links={docsHeaderLinks}
        brand={{ label: BRAND_NAME, subtitle: BRAND_SUBTITLE, ariaLabel: `${BRAND_NAME} documentation home` }}
        cta={{ label: "Start free", href: "/signup" }}
        mobileInlineAction={<DocsMobileNav />}
        variant="docs"
      />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 lg:pl-[300px] lg:pr-8 xl:grid-cols-[minmax(0,1fr)_200px]">
        <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-[280px] border-r border-[#E8EDF5] dark:border-slate-800 bg-background dark:bg-[#050D1A] lg:block">
          <DocsDesktopNav />
        </aside>

        <main className="min-w-0">
          <div className="max-w-3xl">
            <DocsReveal className="border-b border-[#E8EDF5] dark:border-slate-800 pb-8">
              <p className="text-sm font-semibold text-[#1A56DB] dark:text-[#6BA3F8]">{page.eyebrow ?? page.group}</p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-5xl">{page.title}</h1>
              <p className="mt-5 text-lg leading-8 text-[#526072] dark:text-slate-300">{page.description}</p>
              {page.intro ? <p className="mt-5 text-base leading-7 text-[#64748B] dark:text-slate-400">{page.intro}</p> : null}
              {children}
            </DocsReveal>

            {page.sections.map((section, index) => (
              <DocsRevealSection
                key={section.id}
                id={section.id}
                delay={Math.min(index * 0.04, 0.16)}
                className="scroll-mt-28 border-b border-[#E8EDF5] dark:border-slate-800 py-10 last:border-b-0"
              >
                <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">{section.title}</h2>

                {section.paragraphs?.map((paragraph, index) => (
                  <p key={index} className="mt-4 text-base leading-7 text-[#64748B] dark:text-slate-400">
                    {paragraph}
                  </p>
                ))}

                {section.table ? (
                  <div className="mt-6 overflow-x-auto rounded-xl border border-[#E8EDF5] dark:border-slate-800 bg-white dark:bg-[#0B1728]/30">
                    <table className="w-full min-w-[600px] border-collapse text-left text-sm text-[#4B5565] dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-[#0F172A] dark:text-slate-200 border-b border-[#E8EDF5] dark:border-slate-800">
                        <tr>
                          {section.table.headers.map((header) => (
                            <th key={header} className="px-6 py-3.5 font-bold tracking-wide uppercase text-[11px] text-slate-500 dark:text-slate-400">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EDF5] dark:divide-slate-800/80">
                        {section.table.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-6 py-4 leading-6 text-slate-700 dark:text-slate-300 font-medium">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {section.codeBlocks?.length ? (
                  <div className="mt-6 space-y-4">
                    {section.codeBlocks.map((block, index) => (
                      <DocsCodeBlock key={`${section.id}-code-${index}`} {...block} />
                    ))}
                  </div>
                ) : null}

                {section.bullets?.length ? (
                  <ul className="mt-6 space-y-3 text-sm leading-6 text-[#4B5565] dark:text-slate-400">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1A56DB] dark:bg-[#6BA3F8]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {section.faqs?.length ? <FaqAccordion faqs={section.faqs} /> : null}

                {section.note ? <Note note={section.note} /> : null}
              </DocsRevealSection>
            ))}

            <DocsReveal>
              <Pager prev={prev} next={next} />
            </DocsReveal>

            <DocsRevealSection className="mt-12 border-t border-[#E8EDF5] dark:border-slate-800 pt-8">
              <p className="text-sm font-semibold text-[#1A56DB] dark:text-[#6BA3F8]">Need more help?</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">Keep moving with the right next guide</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#64748B] dark:text-slate-400">
                If your team still runs into setup issues, empty dashboards, billing delays, callback failures, or alerting problems, continue with troubleshooting before re-running the entire onboarding flow.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/docs/troubleshooting"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#1A56DB] dark:bg-primary dark:text-primary-foreground px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1040A0] dark:hover:bg-primary/95"
                >
                  Open troubleshooting <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/docs/multicloud-setup"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-[#D8E1F0] dark:border-slate-800 bg-white dark:bg-[#0B1728] px-5 text-sm font-semibold text-[#0F172A] dark:text-slate-200 transition-colors hover:border-[#BFDBFE] dark:hover:border-slate-700 hover:text-[#1A56DB] dark:hover:text-primary"
                >
                  Review cloud setup
                </Link>
              </div>
            </DocsRevealSection>
          </div>
        </main>

        <Toc sections={page.sections} />
      </div>
    </div>
  );
}
