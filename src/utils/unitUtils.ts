import { Item, ItemUnitDetail } from '../types';

/**
 * Helper to get all units linked to a specific item.
 * Combines unitDetails, units array, and unit string split by separators if needed.
 */
export const getItemUnits = (item: Item): string[] => {
  if (!item) return ['حبة'];
  const unitsSet = new Set<string>();

  // If item has unitDetails
  if (item.unitDetails && Array.isArray(item.unitDetails)) {
    item.unitDetails.forEach((ud) => {
      if (ud.unit && ud.unit.trim()) unitsSet.add(ud.unit.trim());
    });
  }

  // If item has explicit units array
  if (item.units && Array.isArray(item.units) && item.units.length > 0) {
    item.units.forEach((u) => {
      if (u && u.trim()) unitsSet.add(u.trim());
    });
  }

  // If item.unit string contains separators or single unit
  if (item.unit) {
    const parts = item.unit.split(/[,/،\-+|]/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => unitsSet.add(p));
  }

  const result = Array.from(unitsSet);
  return result.length > 0 ? result : ['حبة'];
};

/**
 * Helper to get all consolidated units for an item across all items sharing the same code or name.
 */
export const getConsolidatedItemUnits = (item: Item, allItems?: Item[]): string[] => {
  if (!allItems || allItems.length === 0) {
    return getItemUnits(item);
  }

  const matching = allItems.filter((it) =>
    it.id === item.id ||
    (it.code && item.code && it.code.trim().toLowerCase() === item.code.trim().toLowerCase()) ||
    (it.name && item.name && it.name.trim().toLowerCase() === item.name.trim().toLowerCase())
  );

  const set = new Set<string>();
  matching.forEach((it) => {
    getItemUnits(it).forEach((u) => set.add(u));
  });

  const res = Array.from(set);
  return res.length > 0 ? res : ['حبة'];
};

/**
 * Helper to get all consolidated unit details (unit, sellingPrice, initialCost, barcode, pack)
 * across all items sharing the same code or name.
 */
export const getConsolidatedItemUnitDetails = (item: Item, allItems?: Item[]): ItemUnitDetail[] => {
  if (!item) return [];
  if (!allItems || allItems.length <= 1) {
    return getItemUnitDetails(item);
  }

  const itemCode = item.code ? item.code.trim().toLowerCase() : '';
  const itemName = item.name ? item.name.trim().toLowerCase() : '';

  if (!itemCode && !itemName) {
    return getItemUnitDetails(item);
  }

  const matching = allItems.filter((it) =>
    it.id === item.id ||
    (itemCode && it.code && it.code.trim().toLowerCase() === itemCode) ||
    (itemName && it.name && it.name.trim().toLowerCase() === itemName)
  );

  if (matching.length <= 1) {
    return getItemUnitDetails(item);
  }

  const map = new Map<string, ItemUnitDetail>();
  matching.forEach((it) => {
    const details = getItemUnitDetails(it);
    details.forEach((ud) => {
      const key = ud.unit.trim();
      if (!map.has(key)) {
        map.set(key, ud);
      } else {
        const existing = map.get(key)!;
        map.set(key, {
          unit: key,
          sellingPrice: existing.sellingPrice || ud.sellingPrice,
          initialCost: existing.initialCost || ud.initialCost,
          barcode: existing.barcode || ud.barcode || '',
          pack: existing.pack !== '1' ? existing.pack : ud.pack || '1'
        });
      }
    });
  });

  return Array.from(map.values());
};

/**
 * Get pricing and cost specific to a chosen unit for an item (consolidated)
 */
export const getConsolidatedUnitPricing = (item: Item, selectedUnit: string, allItems?: Item[]) => {
  if (!item) return { sellingPrice: 0, initialCost: 0, barcode: '', pack: '1' };
  const details = getConsolidatedItemUnitDetails(item, allItems);
  const found = details.find((d) => d.unit.trim() === selectedUnit.trim());
  if (found) {
    return {
      sellingPrice: found.sellingPrice,
      initialCost: found.initialCost,
      barcode: found.barcode || item.barcode || '',
      pack: found.pack || item.pack || '1'
    };
  }
  return getUnitPricing(item, selectedUnit);
};

/**
 * Get full unit details (unit name, selling price, cost, barcode) for an item
 */
export const getItemUnitDetails = (item: Item): ItemUnitDetail[] => {
  if (!item) return [];
  const units = getItemUnits(item);
  const existingDetailsMap = new Map<string, ItemUnitDetail>();

  if (item.unitDetails && Array.isArray(item.unitDetails)) {
    item.unitDetails.forEach((ud) => {
      if (ud.unit) existingDetailsMap.set(ud.unit.trim(), ud);
    });
  }

  return units.map((u) => {
    const existing = existingDetailsMap.get(u);
    return {
      unit: u,
      sellingPrice: existing?.sellingPrice ?? item.sellingPrice ?? 0,
      initialCost: existing?.initialCost ?? item.initialCost ?? 0,
      barcode: existing?.barcode || (u === item.unit ? item.barcode : ''),
      pack: existing?.pack || item.pack || '1'
    };
  });
};

/**
 * Get pricing and cost specific to a chosen unit for an item
 */
export const getUnitPricing = (item: Item, selectedUnit: string) => {
  const details = getItemUnitDetails(item);
  const found = details.find((d) => d.unit.trim() === selectedUnit.trim());
  if (found) {
    return {
      sellingPrice: found.sellingPrice,
      initialCost: found.initialCost,
      barcode: found.barcode || item.barcode || '',
      pack: found.pack || item.pack || '1'
    };
  }
  return {
    sellingPrice: item.sellingPrice || 0,
    initialCost: item.initialCost || 0,
    barcode: item.barcode || '',
    pack: item.pack || '1'
  };
};

/**
 * Format raw barcode values from Excel or input, preserving true digits and disabling scientific notation
 */
export const formatRawBarcode = (val: any): string => {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return val.toLocaleString('fullwide', { useGrouping: false });
    }
    return String(val);
  }
  let str = String(val).trim();
  // Convert Arabic numerals
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  // If scientific notation string like "6.28101e+12"
  if (/^\d+(\.\d+)?[eE]\+\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && Number.isInteger(num)) {
      return num.toLocaleString('fullwide', { useGrouping: false });
    }
  }
  return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
};

/**
 * Safely parse and add barcode string/array values into a Set, splitting separators if present.
 */
const extractBarcodeTokens = (val: any, set: Set<string>) => {
  if (val === undefined || val === null) return;
  if (Array.isArray(val)) {
    val.forEach((item) => extractBarcodeTokens(item, set));
    return;
  }
  const formatted = formatRawBarcode(val);
  if (!formatted) return;

  // Split multi-barcodes separated by comma, semicolon, slash, vertical bar, or newline
  const tokens = formatted.split(/[,;/\n|]/);
  tokens.forEach((token) => {
    const clean = token.trim();
    if (clean) {
      set.add(clean);
    }
  });
};

/**
 * Helper to get all unique barcodes for an item:
 * - Primary barcode (`item.barcode`)
 * - Alternative barcodes (`item.barcode1`, `item.barcode2`, `item.barcode3`, `item.barcodes`)
 * - Multi-unit barcodes (`item.unitDetails[].barcode`, `barcode1`, `barcode2`, `barcodes`)
 * - Any barcode_* properties dynamically present on the item object
 */
export const getItemBarcodes = (item: Item): string[] => {
  if (!item) return [];
  const set = new Set<string>();

  // 1. Primary Barcode
  extractBarcodeTokens(item.barcode, set);

  // 2. Alternative Barcodes on Item
  extractBarcodeTokens(item.barcode1, set);
  extractBarcodeTokens(item.barcode2, set);
  extractBarcodeTokens(item.barcode3, set);
  extractBarcodeTokens(item.barcodes, set);

  // Dynamic barcode fields on item (e.g. barcode_1, altBarcode, etc.)
  Object.keys(item).forEach((key) => {
    if (key.toLowerCase().includes('barcode') && !['barcode', 'barcode1', 'barcode2', 'barcode3', 'barcodes', 'unitDetails'].includes(key)) {
      extractBarcodeTokens((item as any)[key], set);
    }
  });

  // 3. Unit Details Barcodes
  const unitDetailsList = item.unitDetails || (item as any).unitsDetails;
  if (unitDetailsList && Array.isArray(unitDetailsList)) {
    unitDetailsList.forEach((ud: any) => {
      if (ud) {
        extractBarcodeTokens(ud.barcode, set);
        extractBarcodeTokens(ud.barcode1, set);
        extractBarcodeTokens(ud.barcode2, set);
        extractBarcodeTokens(ud.barcodes, set);

        Object.keys(ud).forEach((k) => {
          if (k.toLowerCase().includes('barcode') && !['barcode', 'barcode1', 'barcode2', 'barcodes'].includes(k)) {
            extractBarcodeTokens(ud[k], set);
          }
        });
      }
    });
  }

  return Array.from(set);
};

/**
 * Helper to get all barcodes consolidated across all item records sharing the same code/name
 */
export const getConsolidatedItemBarcodes = (item: Item, allItems?: Item[]): string[] => {
  if (!item) return [];
  if (!allItems || allItems.length <= 1) {
    return getItemBarcodes(item);
  }

  const itemCode = item.code ? item.code.trim().toLowerCase() : '';
  const itemName = item.name ? item.name.trim().toLowerCase() : '';

  if (!itemCode && !itemName) {
    return getItemBarcodes(item);
  }

  const matching = allItems.filter((it) =>
    it.id === item.id ||
    (itemCode && it.code && it.code.trim().toLowerCase() === itemCode) ||
    (itemName && it.name && it.name.trim().toLowerCase() === itemName)
  );

  if (matching.length <= 1) {
    return getItemBarcodes(item);
  }

  const set = new Set<string>();
  matching.forEach((it) => {
    getItemBarcodes(it).forEach((bc) => set.add(bc));
  });
  return Array.from(set);
};

/**
 * Helper to get all unique foreign & English & scientific names for an item:
 * - `item.foreignName`
 * - `item.englishName`
 * - `item.scientificName`
 * - `item.foreignNames`
 */
export const getItemForeignNames = (item: Item): string[] => {
  if (!item) return [];
  const set = new Set<string>();

  const addName = (val: any) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(addName);
      return;
    }
    const str = String(val).trim();
    if (str) set.add(str);
  };

  addName(item.foreignName);
  addName(item.englishName);
  addName(item.scientificName);
  addName(item.foreignNames);

  return Array.from(set);
};

/**
 * Helper to check if an item matches a search query against code, names, barcodes, specs, description, scientificName, units, category.
 * Supports multi-keyword token matching (e.g. searching "بناد 500" or "بانادول احمر" matches "بانادول اكسترا احمر 500 ملجم").
 */
export const itemMatchesQuery = (item: Item, query: string): boolean => {
  if (!query || !query.trim()) return true;
  const rawQ = query.trim();
  const qLower = rawQ.toLowerCase();

  // Clean barcode query check
  const cleanQ = qLower.replace(/[\s\-_]/g, '');

  const foreignNames = getItemForeignNames(item);
  const barcodes = getItemBarcodes(item);
  const units = getItemUnits(item);

  // Check if any barcode matches clean query directly
  if (cleanQ.length >= 3) {
    if (barcodes.some((bc) => bc.replace(/[\s\-_]/g, '').toLowerCase().includes(cleanQ))) {
      return true;
    }
  }

  // Build a single search text string for this item containing all fields
  const combinedSearchText = (
    (item.code || '') + ' ' +
    (item.name || '') + ' ' +
    (item.specs || '') + ' ' +
    (item.description || '') + ' ' +
    (item.scientificName || '') + ' ' +
    (item.category || '') + ' ' +
    (item.pack || '') + ' ' +
    units.join(' ') + ' ' +
    foreignNames.join(' ') + ' ' +
    barcodes.join(' ')
  ).toLowerCase();

  // Split query into distinct non-empty word/number tokens
  const queryTokens = qLower.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) return true;

  // EVERY token in the query must be found in the item's combined search text
  return queryTokens.every((token) => combinedSearchText.includes(token));
};
