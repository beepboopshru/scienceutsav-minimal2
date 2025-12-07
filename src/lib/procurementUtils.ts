import { parsePackingRequirements, calculateTotalMaterials } from "./kitPacking";

export interface MaterialShortage {
  name: string;
  required: number;
  available: number;
  shortage: number;
  unit: string;
  category: string;
  subcategory: string;
  minStockLevel: number;
  kits: string[];
  programs: string[];
  vendorPrice: number | null;
  inventoryId?: string;
  vendorName?: string;
}

export interface Assignment {
  _id: string;
  quantity: number;
  kit?: any;
  program?: any;
  client?: any;
  productionMonth?: string;
  _creationTime: number;
  clientType: "b2b" | "b2c";
  status?: string;
}

export interface InventoryItem {
  _id: string;
  name: string;
  quantity: number;
  unit: string;
  type: "raw" | "pre_processed" | "finished" | "sealed_packet";
  minStockLevel?: number;
  subcategory?: string;
  components?: Array<{
    rawMaterialId: string;
    quantityRequired: number;
    unit: string;
  }>;
}

export interface Vendor {
  _id: string;
  name: string;
  itemPrices?: Array<{
    itemId: string;
    averagePrice: number;
  }>;
}

/**
 * Get vendor price for an inventory item
 */
export function getVendorPrice(
  inventoryId: string | undefined,
  vendors: Vendor[]
): number | null {
  if (!inventoryId || !vendors) return null;

  for (const vendor of vendors) {
    if (vendor.itemPrices) {
      const priceEntry = vendor.itemPrices.find((p) => p.itemId === inventoryId);
      if (priceEntry) {
        return priceEntry.averagePrice;
      }
    }
  }
  return null;
}

/**
 * Get vendor name for an inventory item
 */
export function getVendorName(
  inventoryId: string | undefined,
  vendors: Vendor[]
): string | undefined {
  if (!inventoryId || !vendors) return undefined;

  for (const vendor of vendors) {
    if (vendor.itemPrices) {
      const priceEntry = vendor.itemPrices.find((p) => p.itemId === inventoryId);
      if (priceEntry) {
        return vendor.name;
      }
    }
  }
  return undefined;
}

/**
 * Calculate material shortages for a single assignment
 */
export function calculateAssignmentShortages(
  assignment: Assignment,
  inventoryByName: Map<string, InventoryItem>,
  inventoryById: Map<string, InventoryItem>
): MaterialShortage[] {
  const kit = assignment.kit;
  if (!kit) return [];

  const shortages: MaterialShortage[] = [];
  const requiredQty = assignment.quantity;

  const processMaterial = (
    name: string,
    qtyPerKit: number,
    unit: string,
    category: string,
    subcategory?: string
  ) => {
    const required = qtyPerKit * requiredQty;
    const invItem = inventoryByName.get(name.toLowerCase());
    const available = invItem?.quantity || 0;
    const minStockLevel = invItem?.minStockLevel || 0;
    const finalSubcategory = subcategory || invItem?.subcategory || "Uncategorized";

    // Handle sealed packets with BOM explosion
    if (
      invItem &&
      invItem.type === "sealed_packet" &&
      invItem.components &&
      invItem.components.length > 0
    ) {
      invItem.components.forEach((comp) => {
        const compItem = inventoryById.get(comp.rawMaterialId);
        if (compItem && compItem.type === "raw") {
          const compRequired = comp.quantityRequired * qtyPerKit * requiredQty;
          const compAvailable = compItem.quantity || 0;
          const compMinStockLevel = compItem.minStockLevel || 0;

          // Initial calculation for component
          // We don't calculate shortage here, just requirement. 
          // Shortage is calculated after aggregation.
          // But for single assignment view, we need a shortage estimate.
          
          const compShortage = Math.max(0, (compRequired - compAvailable) + compMinStockLevel);

          if (compShortage > 0 || compRequired > 0) {
            shortages.push({
              name: compItem.name,
              required: compRequired,
              available: compAvailable,
              shortage: compShortage,
              unit: comp.unit,
              category: `${category} (from Sealed Packet: ${name})`,
              subcategory: compItem.subcategory || "Uncategorized",
              minStockLevel: compMinStockLevel,
              kits: [],
              programs: [],
              vendorPrice: null,
              inventoryId: compItem._id,
            });
          }
        }
      });
    } else {
      // Regular material
      let shortage = 0;
      if (invItem && invItem.type === "raw") {
         shortage = Math.max(0, (required - available) + minStockLevel);
      } else {
        shortage = Math.max(0, required - available);
      }

      if (shortage > 0 || required > 0) {
        shortages.push({
          name,
          required,
          available,
          shortage,
          unit,
          category,
          subcategory: finalSubcategory,
          minStockLevel,
          kits: [],
          programs: [],
          vendorPrice: null,
          inventoryId: invItem?._id,
        });
      }
    }
  };

  // Process structured kits
  if (kit.isStructured && kit.packingRequirements) {
    const structure = parsePackingRequirements(kit.packingRequirements);
    const totalMaterials = calculateTotalMaterials(structure);
    totalMaterials.forEach((m) =>
      processMaterial(m.name, m.quantity, m.unit, "Main Component")
    );
  }

  // Process spare kits
  kit.spareKits?.forEach((s: any) =>
    processMaterial(s.name, s.quantity, s.unit, "Spare Kit", s.subcategory)
  );

  // Process bulk materials
  kit.bulkMaterials?.forEach((b: any) =>
    processMaterial(b.name, b.quantity, b.unit, "Bulk Material", b.subcategory)
  );

  // Process miscellaneous
  kit.miscellaneous?.forEach((m: any) =>
    processMaterial(m.name, m.quantity, m.unit, "Miscellaneous")
  );

  return shortages;
}

/**
 * Aggregate materials across multiple assignments with BOM explosion
 * @param approvedMaterialRequests - Map of material name (lowercase) to approved quantity to subtract from shortages
 * @param activeProcessingJobs - Active processing jobs to account for materials already allocated
 */
export function aggregateMaterials(
  assignments: Assignment[],
  inventoryByName: Map<string, InventoryItem>,
  inventoryById: Map<string, InventoryItem>,
  vendors: Vendor[],
  approvedMaterialRequests?: Record<string, number>,
  activeProcessingJobs?: any[]
): MaterialShortage[] {
  const materialMap = new Map<string, MaterialShortage>();

  // Filter assignments based on status
  // Included: assigned, in_production, ready_to_pack, transferred_to_dispatch, ready_for_dispatch
  // Excluded: received_from_inventory, dispatched, delivered
  const activeAssignments = assignments.filter((assignment) => {
    const status = assignment.status;
    return (
      status === "assigned" ||
      status === "in_production" ||
      status === "ready_to_pack" ||
      status === "transferred_to_dispatch" ||
      status === "ready_for_dispatch"
    );
  });

  // Collect materials from active assignments
  activeAssignments.forEach((assignment) => {
    const shortages = calculateAssignmentShortages(
      assignment,
      inventoryByName,
      inventoryById
    );

    shortages.forEach((item) => {
      const key = item.name.toLowerCase();
      
      if (materialMap.has(key)) {
        const existing = materialMap.get(key)!;
        existing.required += item.required;
        if (assignment.kit?.name && !existing.kits.includes(assignment.kit.name)) {
          existing.kits.push(assignment.kit.name);
        }
        if (assignment.program?.name && !existing.programs.includes(assignment.program.name)) {
          existing.programs.push(assignment.program.name);
        }
      } else {
        const invItem = inventoryByName.get(item.name.toLowerCase());
        const vendorPrice = getVendorPrice(invItem?._id, vendors);
        const vendorName = getVendorName(invItem?._id, vendors);

        materialMap.set(key, {
          ...item,
          kits: assignment.kit?.name ? [assignment.kit.name] : [],
          programs: assignment.program?.name ? [assignment.program.name] : [],
          vendorPrice,
          vendorName,
          inventoryId: invItem?._id,
        });
      }
    });
  });

  // BOM explosion for items with shortages
  const queue = Array.from(materialMap.keys());
  const processed = new Set<string>();

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (processed.has(key)) continue;
    processed.add(key);

    const item = materialMap.get(key);
    if (!item) continue;

    const invItem = inventoryByName.get(key);

    // Recalculate shortage considering min stock
    // Formula: shortage = (order_required - available) + min_stock_level
    let currentShortage = 0;
    if (invItem && invItem.type === "raw") {
      const minStockLevel = invItem.minStockLevel || 0;
      currentShortage = Math.max(0, (item.required - item.available) + minStockLevel);
    } else {
      currentShortage = Math.max(0, item.required - item.available);
    }

    item.shortage = currentShortage;
    item.minStockLevel = invItem?.minStockLevel || 0;

    // BOM explosion if shortage exists
    if (currentShortage > 0 && invItem?.components && invItem.components.length > 0) {
      invItem.components.forEach((comp) => {
        const compInvItem = inventoryById.get(comp.rawMaterialId);
        if (compInvItem) {
          const compKey = compInvItem.name.toLowerCase();
          const qtyNeeded = currentShortage * comp.quantityRequired;

          if (materialMap.has(compKey)) {
            const existing = materialMap.get(compKey)!;
            existing.required += qtyNeeded;
            item.kits.forEach((k) => {
              if (!existing.kits.includes(k)) existing.kits.push(k);
            });
            item.programs.forEach((p) => {
              if (!existing.programs.includes(p)) existing.programs.push(p);
            });

            if (!processed.has(compKey)) queue.push(compKey);
          } else {
            const vendorPrice = getVendorPrice(compInvItem._id, vendors);
            const vendorName = getVendorName(compInvItem._id, vendors);

            materialMap.set(compKey, {
              name: compInvItem.name,
              required: qtyNeeded,
              available: compInvItem.quantity,
              shortage: 0, // Will be calculated when processed
              unit: compInvItem.unit,
              category: "Raw Material (BOM)",
              subcategory: compInvItem.subcategory || "Uncategorized",
              kits: [...item.kits],
              programs: [...item.programs],
              minStockLevel: compInvItem.minStockLevel || 0,
              vendorPrice,
              vendorName,
              inventoryId: compInvItem._id,
            });
            queue.push(compKey);
          }
        }
      });
    }
  }

  // Apply approved material request deductions
  if (approvedMaterialRequests) {
    materialMap.forEach((item, key) => {
      const approvedQty = approvedMaterialRequests[key] || 0;
      if (approvedQty > 0) {
        // Reduce the shortage by the approved quantity
        item.shortage = Math.max(0, item.shortage - approvedQty);
      }
    });
  }

  // Account for materials allocated to active processing jobs
  if (activeProcessingJobs) {
    const activeJobs = activeProcessingJobs.filter(
      (job) => job.status === "assigned" || job.status === "in_progress"
    );

    // Build a map of materials being produced in active jobs
    const materialsInProduction = new Map<string, number>();
    
    activeJobs.forEach((job) => {
      job.targets.forEach((target: any) => {
        const targetItem = inventoryById.get(target.targetItemId);
        if (targetItem) {
          const key = targetItem.name.toLowerCase();
          const existing = materialsInProduction.get(key) || 0;
          materialsInProduction.set(key, existing + target.targetQuantity);
        }
      });
    });

    // Reduce shortages by the quantity being produced
    materialMap.forEach((item, key) => {
      const inProduction = materialsInProduction.get(key) || 0;
      if (inProduction > 0) {
        // Reduce shortage by the amount already being produced
        item.shortage = Math.max(0, item.shortage - inProduction);
      }
    });
  }

  // Filter out exploded items and return only raw materials
  return Array.from(materialMap.values()).filter((item) => {
    const invItem = inventoryByName.get(item.name.toLowerCase());
    // Exclude items that have been exploded (have components and shortage)
    if (invItem?.components && invItem.components.length > 0 && item.shortage > 0) {
      return false;
    }
    // Only include raw materials in procurement
    return invItem?.type === "raw";
  });
}