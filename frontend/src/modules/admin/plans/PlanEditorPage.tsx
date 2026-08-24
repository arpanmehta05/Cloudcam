"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiClientError } from "@/lib/auth-fetch";
import { fetchPlan, fetchFeatures, createPlan, updatePlan } from "../api";
import type { Feature, Plan, PlanLimits } from "../types";
import {
  Card,
  PageHeader,
  Btn,
  Field,
  TextInput,
  Toggle,
  Spinner,
  SectionHeader,
} from "../components/ui";

type Draft = {
  key: string;
  name: string;
  price: string;
  isPublic: boolean;
  limits: { workspaces: string; cloudConnections: string; retentionDays: string; seats: string };
  features: Record<string, boolean>;
};

const EMPTY: Draft = {
  key: "",
  name: "",
  price: "0",
  isPublic: true,
  limits: { workspaces: "", cloudConnections: "", retentionDays: "", seats: "" },
  features: {},
};

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function PlanEditorPage() {
  const router = useRouter();
  const params = useParams<{ key?: string }>();
  const editKey = params?.key;
  const isEdit = Boolean(editKey);

  const [features, setFeatures] = useState<Feature[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const feats = await fetchFeatures();
        let plan: Plan | null = null;
        if (editKey) plan = await fetchPlan(editKey);
        if (!alive) return;
        setFeatures(feats.filter((f) => f.isActive));
        if (plan) {
          setDraft({
            key: plan.key,
            name: plan.name,
            price: String(plan.price ?? 0),
            isPublic: plan.isPublic,
            limits: {
              workspaces: plan.limits?.workspaces?.toString() ?? "",
              cloudConnections: plan.limits?.cloudConnections?.toString() ?? "",
              retentionDays: plan.limits?.retentionDays?.toString() ?? "",
              seats: plan.limits?.seats?.toString() ?? "",
            },
            features: plan.features || {},
          });
        }
      } catch (e) {
        if (alive) setError(e instanceof ApiClientError ? e.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editKey]);

  async function save() {
    setSaving(true);
    setError(null);
    const limits: PlanLimits = {
      workspaces: numOrNull(draft.limits.workspaces),
      cloudConnections: numOrNull(draft.limits.cloudConnections),
      retentionDays: numOrNull(draft.limits.retentionDays),
      seats: numOrNull(draft.limits.seats),
    };
    const payload = {
      name: draft.name,
      price: Number(draft.price) || 0,
      isPublic: draft.isPublic,
      limits,
      features: draft.features,
    };
    try {
      if (isEdit) await updatePlan(editKey!, payload);
      else await createPlan({ ...payload, key: draft.key });
      router.push("/admin/plans");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  const enabledCount = Object.values(draft.features).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit plan · ${draft.name}` : "Create plan"}
        route={isEdit ? "/admin/plans/[key]" : "/admin/plans/new"}
        actions={
          <>
            <Btn variant="ghost" onClick={() => router.push("/admin/plans")}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save plan"}
            </Btn>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-[9px] border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3.5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Details</h3>
            <p className="mb-3.5 mt-0.5 text-[12.5px] text-muted-foreground">
              Name your plan and set its unique key.
            </p>
            <div className="flex flex-col gap-3.5">
              <Field label="Plan name">
                <TextInput
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Pro"
                />
              </Field>
              <Field
                label="Plan key (slug)"
                hint={
                  <>
                    Used in code &amp; URLs — <span className="font-mono">/admin/plans/{draft.key || "key"}</span>. Lowercase, no spaces.
                  </>
                }
              >
                <TextInput
                  className="font-mono text-[12.5px]"
                  value={draft.key}
                  disabled={isEdit}
                  onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase() })}
                  placeholder="pro"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (USD / mo)">
                  <TextInput
                    className="font-mono"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                </Field>
                <Field label="Visibility">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDraft({ ...draft, isPublic: !draft.isPublic });
                      }
                    }}
                    className="flex w-full cursor-pointer items-center justify-between rounded-[9px] border border-input bg-background px-3 py-2 text-[13.5px]"
                  >
                    {draft.isPublic ? "Public" : "Hidden (custom)"}
                    <Toggle checked={draft.isPublic} ariaLabel="Toggle visibility" />
                  </div>
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Limits</h3>
            <p className="mb-3.5 mt-0.5 text-[12.5px] text-muted-foreground">
              Numeric entitlements. Leave blank for unlimited.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["workspaces", "Workspaces"],
                  ["cloudConnections", "Cloud connections"],
                  ["retentionDays", "Retention (days)"],
                  ["seats", "Seats"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <TextInput
                    className="font-mono"
                    value={draft.limits[key]}
                    placeholder="∞"
                    onChange={(e) =>
                      setDraft({ ...draft, limits: { ...draft.limits, [key]: e.target.value } })
                    }
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 pb-2 pt-5">
              <h3 className="text-sm font-semibold">Features included</h3>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Toggle what this plan unlocks. New registry features appear here automatically.
              </p>
            </div>
            {features.length === 0 ? (
              <div className="px-5 py-5 text-[13px] text-muted-foreground">
                No features registered yet. Add some under Features.
              </div>
            ) : (
              features.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 border-t border-border/60 px-5 py-3"
                >
                  <div>
                    <div className="text-[13px] font-medium">{f.name}</div>
                    <div className="font-mono text-[11.5px] text-muted-foreground">{f.key}</div>
                  </div>
                  <div className="ml-auto">
                    <Toggle
                      checked={!!draft.features[f.key]}
                      ariaLabel={`Toggle ${f.name}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          features: { ...draft.features, [f.key]: !draft.features[f.key] },
                        })
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <Card className="sticky top-3 p-[18px]">
          <h4 className="text-[12.5px] font-semibold">Live preview</h4>
          <div className="mt-3 rounded-xl border border-dashed border-border p-3.5">
            <div className="text-[15px] font-semibold">{draft.name || "Plan name"}</div>
            <div className="my-1 text-2xl font-bold tracking-tight">
              ${Number(draft.price) || 0}
              <span className="text-xs font-normal text-muted-foreground"> /mo</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5 text-[12px] text-muted-foreground">
              <li>{draft.limits.workspaces || "∞"} workspaces</li>
              <li>{draft.limits.retentionDays || "∞"}-day retention</li>
              <li>{enabledCount} features unlocked</li>
              <li>{draft.isPublic ? "Public plan" : "Hidden / custom"}</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
