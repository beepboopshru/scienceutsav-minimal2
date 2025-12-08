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

  // Helper to process structured packing requirements with BOM explosion
  const processPackingRequirements = (
    packingRequirements: string,
    kitId: Id<"kits">,
    kitName: string,
    assignmentQty: number
  ) => {
    try {
      const structure = JSON.parse(packingRequirements);
      
      // Helper to process a material with BOM explosion
      const processMaterial = (material: any) => {
        if (!material.inventoryItemId) return;
        
        const invItem = inventory.find(i => i._id === material.inventoryItemId);
        if (!invItem) return;
        
        const requiredQty = (material.quantity || 0) * assignmentQty;
        
        // If it's a raw material, add it directly
        if (invItem.type === "raw") {
          addRawMaterialRequirement(invItem._id, requiredQty, kitId, kitName, assignmentQty);
        }
        // If it's a sealed_packet or pre_processed with components, explode the BOM
        else if ((invItem.type === "sealed_packet" || invItem.type === "pre_processed") && 
                 invItem.components && invItem.components.length > 0) {
          invItem.components.forEach((subComp: any) => {
            const subRequired = subComp.quantityRequired * requiredQty;
            addRawMaterialRequirement(
              subComp.rawMaterialId,
              subRequired,
              kitId,
              kitName,
              assignmentQty
            );
          });
        }
      };
      
      // Process pouches
      if (structure.pouches && Array.isArray(structure.pouches)) {
        structure.pouches.forEach((pouch: any) => {
          if (pouch.materials && Array.isArray(pouch.materials)) {
            pouch.materials.forEach(processMaterial);
          }
        });
      }

      // Process packets
      if (structure.packets && Array.isArray(structure.packets)) {
        structure.packets.forEach((packet: any) => {
          if (packet.materials && Array.isArray(packet.materials)) {
            packet.materials.forEach(processMaterial);
          }
        });
      }
    } catch (e) {
      console.error('Error parsing packingRequirements:', e);
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
      kitId: kit._id,
      quantity: assignment.quantity,
      isStructured: kit.isStructured,
      hasPackingRequirements: !!kit.packingRequirements,
      hasComponents: !!kit.components,
      componentsLength: kit.components?.length || 0,
      hasSpareKits: !!kit.spareKits,
      spareKitsLength: kit.spareKits?.length || 0,
      hasBulkMaterials: !!kit.bulkMaterials,
      bulkMaterialsLength: kit.bulkMaterials?.length || 0,
      hasMiscellaneous: !!kit.miscellaneous,
      miscellaneousLength: kit.miscellaneous?.length || 0
    });

    processedCount++;

    // Process structured kits with packingRequirements (SKIP components if structured)
    if (kit.isStructured && kit.packingRequirements) {
      console.log('Processing structured kit with packingRequirements - SKIPPING components');
      processPackingRequirements(kit.packingRequirements, kit._id, kit.name, assignment.quantity);
      // Skip processing components for structured kits as they're already in packingRequirements
      return;
    }

    // Process kit components (only for non-structured kits)
    if (kit.components && Array.isArray(kit.components) && kit.components.length > 0) {
      console.log('Kit has components:', kit.components.length);
      kit.components.forEach((kitComp: any) => {
        console.log('Processing kit component:', kitComp);
        const invItem = inventory.find(i => i._id === kitComp.inventoryItemId);
        console.log('Looking for inventory item:', kitComp.inventoryItemId, 'Found:', !!invItem);
        if (!invItem) {
          console.log('Inventory item not found:', kitComp.inventoryItemId);
          console.log('Available inventory IDs:', inventory.map(i => i._id).slice(0, 5));
          return;
        }

        const requiredQty = kitComp.quantityPerKit * assignment.quantity;
        console.log('Processing component:', {
          name: invItem.name,
          type: invItem.type,
          required: requiredQty,
          hasSubComponents: invItem.type === 'sealed_packet' && !!invItem.components
        });

        // Handle BOM explosion for composite items
        if ((invItem.type === "sealed_packet" || invItem.type === "pre_processed") && 
            invItem.components && invItem.components.length > 0) {
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
    if (kit.spareKits && Array.isArray(kit.spareKits) && kit.spareKits.length > 0) {
      console.log('Processing spare kits:', kit.spareKits.length);
      kit.spareKits.forEach((spare: any) => {
        const spareItem = inventory.find(i => i.name === spare.name);
        console.log('Looking for spare:', spare.name, 'Found:', !!spareItem, 'Type:', spareItem?.type);
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
    if (kit.bulkMaterials && Array.isArray(kit.bulkMaterials) && kit.bulkMaterials.length > 0) {
      console.log('Processing bulk materials:', kit.bulkMaterials.length);
      kit.bulkMaterials.forEach((bulk: any) => {
        const bulkItem = inventory.find(i => i.name === bulk.name);
        console.log('Looking for bulk:', bulk.name, 'Found:', !!bulkItem, 'Type:', bulkItem?.type);
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
    if (kit.miscellaneous && Array.isArray(kit.miscellaneous) && kit.miscellaneous.length > 0) {
      console.log('Processing miscellaneous:', kit.miscellaneous.length);
      kit.miscellaneous.forEach((misc: any) => {
        const miscItem = inventory.find(i => i.name === misc.name);
        console.log('Looking for misc:', misc.name, 'Found:', !!miscItem, 'Type:', miscItem?.type);
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
  // Skip jobs linked to assignments to avoid double-counting (their requirements are already in orderRequired)
  processingJobs.forEach(job => {
    if (job.status === "assigned" && job.sources) {
      // Only reserve materials if the job is NOT linked to any assignment
      const isLinkedToAssignment = job.assignmentIds && job.assignmentIds.length > 0;
      if (!isLinkedToAssignment) {
        job.sources.forEach((source: any) => {
          const entry = materialMap.get(source.sourceItemId);
          if (entry) {
            entry.reserved += source.sourceQuantity;
          }
        });
      }
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

  // Calculate shortages and costs - return all raw materials
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

      // Debug logging for specific items
      if (item.name.includes('Cardboard') || item.name.includes('Battery')) {
        console.log(`[PROCUREMENT DEBUG] ${item.name}:`, {
          orderRequired: item.orderRequired,
          available: item.available,
          reserved: item.reserved,
          minStockLevel: item.minStockLevel,
          calculatedShortage: shortage,
          formula: `(${item.orderRequired} - (${item.available} - ${item.reserved})) + ${item.minStockLevel} = ${shortage}`
        });
      }

      return {
        ...item,
        shortage,
        purchasingQty,
        estCost: purchasingQty * (item.vendorPrice || 0)
      };
    });

  console.log('Final materials count:', result.length);
  console.log('=== END DEBUG ===');

  return result;
};