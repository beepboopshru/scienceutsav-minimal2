import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

interface Material {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface Container {
  name: string;
  materials: Material[];
}

interface PackingStructure {
  pouches: Container[];
  packets: Container[];
}

function parsePackingRequirements(packingRequirements?: string): PackingStructure {
  if (!packingRequirements) {
    return { pouches: [], packets: [] };
  }

  try {
    const parsed = JSON.parse(packingRequirements);

    if (parsed.pouches || parsed.packets) {
      return {
        pouches: parsed.pouches || [],
        packets: parsed.packets || [],
      };
    }

    if (Array.isArray(parsed)) {
      return {
        pouches: parsed,
        packets: [],
      };
    }

    return { pouches: [], packets: [] };
  } catch (error) {
    console.error("Failed to parse packing requirements:", error);
    return { pouches: [], packets: [] };
  }
}

export const getAssignmentsByProgram = query({
  args: { 
    programId: v.id("programs"),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get all kits for this program
    const kits = await ctx.db
      .query("kits")
      .filter((q) => q.eq(q.field("programId"), args.programId))
      .collect();

    const kitIds = kits.map(k => k._id);

    // Get all assignments for these kits
    let assignments = await ctx.db.query("assignments").collect();
    assignments = assignments.filter(a => kitIds.includes(a.kitId));

    // Filter by month if provided
    if (args.month) {
      const [year, month] = args.month.split("-").map(Number);
      assignments = assignments.filter(a => {
        const date = new Date(a._creationTime);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      });
    }

    // Fetch related data
    const assignmentsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const kit = await ctx.db.get(assignment.kitId);
        const client = await ctx.db.get(assignment.clientId);
        return { ...assignment, kit, client };
      })
    );

    return assignmentsWithDetails;
  },
});

export const calculateShortages = query({
  args: { 
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const kit = await ctx.db.get(assignment.kitId);
    if (!kit) throw new Error("Kit not found");

    const inventory = await ctx.db.query("inventory").collect();
    const inventoryMap = new Map(inventory.map(item => [item.name.toLowerCase(), item]));

    const shortages: Array<{
      name: string;
      required: number;
      available: number;
      shortage: number;
      unit: string;
      category: string;
    }> = [];

    const calculateMaterialShortage = (materials: Array<{name: string; quantity: number; unit: string}>, category: string) => {
      materials.forEach(material => {
        const required = material.quantity * assignment.quantity;
        const invItem = inventoryMap.get(material.name.toLowerCase());
        const available = invItem?.quantity || 0;
        const shortage = Math.max(0, required - available);

        shortages.push({
          name: material.name,
          required,
          available,
          shortage,
          unit: material.unit,
          category,
        });
      });
    };

    // Calculate shortages for structured kits
    if (kit.isStructured && kit.packingRequirements) {
      try {
        const packingData = JSON.parse(kit.packingRequirements);
        
        // Process pouches
        if (packingData.pouches) {
          packingData.pouches.forEach((pouch: any) => {
            if (pouch.materials) {
              calculateMaterialShortage(pouch.materials, "Main Components");
            }
          });
        }

        // Process packets
        if (packingData.packets) {
          packingData.packets.forEach((packet: any) => {
            if (packet.materials) {
              calculateMaterialShortage(packet.materials, "Sealed Packets");
            }
          });
        }
      } catch (error) {
        console.error("Error parsing packing requirements:", error);
      }
    }

    // Calculate shortages for spare kits
    if (kit.spareKits) {
      calculateMaterialShortage(kit.spareKits, "Spare Kits");
    }

    // Calculate shortages for bulk materials
    if (kit.bulkMaterials) {
      calculateMaterialShortage(kit.bulkMaterials, "Bulk Materials");
    }

    // Calculate shortages for miscellaneous
    if (kit.miscellaneous) {
      calculateMaterialShortage(kit.miscellaneous, "Miscellaneous");
    }

    return shortages;
  },
});

export const generateProcurementList = query({
  args: { 
    programId: v.id("programs"),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get all kits for this program
    const kits = await ctx.db
      .query("kits")
      .filter((q) => q.eq(q.field("programId"), args.programId))
      .collect();

    const kitIds = kits.map(k => k._id);

    // Get all assignments for these kits
    let assignments = await ctx.db.query("assignments").collect();
    assignments = assignments.filter(a => kitIds.includes(a.kitId));

    // Filter by month if provided
    if (args.month) {
      const [year, month] = args.month.split("-").map(Number);
      assignments = assignments.filter(a => {
        const date = new Date(a._creationTime);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      });
    }

    const inventory = await ctx.db.query("inventory").collect();
    const inventoryMap = new Map(inventory.map(item => [item.name.toLowerCase(), item]));

    const materialRequirements = new Map<string, {
      name: string;
      totalRequired: number;
      available: number;
      shortage: number;
      unit: string;
      category: string;
      kits: string[];
    }>();

    for (const assignment of assignments) {
      const kit = kits.find(k => k._id === assignment.kitId);
      if (!kit) continue;

      const processMaterials = (materials: Array<{name: string; quantity: number; unit: string}>, category: string) => {
        materials.forEach(material => {
          const key = material.name.toLowerCase();
          const required = material.quantity * assignment.quantity;
          const invItem = inventoryMap.get(key);
          const available = invItem?.quantity || 0;

          if (materialRequirements.has(key)) {
            const existing = materialRequirements.get(key)!;
            existing.totalRequired += required;
            existing.shortage = Math.max(0, existing.totalRequired - existing.available);
            if (!existing.kits.includes(kit.name)) {
              existing.kits.push(kit.name);
            }
          } else {
            materialRequirements.set(key, {
              name: material.name,
              totalRequired: required,
              available,
              shortage: Math.max(0, required - available),
              unit: material.unit,
              category,
              kits: [kit.name],
            });
          }
        });
      };

      // Process structured kits
      if (kit.isStructured && kit.packingRequirements) {
        try {
          const packingData = JSON.parse(kit.packingRequirements);
          
          if (packingData.pouches) {
            packingData.pouches.forEach((pouch: any) => {
              if (pouch.materials) {
                processMaterials(pouch.materials, "Main Components");
              }
            });
          }

          if (packingData.packets) {
            packingData.packets.forEach((packet: any) => {
              if (packet.materials) {
                processMaterials(packet.materials, "Sealed Packets");
              }
            });
          }
        } catch (error) {
          console.error("Error parsing packing requirements:", error);
        }
      }

      // Process other materials
      if (kit.spareKits) processMaterials(kit.spareKits, "Spare Kits");
      if (kit.bulkMaterials) processMaterials(kit.bulkMaterials, "Bulk Materials");
      if (kit.miscellaneous) processMaterials(kit.miscellaneous, "Miscellaneous");
    }

    return Array.from(materialRequirements.values());
  },
});
