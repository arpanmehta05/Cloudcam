import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ScoreConfig } from "../api";

type ScoreConfigGridProps = {
  configs: ScoreConfig[];
};

export function ScoreConfigGrid({ configs }: ScoreConfigGridProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {configs.map((config) => (
        <Card key={config._id} className="rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{config.name}</p>
              <Badge variant="outline">{config.dataType}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {config.description || "Score definition"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
