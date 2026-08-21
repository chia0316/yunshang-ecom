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
