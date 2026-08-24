/**
 * Design Token Constants — TypeScript mirror of tokens.css
 * Use for programmatic contexts: chart configs, canvas drawing, inline styles.
 * For CSS, always prefer `var(--token-name)` over these constants.
 */

/* ─── Light Mode Colors ─── */
export const colors = {
  // Surfaces
  background: "#f8fafc",
  foreground: "#0f172a",
  card: "#ffffff",
  cardForeground: "#0f172a",

  // Primary
  primary: "#1a56db",
  primaryForeground: "#ffffff",

  // Secondary
  secondary: "#eff6ff",
  secondaryForeground: "#0f172a",

  // Muted
  muted: "#f1f5f9",
  mutedForeground: "#64748b",

  // Accent
  accent: "#eff6ff",
  accentForeground: "#1a56db",

  // Semantic
  destructive: "#ef4444",
  border: "#e2e8f0",
  input: "#cbd5e1",
  ring: "#1a56db",

  // Sidebar
  sidebar: "#ffffff",
  sidebarForeground: "#0f172a",
  sidebarPrimary: "#1a56db",
  sidebarBorder: "#e2e8f0",
  sidebarAccent: "#eff6ff",
} as const;

/* ─── Dark Mode Colors ─── */
export const colorsDark = {
  background: "#020617",
  foreground: "#ffffff",
  card: "#0b1728",
  cardForeground: "#ffffff",
  primary: "#6ba3f8",
  primaryForeground: "#020617",
  secondary: "#10213a",
  secondaryForeground: "#ffffff",
  muted: "#07111f",
  mutedForeground: "#94a3b8",
  accent: "#10213a",
  accentForeground: "#6ba3f8",
  destructive: "#f87171",
  border: "#1e293b",
  input: "#24344d",
  ring: "#6ba3f8",
  sidebar: "#050d1a",
  sidebarForeground: "#ffffff",
  sidebarPrimary: "#6ba3f8",
  sidebarBorder: "#1e293b",
  sidebarAccent: "#10213a",
} as const;

/* ─── Chart Palette (light) ─── */
export const chartColors = {
  blue: "#1a56db",
  cyan: "#06b6d4",
  orange: "#f97316",
  green: "#22c55e",
  red: "#ef4444",
} as const;

/* ─── Chart Palette (dark) ─── */
export const chartColorsDark = {
  blue: "#6ba3f8",
  cyan: "#22d3ee",
  orange: "#fb923c",
  green: "#4ade80",
  red: "#f87171",
} as const;

/* ─── Border Radius ─── */
export const radius = {
  base: "0.5rem",
  sm: "calc(0.5rem - 4px)",
  md: "calc(0.5rem - 2px)",
  lg: "0.5rem",
  xl: "calc(0.5rem + 4px)",
  "2xl": "calc(0.5rem + 8px)",
} as const;

/* ─── CSS variable references (use in chart configs etc.) ─── */
export const cssVars = {
  primary: "var(--primary)",
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  border: "var(--border)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  chart1: "var(--chart-1)",
  chart2: "var(--chart-2)",
  chart3: "var(--chart-3)",
  chart4: "var(--chart-4)",
  chart5: "var(--chart-5)",
} as const;
