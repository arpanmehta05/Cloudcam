"use client";
import { useAsync } from "../hooks";
import { fetchAudit } from "../api";
import { Card, PageHeader, Spinner, ErrorState, SectionHeader } from "../components/ui";
import { formatAction, formatDateTime } from "../format";

export function AuditPage() {
  const { data, loading, error, reload } = useAsync(fetchAudit, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error || "Failed to load"} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Audit log" route="/admin/audit" description="Every admin action, newest first." />
      <Card className="overflow-hidden">
        <SectionHeader title="Activity" meta={`${data.length} entries`} />
        {data.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-[13px] text-muted-foreground">
            No admin actions recorded yet.
          </div>
        ) : (
          data.map((e) => (
            <div
              key={e._id}
              className="flex items-center gap-3 border-b border-border/60 px-[18px] py-3 text-[13px] last:border-none"
            >
              <span className="w-[132px] flex-none font-mono text-[12px] tabular-nums text-muted-foreground">
                {formatDateTime(e.createdAt)}
              </span>
              <span className="w-[150px] flex-none truncate font-medium">
                {e.actorEmail || "admin"}
              </span>
              <span className="text-muted-foreground">{formatAction(e)}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
