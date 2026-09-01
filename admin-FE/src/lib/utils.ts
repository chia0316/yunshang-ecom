import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// "Sofa - 5279 L Shape" + { Material: "Solana" } -> "Sofa - 5279 L Shape — Solana"
// Mirrors cust-FE's CartContext.withVariantLabel — used wherever a Product
// name is shown without already-distinguishing context (order line items).
export function withVariantLabel(
  name: string,
  variantOptions: Record<string, string> | null | undefined
) {
  if (!variantOptions || Object.keys(variantOptions).length === 0) return name;
  return `${name} — ${Object.values(variantOptions).join(", ")}`;
}

// Picks black or white text for a given hex background so an admin-chosen
// featured-tag color (any hex) always stays readable — standard relative-
// luminance threshold, not just "is it dark-sounding".
export function getContrastTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#000000";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}
