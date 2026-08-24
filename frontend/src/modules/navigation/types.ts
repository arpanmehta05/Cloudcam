import type { LucideIcon } from "@/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  /** Alternate names users might type (synonyms, old names, acronyms). */
  aliases?: string[];
  /** One-line explanation shown as a subtitle in search / directories. */
  description?: string;
  /**
   * Search-only grouping label. Lets us regroup items in the command palette
   * without changing the sidebar `section` routing. Defaults to the group label.
   */
  category?: string;
  /**
   * When true, this item is only visible to system admins (isSystemAdmin).
   * Derived from the group `section` in `allNavItems`; gates discovery in the
   * services directory and command palette so non-admins never see it.
   */
  systemAdminOnly?: boolean;
};

export type SearchResult = NavItem & {
  group: string;
  category: string;
  /** Relevance score assigned by the search engine (higher is better). */
  score: number;
};

export type NavGroup = {
  label: string;
  section:
    | "main"
    | "compute"
    | "data"
    | "infrastructure"
    | "compliance"
    | "ai"
    | "operations"
    | "simulation"
    | "saas-admin";
  items: NavItem[];
};

/**
 * The shape the command palette renders — covers both engine results
 * (with score/category) and lightweight "recent search" entries.
 */
export type PaletteItem = {
  href: string;
  label: string;
  group?: string;
  category?: string;
  description?: string;
  icon?: LucideIcon;
  score?: number;
};

export type SidebarSection = {
  label: string;
  defaultOpen?: boolean;
  items: NavItem[];
};
