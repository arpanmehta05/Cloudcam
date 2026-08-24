import { promises as dns } from "dns";
import { Agent as HttpsAgent } from "https";
import { isIP } from "net";

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:")
  )
    return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  const ipv4 = normalized.startsWith("::ffff:")
    ? normalized.slice(7)
    : normalized;
  if (isIP(ipv4) !== 4) return false;

  const [a, b] = ipv4.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export async function normalizeAndValidateEndpoint(
  endpoint: string,
  fallback: string,
): Promise<{
  url: string;
  httpsAgent: HttpsAgent;
}> {
  const candidate = (endpoint || fallback).trim();
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    const error: any = new Error("Endpoint must be a valid HTTPS URL.");
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== "https:") {
    const error: any = new Error("Custom endpoints must use HTTPS.");
    error.statusCode = 400;
    throw error;
  }
  if (parsed.username || parsed.password) {
    const error: any = new Error(
      "Endpoint URLs must not contain embedded credentials.",
    );
    error.statusCode = 400;
    throw error;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    const error: any = new Error(
      "Local and private endpoints are not allowed.",
    );
    error.statusCode = 400;
    throw error;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await dns.lookup(hostname, { all: true });
  } catch {
    const error: any = new Error("Endpoint hostname could not be resolved.");
    error.statusCode = 400;
    throw error;
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    const error: any = new Error(
      "Endpoint must resolve only to public network addresses.",
    );
    error.statusCode = 400;
    throw error;
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  if (!cleanPath.endsWith("/chat/completions")) {
    parsed.pathname = `${cleanPath}/chat/completions`;
  }
  parsed.search = "";
  parsed.hash = "";

  const selectedAddress = addresses[0];
  const httpsAgent = new HttpsAgent({
    lookup: ((_hostname: string, options: any, callback: any) => {
      if (options?.all) {
        callback(null, addresses);
        return;
      }
      callback(null, selectedAddress.address, selectedAddress.family);
    }) as any,
  });

  return { url: parsed.toString(), httpsAgent };
}
