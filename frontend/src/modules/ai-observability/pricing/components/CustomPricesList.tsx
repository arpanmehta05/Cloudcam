import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomModelPrice } from "../api";

type CustomPricesListProps = {
  prices: CustomModelPrice[];
  money: (value: number) => string;
};

export function CustomPricesList({ prices, money }: CustomPricesListProps) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-0">
        {prices.length ? (
          prices.map((price) => (
            <div
              key={price._id}
              className="grid gap-3 border-b p-4 md:grid-cols-[1fr_140px_140px_100px]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{price.modelName}</p>
                <p className="text-xs text-muted-foreground">
                  {price.provider}
                </p>
              </div>
              <span className="text-sm">
                {money(price.inputPricePerMToken)} / MTok in
              </span>
              <span className="text-sm">
                {money(price.outputPricePerMToken)} / MTok out
              </span>
              <Badge variant={price.isActive ? "default" : "outline"}>
                {price.matchPattern}
              </Badge>
            </div>
          ))
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            No custom pricing overrides configured.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
