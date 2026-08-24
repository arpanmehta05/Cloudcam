import { Button } from "@/components/ui/button";
import { Play, Plus, RefreshCw } from "@/icons";

type LiveCanvasLambdaCodeEditorProps = {
  serviceId: string;
  selectedProvider: string;
  lambdaFilename: string;
  isLambdaCodeLoading: boolean;
  lambdaCode: string | null;
  setLambdaCode: (value: string | null) => void;
  setIsCodeDirty: (value: boolean) => void;
  isCodeDirty: boolean;
  setDeployCodeModalOpen: (value: boolean) => void;
  isActionLoading: boolean;
};

export function LiveCanvasLambdaCodeEditor({
  serviceId,
  selectedProvider,
  lambdaFilename,
  isLambdaCodeLoading,
  lambdaCode,
  setLambdaCode,
  setIsCodeDirty,
  isCodeDirty,
  setDeployCodeModalOpen,
  isActionLoading,
}: LiveCanvasLambdaCodeEditorProps) {
  if (serviceId !== "lambda" || selectedProvider !== "aws") return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Function Code ({lambdaFilename})</h3>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline dark:text-emerald-400 cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            Upload File
            <input
              type="file"
              accept=".js,.mjs,.py"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const text = evt.target?.result;
                  if (typeof text === "string") {
                    setLambdaCode(text);
                    setIsCodeDirty(true);
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
      
      {isLambdaCodeLoading ? (
        <div className="flex items-center justify-center h-48 rounded-lg border border-border bg-slate-950 p-4">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">Fetching live code...</span>
        </div>
      ) : lambdaCode !== null ? (
        <div className="space-y-2">
          <textarea
            value={lambdaCode}
            onChange={(e) => {
              setLambdaCode(e.target.value);
              setIsCodeDirty(true);
            }}
            className="w-full h-64 rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 leading-relaxed resize-y"
            placeholder="Write your Lambda function code here..."
          />
          {isCodeDirty && (
            <Button
              variant="default"
              className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              onClick={() => setDeployCodeModalOpen(true)}
              disabled={isActionLoading}
            >
              <Play className="mr-2 h-4 w-4" /> Save & Deploy Code
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-slate-950 p-4 text-center text-xs text-muted-foreground">
          Could not fetch code for this function.
        </div>
      )}
    </div>
  );
}
