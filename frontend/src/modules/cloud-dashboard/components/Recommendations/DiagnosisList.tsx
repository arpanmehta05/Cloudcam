import React from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle, AlertTriangle } from "@/icons";
import { Diagnosis } from "../../hooks/useGeminiRecommendations";

interface DiagnosisListProps {
    diagnosis: Diagnosis[];
}

export function DiagnosisList({ diagnosis }: DiagnosisListProps) {
    if (!diagnosis || diagnosis.length === 0) return null;

    return (
        <div>
            <h2 className="text-sm font-medium text-foreground mb-3">
                Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {diagnosis.map((diag, i) => (
                    <Card key={i} className="p-3 bg-white dark:bg-[#07111F]">
                        <div className="flex items-center gap-2 mb-1">
                            {diag.status === "healthy" ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            )}
                            <span className="text-sm font-medium text-foreground">
                                {diag.title}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {diag.details}
                        </p>
                    </Card>
                ))}
            </div>
        </div>
    );
}
