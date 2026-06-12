import {
  Globe,
  Presentation,
  FileText,
  Film,
  Sparkles,
  Building2,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Leaf,
  Anchor,
  Zap,
  Landmark,
  Factory,
  Ship,
  Plane,
  Cpu,
  Wheat,
  Banknote,
  Hammer,
  Lightbulb,
  Network,
  type LucideIcon,
} from "lucide-react";

// Slugs are dynamic now; `ItemCategory` is an alias for string for code clarity.
export type ItemCategory = string;

export type CategoryBehavior = "website" | "pdf" | "docs" | "video";

export type Category = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  behavior: CategoryBehavior;
  is_builtin: boolean;
  sort_order: number;
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Globe,
  Presentation,
  FileText,
  Film,
  Sparkles,
  Building2,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Leaf,
  Anchor,
  Zap,
  Landmark,
  Factory,
  Ship,
  Plane,
  Cpu,
  Wheat,
  Banknote,
  Hammer,
  Lightbulb,
  Network,
};

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  if (name && CATEGORY_ICONS[name]) return CATEGORY_ICONS[name];
  return Globe;
}

export function findCategory(
  categories: Category[] | undefined,
  slug: string | null | undefined,
): Category | undefined {
  if (!slug || !categories) return undefined;
  return categories.find((c) => c.slug === slug);
}

export function categoryBehavior(
  categories: Category[] | undefined,
  slug: string | null | undefined,
): CategoryBehavior | undefined {
  return findCategory(categories, slug)?.behavior;
}

export function isVideoItem(categories: Category[] | undefined, slug: string): boolean {
  return categoryBehavior(categories, slug) === "video";
}

export function isPdfItem(categories: Category[] | undefined, slug: string): boolean {
  return categoryBehavior(categories, slug) === "pdf";
}

export type ThumbnailStatus = "pending" | "processing" | "ready" | "failed";

export type Item = {
  id: string;
  category: ItemCategory;
  label: string;
  url: string;
  favicon_url: string | null;
  favicon_asset_id: string | null;
  favicon_asset_url: string | null;
  thumbnail_url: string | null;
  thumbnail_status: ThumbnailStatus;
  thumbnail_error: string | null;
  thumbnail_updated_at: string | null;
  pdf_storage_path: string | null;
  tooltip: string | null;
  sort_order: number;
  created_at: string;
};

export type SettingKey =
  | "admin_title"
  | "kiosk_title"
  | "idle_image_url";

export type Settings = Record<SettingKey, string>;

export const DEFAULT_SETTINGS: Settings = {
  admin_title: "GDP Vision Admin",
  kiosk_title: "GDP Vision",
  idle_image_url: "",
};
