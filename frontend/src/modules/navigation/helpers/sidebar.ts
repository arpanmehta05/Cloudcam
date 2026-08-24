import { LayoutDashboard } from "@/icons";
import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { NavGroup, NavItem, SidebarSection } from "../types";
import { navGroups, searchableNavItems } from "../config/groups.config";
import { localizeNavItem, localizeNavItems } from "../utils/localization";

export function getRelatedNavItems(
  pathname: string,
): Array<NavItem & { group: string }> {
  const activeGroups = getVisibleNavGroups(pathname);
  const activeHrefs = new Set(
    activeGroups.flatMap((group) => group.items.map((item) => item.href)),
  );

  if (pathname.startsWith("/ai-observability")) {
    return [
      ...navGroups
        .find((group) => group.section === "operations")!
        .items.filter((item) =>
          [
            "/settings/ai-observability",
            "/settings/ai-keys",
            "/dashboards/cost",
            "/settings/reports",
          ].includes(item.href),
        )
        .map((item) => ({ ...item, group: "Related" })),
    ];
  }

  if (pathname.startsWith("/dashboards")) {
    return navGroups
      .filter((group) => ["operations", "ai"].includes(group.section))
      .flatMap((group) =>
        group.items
          .slice(0, 4)
          .map((item) => ({ ...item, group: group.label })),
      )
      .filter((item) => !activeHrefs.has(item.href))
      .slice(0, 5);
  }

  return [
    {
      ...navGroups.find((group) => group.section === "compute")!.items[0],
      group: "AWS",
    },
    {
      ...navGroups.find((group) => group.section === "data")!.items[0],
      group: "AWS",
    },
    {
      ...navGroups.find((group) => group.section === "ai")!.items[0],
      label: "AI Observability",
      group: "AI",
    },
    {
      ...navGroups.find((group) => group.section === "operations")!.items[0],
      group: "Ops",
    },
  ].filter((item) => !activeHrefs.has(item.href));
}

export function getVisibleNavGroups(pathname: string): NavGroup[] {
  if (pathname.startsWith("/ai-observability")) {
    return navGroups.filter((group) => group.section === "ai");
  }

  if (
    pathname.startsWith("/actions") ||
    pathname.startsWith("/cost-savings") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/dashboards/cost") ||
    pathname.startsWith("/dashboards/alerts") ||
    pathname.startsWith("/profile")
  ) {
    return navGroups.filter((group) => group.section === "operations");
  }

  const match = Object.keys(SERVICE_REGISTRY).find((key) =>
    pathname.startsWith(`/dashboards/${key}`),
  );
  if (match) {
    const config = SERVICE_REGISTRY[match];
    if (config.category === "compute" || config.category === "serverless") {
      return navGroups.filter((group) => group.section === "compute");
    }
    if (config.category === "database" || config.category === "storage") {
      return navGroups.filter((group) => group.section === "data");
    }
    if (config.category === "networking" || config.category === "security") {
      return navGroups.filter((group) => group.section === "infrastructure");
    }
  }

  if (pathname.startsWith("/dpdp-compliance")) {
    return navGroups.filter((group) => group.section === "compliance");
  }

  if (
    pathname.startsWith("/simulations") ||
    pathname.startsWith("/simulation")
  ) {
    return navGroups.filter((group) => group.section === "simulation");
  }

  return navGroups.filter((group) => group.section === "main");
}

export function getSidebarTitle(pathname: string, provider?: string) {
  if (pathname.startsWith("/ai-observability")) return "AI Observability";

  if (
    pathname.startsWith("/actions") ||
    pathname.startsWith("/cost-savings") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/dashboards/cost") ||
    pathname.startsWith("/dashboards/alerts") ||
    pathname.startsWith("/profile")
  ) {
    return "Operations";
  }

  const match = Object.keys(SERVICE_REGISTRY).find((key) =>
    pathname.startsWith(`/dashboards/${key}`),
  );
  if (match) {
    const config = SERVICE_REGISTRY[match];
    if (config.category === "compute" || config.category === "serverless")
      return "Compute";
    if (config.category === "database" || config.category === "storage")
      return "Data";
    if (config.category === "networking" || config.category === "security")
      return "Infrastructure";
    if (config.category === "cost") return "Operations";
  }

  if (
    pathname.startsWith("/simulations") ||
    pathname.startsWith("/simulation")
  ) {
    return "Simulations";
  }

  if (pathname.startsWith("/services")) return "Services";
  return "CloudWatcher";
}

export function getSidebarSections(
  pathname: string,
  provider?: string,
): SidebarSection[] {
  const p = provider || "aws";

  if (
    pathname.startsWith("/actions") ||
    pathname.startsWith("/cost-savings") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/dashboards/cost") ||
    pathname.startsWith("/dashboards/alerts") ||
    pathname.startsWith("/profile")
  ) {
    return [
      {
        label: "Operations",
        defaultOpen: true,
        items: localizeNavItems(
          navGroups.find((group) => group.section === "operations")!.items,
          p,
        ),
      },
    ];
  }

  const match = Object.keys(SERVICE_REGISTRY).find((key) =>
    pathname.startsWith(`/dashboards/${key}`),
  );
  if (match) {
    const config = SERVICE_REGISTRY[match];
    if (config.category === "compute" || config.category === "serverless") {
      return [
        {
          label: "Compute Services",
          defaultOpen: true,
          items: localizeNavItems(
            navGroups.find((group) => group.section === "compute")!.items,
            p,
          ),
        },
      ];
    }
    if (config.category === "database" || config.category === "storage") {
      return [
        {
          label: "Data Services",
          defaultOpen: true,
          items: localizeNavItems(
            navGroups.find((group) => group.section === "data")!.items,
            p,
          ),
        },
      ];
    }
    if (config.category === "networking" || config.category === "security") {
      return [
        {
          label: "Infrastructure",
          defaultOpen: true,
          items: localizeNavItems(
            navGroups.find((group) => group.section === "infrastructure")!
              .items,
            p,
          ),
        },
      ];
    }
  }

  if (pathname.startsWith("/ai-observability")) {
    return [
      {
        label: "AI Observability",
        defaultOpen: true,
        items: localizeNavItems(
          navGroups.find((group) => group.section === "ai")!.items,
          p,
        ),
      },
    ];
  }

  if (
    pathname.startsWith("/simulations") ||
    pathname.startsWith("/simulation")
  ) {
    return [
      {
        label: "Simulation",
        defaultOpen: true,
        items: localizeNavItems(
          navGroups.find((group) => group.section === "simulation")!.items,
          p,
        ),
      },
    ];
  }

  // Default: show the Main group
  const mainGroup = navGroups.find((group) => group.section === "main")!;
  return [
    {
      label: "Overview",
      defaultOpen: true,
      items: localizeNavItems(mainGroup.items, p),
    },
  ];
}

export function matchSearchItem(
  item: any,
  query: string,
  provider: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  // Check localized label first
  const localized = localizeNavItem(item, provider);
  if (localized.label.toLowerCase().includes(normalized)) return true;

  // Check default label, group, href, keywords
  if (item.label.toLowerCase().includes(normalized)) return true;
  if (item.group?.toLowerCase().includes(normalized)) return true;
  if (item.href.toLowerCase().includes(normalized)) return true;
  if (
    item.keywords?.some((kw: string) => kw.toLowerCase().includes(normalized))
  )
    return true;

  // Check alternative cloud display names if this is a cloud service
  const serviceId = item.href.split("/").pop();
  if (serviceId && SERVICE_REGISTRY[serviceId]) {
    const config = SERVICE_REGISTRY[serviceId];
    if (config.displayName.toLowerCase().includes(normalized)) return true;
    if (config.azureDisplayName?.toLowerCase().includes(normalized))
      return true;
    if (config.gcpDisplayName?.toLowerCase().includes(normalized)) return true;
    if (serviceId.toLowerCase().includes(normalized)) return true;
  }

  return false;
}
