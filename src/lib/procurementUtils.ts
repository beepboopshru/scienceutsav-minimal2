import { Id } from "@/convex/_generated/dataModel";

// Types for procurement calculations
export interface ProcurementMaterial {
  id: Id<"inventory">;
  name: string;
  category: string;
  type: string;
  unit: string;
  minStockLevel: number;
  available: number;
  reserved: number;
  orderRequired: number;
  shortage: number;
  purchasingQty: number;
  vendorId?: Id<"vendors">;
  vendorName?: string;
  vendorPrice?: number;
  estCost: number;
  kits: {
    id: Id<"kits">;
    name: string;
    quantity: number;
  }[];
}

export interface ProcurementAssignment {
  _id: Id<"assignments">;
  kitId: Id<"kits">;
  kitName: string;
  programName: string;
  clientId: string;
  clientName: string;
  clientType: "b2b" | "b2c";
  quantity: number;
  productionMonth?: string;
  status: string;
  batchId?: Id<"batches">;
  dispatchDate?: number;
}

// Helper to check if assignment should be included in procurement
export const shouldIncludeAssignment = (status: string): boolean => {
  const excludedStatuses = [
    "received_from_inventory",
    "dispatched",
    "delivered",
    "cancelled"
  ];
  // Ensure case-insensitive comparison and handle potential undefined
  const normalizedStatus = (status || "").toLowerCase();
  return !excludedStatuses.includes(normalizedStatus);
};

// Calculate shortage for a material
export const calculateShortage = (
  required: number,
  available: number,
  minStock: number
): number => {
  // Formula: max(0, (order_required - available) + min_stock_level)
  return Math.max(0, (required - available) + minStock);
};

// Main function to aggregate materials from assignments
export const aggregateMaterials = (
  assignments: any[],
  kits: any[],
  inventory: any[],
  purchasingQuantities: any[],
  vendors: any[],
  processingJobs: any[] = [],
  materialRequests: any[] = []
): ProcurementMaterial[] => {
  const materialMap = new Map<string, ProcurementMaterial>();

  // Helper to get or create material entry
  const getMaterialEntry = (invItem: any): ProcurementMaterial => {
    if (!materialMap.has(invItem._id)) {
      const savedQty = purchasingQuantities.find(q => q.materialId === invItem._id);
      const vendor = vendors.find(v => v._id === invItem.vendorId);
      const vendorPrice = vendor?.itemPrices?.find((p: any) => p.itemId === invItem._id)?.averagePrice || 0;

      materialMap.set(invItem._id, {
        id: invItem._id,
        name: invItem.name,
        category: invItem.subcategory || "Uncategorized",
        type: invItem.type,
        unit: invItem.unit,
        minStockLevel: invItem.minStockLevel || 0,
        available: invItem.quantity || 0,
        reserved: 0,
        orderRequired: 0,
        shortage: 0,
        purchasingQty: savedQty ? savedQty.quantity : 0,
        vendorId: invItem.vendorId,
        vendorName: vendor?.name,
        vendorPrice,
        estCost: 0,
        kits: []
      });
    }
    return materialMap.get(invItem._id)!;
  };

  // Process each active assignment
  assignments.forEach(assignment => {
    if (!shouldIncludeAssignment(assignment.status)) return;

    const kit = kits.find(k => k._id === assignment.kitId);
    if (!kit) return;

    // Use kit.components which links to inventory
    if (kit.components && Array.isArray(kit.components)) {
      kit.components.forEach((kitComp: any) => {
        const invItem = inventory.find(i => i._id === kitComp.inventoryItemId);
        if (!invItem) return;

        const requiredQty = kitComp.quantityPerKit * assignment.quantity;
        
        // Handle BOM explosion for composite items
        if (["pre_processed", "finished", "sealed_packet"].includes(invItem.type)) {
          // Check if this composite item has components defined in inventory
          if (invItem.components && invItem.components.length > 0) {
            // Explode to raw materials
            invItem.components.forEach((subComp: any) => {
              const rawItem = inventory.find(i => i._id === subComp.rawMaterialId);
              if (rawItem) {
                const entry = getMaterialEntry(rawItem);
                const subRequired = subComp.quantityRequired * requiredQty;
                entry.orderRequired += subRequired;
                
                // Add kit info if not present
                if (!entry.kits.find(k => k.id === kit._id)) {
                  entry.kits.push({ id: kit._id, name: kit.name, quantity: 0 });
                }
                const kitEntry = entry.kits.find(k => k.id === kit._id)!;
                kitEntry.quantity += assignment.quantity; // This is kit quantity, not material quantity
              }
            });
          } else {
            // No components defined, treat as raw material
            const entry = getMaterialEntry(invItem);
            entry.orderRequired += requiredQty;
            if (!entry.kits.find(k => k.id === kit._id)) {
              entry.kits.push({ id: kit._id, name: kit.name, quantity: 0 });
            }
            const kitEntry = entry.kits.find(k => k.id === kit._id)!;
            kitEntry.quantity += assignment.quantity;
          }
        } else {
          // Raw material
          const entry = getMaterialEntry(invItem);
          entry.orderRequired += requiredQty;
          if (!entry.kits.find(k => k.id === kit._id)) {
            entry.kits.push({ id: kit._id, name: kit.name, quantity: 0 });
          }
          const kitEntry = entry.kits.find(k => k.id === kit._id)!;
          kitEntry.quantity += assignment.quantity;
        }
      });
    }
  });

  // Process processing jobs (assigned status only - reserves source materials)
  processingJobs.forEach(job => {
    if (job.status === "assigned" && job.sources) {
      job.sources.forEach((source: any) => {
        const invItem = inventory.find(i => i._id === source.sourceItemId);
        if (invItem) {
          const entry = getMaterialEntry(invItem);
          entry.reserved += source.sourceQuantity;
        }
      });
    }
  });

  // Process material requests (approved status - reserves materials)
  materialRequests.forEach(req => {
    if (req.status === "approved" && req.items) {
      req.items.forEach((item: any) => {
        const invItem = inventory.find(i => i._id === item.inventoryId);
        if (invItem) {
          const entry = getMaterialEntry(invItem);
          entry.reserved += item.quantity;
        }
      });
    }
  });

  // Check for low stock items that might not be in active assignments
  inventory.forEach(invItem => {
    // If item has a min stock level and current quantity is below it, add to map
    // Ensure quantity is treated as 0 if undefined
    const currentQty = invItem.quantity || 0;
    if (invItem.minStockLevel && currentQty < invItem.minStockLevel) {
      getMaterialEntry(invItem);
    }
  });

  // Calculate shortages and costs
  return Array.from(materialMap.values()).map(item => {
    // Effective available = available - reserved
    const effectiveAvailable = item.available - item.reserved;
    const shortage = calculateShortage(item.orderRequired, effectiveAvailable, item.minStockLevel);
    const purchasingQty = item.purchasingQty > 0 ? item.purchasingQty : shortage;
    
    return {
      ...item,
      shortage,
      purchasingQty,
      estCost: purchasingQty * (item.vendorPrice || 0)
    };
  }).filter(item => item.shortage > 0 || item.orderRequired > 0 || item.reserved > 0); // Show items that are needed or reserved
};