"use client";

import { ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { ScoreConfigForm } from "./components/ScoreConfigForm";
import { ScoreConfigGrid } from "./components/ScoreConfigGrid";
import { useScoreSettings } from "./hooks/useScoreSettings";

export default function ScoresPage() {
  const { configs, name, setName, dataType, setDataType, create } =
    useScoreSettings();

  return (
    <ObservabilityPageShell title="Scores" subtitle="Quality score definitions and observed feedback signals.">
      <ScoreConfigForm
        name={name}
        dataType={dataType}
        onNameChange={setName}
        onDataTypeChange={setDataType}
        onCreate={create}
      />
      <ScoreConfigGrid configs={configs} />
    </ObservabilityPageShell>
  );
}
