"use client";
import { useRouter } from "next/navigation";
import { useAsync } from "../hooks";
import { fetchTenants } from "../api";
import { Card, PageHeader, Spinner, ErrorState, Pill, SectionHeader } from "../components/ui";

export function TenantsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(fetchTenants, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error || "Failed to load"} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Tenants" route="/admin/tenants" description={`${data.length} customer accounts`} />

      <Card className="overflow-hidden">
        <SectionHeader title="All tenants" meta="click a row to manage" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-muted-foreground">
                <th className="border-b border-border/60 px-[18px] py-2.5">Tenant</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Plan</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Clouds</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Seats</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/admin/tenants/${t.id}`)}
                  className="cursor-pointer transition hover:bg-accent/50"
                >
                  <td className="border-b border-border/60 px-[18px] py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-gradient-to-br from-chart-3 to-chart-5 text-[11px] font-bold text-white">
                        {(t.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        {t.email && (
                          <div className="text-[11.5px] text-muted-foreground">{t.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3">
                    {t.planKey ? <Pill tone="info">{t.planKey}</Pill> : <Pill tone="off">none</Pill>}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {t.clouds}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {t.seats}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {t.overrides}
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
