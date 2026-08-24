"use client";
import { useAuth } from "@/context/AuthContext";
import { Card, PageHeader, Pill, SectionHeader } from "../components/ui";

export function AdminsPage() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader
        title="Admins"
        route="/admin/admins"
        description="Only isSystemAdmin accounts can reach /admin, and 2FA is required at the door."
      />

      <Card className="overflow-hidden">
        <SectionHeader title="System administrators" meta="you" />
        <div className="flex items-center gap-3 px-[18px] py-4">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gradient-to-br from-primary to-chart-2 text-[13px] font-bold text-white">
            {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="text-[14px] font-semibold">{user?.name || "System admin"}</div>
            {user?.email && <div className="text-[12px] text-muted-foreground">{user.email}</div>}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Pill tone="good">2FA enforced</Pill>
            <Pill tone="info">isSystemAdmin</Pill>
          </div>
        </div>
      </Card>

      <Card className="mt-3.5 p-5">
        <h3 className="text-sm font-semibold">Granting another admin</h3>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Admin access is a deliberate, out-of-band grant. Run the backend script, then have the
          person enable 2FA in their security settings before they can enter the panel:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-[9px] border border-border bg-muted px-3.5 py-3 font-mono text-[12.5px]">
{`npx ts-node backend/src/scripts/promote-saas-admin.ts --email=person@company.com`}
        </pre>
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          A self-service grant/revoke UI can be added here later — the guardrail is intentional for now.
        </p>
      </Card>
    </div>
  );
}
