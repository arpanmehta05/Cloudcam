import type { TerraformCompiler } from "../compiler";
import { injectImplicitInfrastructureAzure } from "./azure";
import { injectImplicitInfrastructureGcp } from "./gcp";
import { injectImplicitInfrastructureAws } from "./aws";

export function injectImplicitInfrastructure(compiler: TerraformCompiler) {
  const baseName = (compiler.req.name || "simulation")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
  const shortId = compiler.req.deploymentId
    ? `-${compiler.req.deploymentId.substring(0, 8)}`
    : "";

  if ((compiler as any).provider === "azure") {
    injectImplicitInfrastructureAzure(compiler, baseName, shortId);
  } else if ((compiler as any).provider === "gcp") {
    injectImplicitInfrastructureGcp(compiler, baseName, shortId);
  } else {
    injectImplicitInfrastructureAws(compiler, baseName, shortId);
  }
}
