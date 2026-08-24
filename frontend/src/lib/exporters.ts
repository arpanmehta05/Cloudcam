// ─── AI Observability Export Utilities ───
// CSV and JSON exporters for tables and request detail.

/**
 * Convert an array of objects to a CSV string.
 * Auto-generates headers from the first object's keys.
 */
export function toCSV<T extends Record<string, any>>(rows: T[], columns?: { key: keyof T; label: string }[]): string {
    if (rows.length === 0) return "";

    const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k }));
    const header = cols.map((c) => `"${String(c.label)}"`).join(",");

    const body = rows.map((row) =>
        cols
            .map((c) => {
                const val = row[c.key];
                if (val === null || val === undefined) return '""';
                if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                return `"${String(val).replace(/"/g, '""')}"`;
            })
            .join(",")
    ).join("\n");

    return `${header}\n${body}`;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/csv") {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Download data as CSV.
 */
export function exportCSV<T extends Record<string, any>>(
    rows: T[],
    filename: string,
    columns?: { key: keyof T; label: string }[]
) {
    const csv = toCSV(rows, columns);
    downloadFile(csv, filename, "text/csv");
}

/**
 * Download data as JSON.
 */
export function exportJSON(data: any, filename: string) {
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, filename, "application/json");
}
