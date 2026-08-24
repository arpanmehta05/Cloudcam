"use client";

import { useEffect, useState } from "react";
import { scoresApi, type ScoreConfig, type ScoreDataType } from "../api";

export function useScoreSettings() {
  const [configs, setConfigs] = useState<ScoreConfig[]>([]);
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<ScoreDataType>("numeric");

  const refresh = () =>
    scoresApi.listScoreConfigs().then(setConfigs).catch(() => setConfigs([]));

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    if (!name.trim()) return;
    await scoresApi.createScoreConfig({
      name,
      dataType,
      minValue: 0,
      maxValue: 100,
    });
    setName("");
    refresh();
  }

  return {
    configs,
    name,
    setName,
    dataType,
    setDataType,
    create,
  };
}
