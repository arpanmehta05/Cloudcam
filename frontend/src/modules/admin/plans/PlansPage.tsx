"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAsync } from "../hooks";
import { fetchPlans } from "../api";
import { Card, PageHeader, Spinner, ErrorState, Pill, SectionHeader } from "../components/ui";
import { limitLabel } from "../format";

export function PlansPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(fetchPlans, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error || "Failed to load"} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Plans"
        route="/admin/plans"
        actions={
          <Link
            href="/admin/plans/new"
            className="inline-flex items-center gap-2 rounded-[9px] bg-gradient-to-b from-primary/90 to-primary px-3.5 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.14),0_2px_8px_rgba(26,86,219,0.28)]"
          >
            + New plan
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <SectionHeader title="All plans" meta={`${data.length} total · click a row to edit`} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-muted-foreground">
                <th className="border-b border-border/60 px-[18px] py-2.5">Plan</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Price</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Workspaces</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Retention</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Visibility</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr
                  key={p.key}
                  onClick={() => router.push(`/admin/plans/${p.key}`)}
                  className="cursor-pointer transition hover:bg-accent/50"
                >
                  <td className="border-b border-border/60 px-[18px] py-3">
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">{p.key}</span>
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {p.price ? `$${p.price}` : "$0"}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {limitLabel(p.limits?.workspaces)}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {limitLabel(p.limits?.retentionDays)}d
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3">
                    {p.isPublic ? <Pill tone="good">Public</Pill> : <Pill tone="off">Hidden</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
