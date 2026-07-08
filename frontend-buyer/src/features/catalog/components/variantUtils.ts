import type { ProductVariant } from '@/services/productService';

export interface AttributeAxis {
  /** Attribute name as stored in the DB (e.g. "Color", "Size"). */
  name: string;
  /** All distinct values across the variant set, in insertion order. */
  values: string[];
}

/**
 * Inspect the variants and produce one axis per attribute name, with the
 * distinct values available. The resulting shape is stable across renders.
 */
export function buildAttributeAxes(
  variants: ProductVariant[],
): AttributeAxis[] {
  const byName = new Map<string, Set<string>>();
  for (const v of variants) {
    for (const attr of v.attributes) {
      const key = attr.attributeName;
      if (!byName.has(key)) byName.set(key, new Set());
      byName.get(key)!.add(attr.value);
    }
  }
  return Array.from(byName.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}
