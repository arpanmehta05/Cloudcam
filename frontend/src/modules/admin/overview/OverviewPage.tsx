"use client";
import Link from "next/link";
import { useAsync } from "../hooks";
import { fetchOverview, fetchAudit } from "../api";
import { Card, PageHeader, StatTile, Spinner, ErrorState, SectionHeader } from "../components/ui";
import { formatAction, timeAgo } from "../format";

export function OverviewPage() {
  const overview = useAsync(fetchOverview, []);
  const audit = useAsync(fetchAudit, []);

  if (overview.loading) return <Spinner />;
  if (overview.error || !overview.data)
    return <ErrorState message={overview.error || "Failed to load"} onRetry={overview.reload} />;

  const o = overview.data;
  const recent = (audit.data || []).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Overview"
        route="/admin"
        actions={
          <Link
            href="/admin/plans/new"
            className="inline-flex items-center gap-2 rounded-[9px] bg-gradient-to-b from-primary/90 to-primary px-3.5 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.14),0_2px_8px_rgba(26,86,219,0.28)]"
          >
            + New plan
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile label="Tenants" value={o.tenantCount.toLocaleString()} />
        <StatTile label="MRR" value={`$${o.mrr.toLocaleString()}`} />
        <StatTile label="Paid tenants" value={o.paidTenants.toLocaleString()} />
        <StatTile
          label="Custom deals"
          value={o.customDeals.toLocaleString()}
          delta={o.customDeals ? "review" : undefined}
          deltaTone="warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-[18px]">
          <div className="text-[13px] font-medium text-muted-foreground">
            Plans &amp; revenue
          </div>
          <svg viewBox="0 0 320 150" preserveAspectRatio="none" className="mt-2 h-[150px] w-full">
            <defs>
              <linearGradient id="admin-mrr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity="0.24" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,120 C36,112 52,98 80,92 C112,85 128,74 160,64 C196,53 214,40 250,32 C280,25 300,16 320,12 L320,150 L0,150 Z"
              fill="url(#admin-mrr)"
            />
            <path
              d="M0,120 C36,112 52,98 80,92 C112,85 128,74 160,64 C196,53 214,40 250,32 C280,25 300,16 320,12"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="320" cy="12" r="3.6" fill="var(--primary)" />
          </svg>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {o.activePlans} active plans · {o.currency} {o.mrr.toLocaleString()}/mo recurring
          </div>
        </Card>

        <Card>
          <SectionHeader title="Recent activity" meta="audit" />
          {recent.length === 0 ? (
            <div className="px-[18px] py-6 text-[13px] text-muted-foreground">No activity yet.</div>
          ) : (
            recent.map((e) => (
              <div
                key={e._id}
                className="flex items-center gap-3 border-b border-border/60 px-[18px] py-3 text-[13px] last:border-none"
              >
                <span className="text-muted-foreground">{formatAction(e)}</span>
                <span className="ml-auto flex-none text-[11.5px] text-muted-foreground/80">
                  {timeAgo(e.createdAt)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
