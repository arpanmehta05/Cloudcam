export const AL2023_SSM_PARAMETER =
  "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64";

const LEGACY_MANAGED_AL2023_AMIS = new Set([
  "ami-0a59ec92177ec3fad",
  "ami-0942ecd5d85156929",
  "ami-0ed053767d172c588",
  "ami-03c7c01f7de0b37ad",
  "ami-0607aedcdc4d6d482",
  "ami-071878317c449ae48",
  "ami-068e0f1a6003057e0",
  "ami-060e277c0d4cce553",
  "ami-0d52744d6389d3385",
]);

export function shouldUseProvidedAmi(providedAmi?: unknown): providedAmi is string {
  if (typeof providedAmi !== "string") return false;
  const ami = providedAmi.trim();
  return ami.startsWith("ami-") && !LEGACY_MANAGED_AL2023_AMIS.has(ami);
}
