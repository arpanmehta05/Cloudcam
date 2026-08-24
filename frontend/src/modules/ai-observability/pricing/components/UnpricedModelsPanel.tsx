import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "@/icons";
import type { UnpricedModelRow } from "../api";

type UnpricedModelsPanelProps = {
  unpricedModels: UnpricedModelRow[];
};

export function UnpricedModelsPanel({
  unpricedModels,
}: UnpricedModelsPanelProps) {
  if (unpricedModels.length === 0) return null;

  return (
    <Card className="rounded-lg border-amber-300 bg-amber-50 text-amber-950">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-semibold">
              Unpriced models need attention
            </p>
          </div>
          <Badge variant="outline" className="border-amber-400 text-amber-900">
            {unpricedModels.length}
          </Badge>
        </div>
        <div className="divide-y divide-amber-200">
          {unpricedModels.slice(0, 6).map((model) => (
            <div
              key={`${model.provider}:${model.model}`}
              className="grid gap-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_110px_120px_150px]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{model.model}</p>
                <p className="text-xs text-amber-800">{model.provider}</p>
              </div>
              <span>{model.requests.toLocaleString()} requests</span>
              <span>{model.tokens.toLocaleString()} tokens</span>
              <span className="text-xs text-amber-800">
                {model.lastSeenAt
                  ? new Date(model.lastSeenAt).toLocaleString()
                  : "recently seen"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
