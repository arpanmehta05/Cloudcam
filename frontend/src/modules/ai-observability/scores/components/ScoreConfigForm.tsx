import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ScoreDataType } from "../api";

type ScoreConfigFormProps = {
  name: string;
  dataType: ScoreDataType;
  onNameChange: (name: string) => void;
  onDataTypeChange: (dataType: ScoreDataType) => void;
  onCreate: () => void;
};

export function ScoreConfigForm({
  name,
  dataType,
  onNameChange,
  onDataTypeChange,
  onCreate,
}: ScoreConfigFormProps) {
  return (
    <Card className="rounded-lg">
      <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_120px]">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="accuracy, tone, helpfulness"
        />
        <select
          className="rounded-md border bg-background px-3 text-sm"
          value={dataType}
          onChange={(event) =>
            onDataTypeChange(event.target.value as ScoreDataType)
          }
        >
          <option value="numeric">Numeric</option>
          <option value="categorical">Categorical</option>
          <option value="boolean">Boolean</option>
          <option value="text">Text</option>
        </select>
        <Button onClick={onCreate}>Create</Button>
      </CardContent>
    </Card>
  );
}
