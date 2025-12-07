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
  const normalizedStatus = (status || "").toLowerCase();
  return !excludedStatuses.includes(normalizedStatus);
};

// Calculate shortage for a material
export const calculateShortage = (
  required: number,
  available: number,
  reserved: number,
  minStock: number
): number => {
  const effectiveAvailable = available - reserved;
  return Math.max(0, (required - effectiveAvailable) + minStock);
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

  console.log('=== PROCUREMENT DEBUG ===');
  console.log('Total assignments:', assignments.length);
  console.log('Total kits:', kits.length);
  console.log('Total inventory:', inventory.length);
  console.log('Sample assignment:', assignments[0]);
  console.log('Sample kit:', kits[0]);

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

  // Helper to add raw material requirement
  const addRawMaterialRequirement = (
    rawItemId: string,
    quantity: number,
    kitId: Id<"kits">,
    kitName: string,
    assignmentQty: number
  ) => {
    const rawItem = inventory.find(i => i._id === rawItemId);
    if (!rawItem || rawItem.type !== "raw") return;

    const entry = getMaterialEntry(rawItem);
    entry.orderRequired += quantity;

    // Track which kits use this material
    const existingKit = entry.kits.find(k => k.id === kitId);
    if (existingKit) {
      existingKit.quantity += assignmentQty;
    } else {
      entry.kits.push({ id: kitId, name: kitName, quantity: assignmentQty });
    }
  };

  // Process each active assignment
  let processedCount = 0;
  assignments.forEach(assignment => {
    if (!shouldIncludeAssignment(assignment.status)) {
      console.log('Skipping assignment with status:', assignment.status);
      return;
    }

    const kit = kits.find(k => k._id === assignment.kitId);
    if (!kit) {
      console.log('Kit not found for assignment:', assignment.kitId);
      return;
    }

    console.log('Processing assignment:', {
      kitName: kit.name,
      quantity: assignment.quantity,
      hasComponents: !!kit.components,
      componentsLength: kit.components?.length || 0
    });

    processedCount++;

    // Process kit components
    if (kit.components && Array.isArray(kit.components)) {
      kit.components.forEach((kitComp: any) => {
        const invItem = inventory.find(i => i._id === kitComp.inventoryItemId);
        if (!invItem) {
          console.log('Inventory item not found:', kitComp.inventoryItemId);
          return;
        }

        const requiredQty = kitComp.quantityPerKit * assignment.quantity;
        console.log('Processing component:', invItem.name, 'type:', invItem.type, 'required:', requiredQty);

        // Handle BOM explosion for composite items
        if (invItem.type === "sealed_packet" && invItem.components && invItem.components.length > 0) {
          // Explode to raw materials
          invItem.components.forEach((subComp: any) => {
            const subRequired = subComp.quantityRequired * requiredQty;
            addRawMaterialRequirement(
              subComp.rawMaterialId,
              subRequired,
              kit._id,
              kit.name,
              assignment.quantity
            );
          });
        } else if (invItem.type === "raw") {
          // Direct raw material
          addRawMaterialRequirement(
            invItem._id,
            requiredQty,
            kit._id,
            kit.name,
            assignment.quantity
          );
        }
      });
    }

    // Process spare kits
    if (kit.spareKits && Array.isArray(kit.spareKits)) {
      kit.spareKits.forEach((spare: any) => {
        const spareItem = inventory.find(i => i.name === spare.name);
        if (spareItem && spareItem.type === "raw") {
          const spareQty = spare.quantity * assignment.quantity;
          addRawMaterialRequirement(
            spareItem._id,
            spareQty,
            kit._id,
            kit.name,
            assignment.quantity
          );
        }
      });
    }

    // Process bulk materials
    if (kit.bulkMaterials && Array.isArray(kit.bulkMaterials)) {
      kit.bulkMaterials.forEach((bulk: any) => {
        const bulkItem = inventory.find(i => i.name === bulk.name);
        if (bulkItem && bulkItem.type === "raw") {
          const bulkQty = bulk.quantity * assignment.quantity;
          addRawMaterialRequirement(
            bulkItem._id,
            bulkQty,
            kit._id,
            kit.name,
            assignment.quantity
          );
        }
      });
    }

    // Process miscellaneous items
    if (kit.miscellaneous && Array.isArray(kit.miscellaneous)) {
      kit.miscellaneous.forEach((misc: any) => {
        const miscItem = inventory.find(i => i.name === misc.name);
        if (miscItem && miscItem.type === "raw") {
          const miscQty = misc.quantity * assignment.quantity;
          addRawMaterialRequirement(
            miscItem._id,
            miscQty,
            kit._id,
            kit.name,
            assignment.quantity
          );
        }
      });
    }
  });

  console.log('Processed assignments:', processedCount);
  console.log('Materials in map:', materialMap.size);

  // Process processing jobs (assigned status only - reserves source materials)
  processingJobs.forEach(job => {
    if (job.status === "assigned" && job.sources) {
      job.sources.forEach((source: any) => {
        const entry = materialMap.get(source.sourceItemId);
        if (entry) {
          entry.reserved += source.sourceQuantity;
        }
      });
    }
  });

  // Process material requests (approved status - reserves materials)
  materialRequests.forEach(req => {
    if (req.status === "approved" && req.items) {
      req.items.forEach((item: any) => {
        const entry = materialMap.get(item.inventoryId);
        if (entry) {
          entry.reserved += item.quantity;
        }
      });
    }
  });

  // Calculate shortages and costs - return all raw materials for debugging
  const result = Array.from(materialMap.values())
    .filter(item => item.type === "raw")
    .map(item => {
      const shortage = calculateShortage(
        item.orderRequired,
        item.available,
        item.reserved,
        item.minStockLevel
      );
      const purchasingQty = item.purchasingQty > 0 ? item.purchasingQty : shortage;

      return {
        ...item,
        shortage,
        purchasingQty,
        estCost: purchasingQty * (item.vendorPrice || 0)
      };
    });

  console.log('Final materials count:', result.length);
  console.log('Sample material:', result[0]);
  console.log('=== END DEBUG ===');

  return result;
};