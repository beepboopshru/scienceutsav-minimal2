export interface Material {
  name: string;
  quantity: number;
  unit: string;
  subcategory?: string;
  notes?: string;
  inventoryItemId?: string;
}

export interface Container {
  name: string;
  materials: Material[];
}

export interface PackingStructure {
  pouches: Container[];
  packets: Container[];
}

export function parsePackingRequirements(packingRequirements?: string): PackingStructure {
  if (!packingRequirements) {
    return { pouches: [], packets: [] };
  }

  try {
    const parsed = JSON.parse(packingRequirements);

    // New format: { pouches: [...], packets: [...] }
    if (parsed.pouches || parsed.packets) {
      return {
        pouches: parsed.pouches || [],
        packets: parsed.packets || [],
      };
    }

    // Legacy format: array of containers (treat as pouches)
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

export function stringifyPackingRequirements(structure: PackingStructure): string {
  return JSON.stringify(structure);
}

export function calculateTotalMaterials(structure: PackingStructure): Material[] {
  const materialMap = new Map<string, Material>();

  const addMaterial = (material: Material) => {
    const existing = materialMap.get(material.name);
    if (existing) {
      existing.quantity += material.quantity;
    } else {
      materialMap.set(material.name, { ...material });
    }
  };

  structure.pouches.forEach(pouch => {
    pouch.materials.forEach(addMaterial);
  });

  structure.packets.forEach(packet => {
    packet.materials.forEach(addMaterial);
  });

  return Array.from(materialMap.values());
}