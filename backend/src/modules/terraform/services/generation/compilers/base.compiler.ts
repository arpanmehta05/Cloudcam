import {
  TfNodeInput,
  TerraformCompiler,
} from "../index";

export interface CompilerArgs {
  node: TfNodeInput;
  config: any;
  name: string;
  r: string;
  suffix: string;
  deps: string[];
  providerData: any;
  // Azure-specific context
  rgNameVal?: string;
  rgDep?: string[];
}

export interface ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void;
}
