"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "@/icons";

interface VariablesPickerProps {
  variables: string[];
  variableValues: Record<string, string>;
  setVariableValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function VariablesPicker({
  variables,
  variableValues,
  setVariableValues,
}: VariablesPickerProps) {
  return (
    <Card className="border border-border/80 bg-secondary/5 backdrop-blur-md rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/40 bg-secondary/10 flex flex-row items-center gap-2 space-y-0">
        <Settings className="w-4 h-4 text-indigo-400" />
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          Variables
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <p className="text-[10px] text-muted-foreground leading-normal font-medium">
          Reference your static or dynamic context in your prompts using{" "}
          <code className="bg-secondary px-1 py-0.5 rounded text-indigo-400 font-semibold">
            {"{{key}}"}
          </code>
          .
        </p>

        {variables.length > 0 ? (
          <div className="border border-border/55 rounded-lg overflow-hidden bg-secondary/5">
            <div className="grid grid-cols-2 bg-secondary/20 px-3 py-1.5 border-b border-border/40 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div className="divide-y divide-border/45">
              {variables.map((v) => (
                <div key={v} className="grid grid-cols-2 items-center px-3 py-2 gap-2 text-xs">
                  <div className="text-[11px] font-semibold text-foreground/80 truncate font-sans" title={v}>
                    {v}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={variableValues[v] || ""}
                      onChange={(e) =>
                        setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      placeholder="Value..."
                      className="w-full bg-secondary/20 border border-border/60 rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:border-indigo-500 text-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-border/80 rounded-lg p-6 text-center text-[11px] text-muted-foreground italic bg-secondary/5">
            No variables detected in prompts.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
