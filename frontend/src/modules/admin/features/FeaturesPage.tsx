"use client";
import { useState } from "react";
import { ApiClientError } from "@/lib/auth-fetch";
import { useAsync } from "../hooks";
import { fetchFeatures, createFeature } from "../api";
import {
  Card,
  PageHeader,
  Btn,
  Field,
  TextInput,
  Toggle,
  Pill,
  Spinner,
  ErrorState,
  SectionHeader,
} from "../components/ui";

export function FeaturesPage() {
  const { data, loading, error, reload } = useAsync(fetchFeatures, []);
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setFormError(null);
    try {
      await createFeature({ key, name });
      setKey("");
      setName("");
      setAdding(false);
      reload();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Failed to add feature");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error || "Failed to load"} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Feature registry"
        route="/admin/features"
        description="Register a feature once — it appears in every plan and tenant automatically."
        actions={
          <Btn variant="primary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Close" : "+ Add feature"}
          </Btn>
        }
      />

      {adding && (
        <Card className="mb-3.5 p-5">
          <h3 className="mb-3.5 text-sm font-semibold">New feature</h3>
          {formError && (
            <div className="mb-3 rounded-[9px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="AI Observability" />
            </Field>
            <Field label="Key (slug)" hint="Lowercase, e.g. ai_observability">
              <TextInput
                className="font-mono text-[12.5px]"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase())}
                placeholder="ai_observability"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2.5">
            <Btn variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={submit} disabled={saving}>
              {saving ? "Adding…" : "Add feature"}
            </Btn>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <SectionHeader title="Features" meta={`${data.length} registered`} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-muted-foreground">
                <th className="border-b border-border/60 px-[18px] py-2.5">Feature</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Key</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">On plans</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Overrides</th>
                <th className="border-b border-border/60 px-[18px] py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.key}>
                  <td className="border-b border-border/60 px-[18px] py-3 font-semibold">{f.name}</td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono text-[12px] text-muted-foreground">
                    {f.key}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {f.onPlans}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3 font-mono tabular-nums">
                    {f.overrides}
                  </td>
                  <td className="border-b border-border/60 px-[18px] py-3">
                    {f.isActive ? <Pill tone="good">Active</Pill> : <Pill tone="off">Inactive</Pill>}
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
