import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { NavItem } from "../types";

export function localizeNavItem(item: NavItem, provider: string): NavItem {
  const serviceId = item.href.split("/").pop();
  if (serviceId && SERVICE_REGISTRY[serviceId]) {
    const config = SERVICE_REGISTRY[serviceId];
    let label = item.label;
    if (provider === "azure" && config.azureDisplayName) {
      label = config.azureDisplayName;
    } else if (provider === "gcp" && config.gcpDisplayName) {
      label = config.gcpDisplayName;
    }
    return { ...item, label };
  }
  return item;
}

export function localizeNavItems(
  items: NavItem[],
  provider: string,
): NavItem[] {
  return items.map((item) => localizeNavItem(item, provider));
}
