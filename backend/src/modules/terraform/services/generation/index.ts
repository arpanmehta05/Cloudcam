export * from "./types";
export * from "./helpers";
export * from "./registry";
export * from "./compiler";

import { TfRequest, TfResult } from "./types";
import { TerraformCompiler } from "./compiler";

export function generateTerraformJson(req: TfRequest): TfResult {
  const compiler = new TerraformCompiler(req);
  return compiler.compile();
}
