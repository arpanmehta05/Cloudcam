export function normalizeOtp(code: unknown): string {
  return String(code || "")
    .trim()
    .replace(/\D/g, "");
}

export function errorStatus(error: any, fallback: number) {
  if (error?.code === "EAUTH") return 503;
  if (typeof error?.status === "number") return error.status;
  if (error?.message?.includes("already registered")) return 409;
  return fallback;
}

export function authErrorMessage(error: any, fallback: string) {
  if (error?.code === "EAUTH") {
    return "Email service login failed. Check SMTP_USER and SMTP_PASS in backend/.env.";
  }
  return error.message || fallback;
}
