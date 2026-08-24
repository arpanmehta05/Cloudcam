export function ok<T>(data: T) {
  return {
    success: true,
    ...(typeof data === "object" && data !== null ? data : { data }),
  };
}

export function okList<T>(items: T[], meta?: { total?: number; page?: number }) {
  return {
    success: true,
    items,
    ...(meta || {}),
  };
}

export function fail(err: any) {
  return {
    success: false,
    error: err?.message || String(err),
    code: err?.code || undefined,
  };
}
