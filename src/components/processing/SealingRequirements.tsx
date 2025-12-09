import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ChevronDown, ChevronRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements } from "@/lib/kitPacking";
import { RequirementsTable } from "./RequirementsTable";

interface SealingRequirementsProps {
  assignments: any[];
  inventory: any[];
  activeJobs?: any[];
  onCreateItem?: (name: string) => void;
  refreshTrigger?: number;
}

export function SealingRequirements({ assignments, inventory, activeJobs = [], onCreateItem, refreshTrigger }: SealingRequirementsProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const activeAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => 
      a.status !== "received_from_inventory" && 
      a.status !== "dispatched" && 
      a.status !== "delivered" &&
      a.status !== "processing"
    );
  }, [assignments]);

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const inventoryNormalized = useMemo(() => {
    if (!inventory) return new Map();
    // Create a map that includes type information in the key for disambiguation
    const map = new Map();
    inventory.forEach(i => {
      const key = normalize(i.name);
      // Store by name, but we'll filter by type when retrieving
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(i);
    });
    return map;
  }, [inventory, refreshTrigger]);

  const inventoryById = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map((i: any) => [i._id, i]));
  }, [inventory, refreshTrigger]);

  // Calculate active job quantities by target item
  const activeJobQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    
    activeJobs.forEach(job => {
      if (job.status === "assigned" || job.status === "in_progress") {
        job.targets.forEach((target: any) => {
          const current = quantities.get(target.targetItemId) || 0;
          quantities.set(target.targetItemId, current + target.targetQuantity);
        });
      }
    });
    
    return quantities;
  }, [activeJobs]);

  const calculateRequirements = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !kit.packingRequirements) return [];

    const requirements: any[] = [];
    const requiredQty = assignment.quantity;

    // Parse kit packing requirements to get packets and their materials
    const structure = parsePackingRequirements(kit.packingRequirements);
    
    if (structure.packets) {
      structure.packets.forEach((packet: any) => {
        const packetName = packet.name.trim();
        
        // Find the sealed packet in inventory (Target)
        // Helper function to find item by name and type
        const findItemByNameAndType = (name: string, type: string) => {
          const items = inventoryNormalized.get(normalize(name));
          if (!items) return null;
          // Filter for the specific type (sealed_packet)
          return items.find((item: any) => item.type === type) || null;
        };

        // 1. Try exact match of packet name
        let foundItem = findItemByNameAndType(packetName, "sealed_packet");

        // 2. Try "[Kit Name] [Packet Name]" (without brackets)
        if (!foundItem) {
          const prefixedName = `${kit.name} ${packetName}`;
          foundItem = findItemByNameAndType(prefixedName, "sealed_packet");
        }

        // 3. Try "[Kit Name] [Packet Name]" (with brackets)
        if (!foundItem) {
          const kitName = kit.name.trim();
          const bracketedName = `[${kitName}] ${packetName}`;
          foundItem = findItemByNameAndType(bracketedName, "sealed_packet");
          
          // 4. Try "[Kit Name]Packet Name" (no space after bracket)
          if (!foundItem) {
             const bracketedNameNoSpace = `[${kitName}]${packetName}`;
             foundItem = findItemByNameAndType(bracketedNameNoSpace, "sealed_packet");
          }
        }

        // Calculate components based on Inventory BOM if available, otherwise Kit Definition
        let components: any[] = [];

        if (foundItem) {
          // Use Inventory BOM - these are the exact items defined in the sealed packet
          if (foundItem.components) {
            components = foundItem.components.map((comp: any) => {
              const material = inventoryById.get(comp.rawMaterialId);
              return {
                name: material ? material.name : "Unknown Material",
                quantityPerPacket: comp.quantityRequired,
                totalRequired: comp.quantityRequired * requiredQty,
                unit: comp.unit,
                inventoryItem: material,
                inventoryId: comp.rawMaterialId
              };
            });
          }
        } else {
          // Fallback to Kit Definition - match materials based on what the kit specifies
          components = packet.materials.map((mat: any) => {
            const matName = mat.name.trim();
            const items = inventoryNormalized.get(normalize(matName));
            let matInv = null;
            
            if (items && items.length > 0) {
              // Check if the kit has a components array that specifies which inventory item to use
              if (kit.components && kit.components.length > 0) {
                // Find the component in the kit that matches this material name
                const kitComponent = kit.components.find((kc: any) => {
                  const kcItem = inventoryById.get(kc.inventoryItemId);
                  return kcItem && normalize(kcItem.name) === normalize(matName);
                });
                
                if (kitComponent) {
                  // Use the exact inventory item specified in the kit's components
                  matInv = inventoryById.get(kitComponent.inventoryItemId);
                }
              }
              
              // If not found in kit components, use the first match by name
              if (!matInv) {
                matInv = items[0];
              }
            }
            
            return {
              name: mat.name,
              quantityPerPacket: mat.quantity,
              totalRequired: mat.quantity * requiredQty,
              unit: mat.unit,
              inventoryItem: matInv,
              inventoryId: matInv?._id
            };
          });
        }

        const required = requiredQty;
        
        if (foundItem) {
          requirements.push({
            id: foundItem._id,
            name: foundItem.name,
            required,
            available: foundItem.quantity || 0,
            unit: foundItem.unit,
            category: "Sealed Packet",
            invItem: foundItem,
            components: components,
            assignmentDetails: {
              clientName: assignment.client?.name || assignment.client?.buyerName || "Unknown",
              kitName: kit.name,
              quantity: assignment.quantity,
              productionMonth: assignment.productionMonth,
            }
          });
        } else {
          // Suggest the bracketed name if not found (preferred format)
          const kitName = kit.name.trim();
          const suggestedName = `[${kitName}] ${packetName}`;
          requirements.push({
            id: `missing_${suggestedName}`,
            name: suggestedName,
            required,
            available: 0,
            unit: "pcs",
            category: "Sealed Packet",
            invItem: null,
            components: components,
            assignmentDetails: {
              clientName: assignment.client?.name || assignment.client?.buyerName || "Unknown",
              kitName: kit.name,
              quantity: assignment.quantity,
              productionMonth: assignment.productionMonth,
            }
          });
        }
      });
    }

    return requirements;
  };

  const aggregateRequirements = (assignmentList: any[], onlyShortages: boolean = true) => {
    const materialMap = new Map<string, any>();

    assignmentList.forEach((assignment) => {
      const reqs = calculateRequirements(assignment);
      reqs.forEach((item: any) => {
        const key = item.name.toLowerCase();
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.required += item.required;
          existing.kits.add(assignment.kit?.name || "Unknown");
          existing.assignments.push(item.assignmentDetails);
          
          // Aggregate components
          item.components.forEach((comp: any) => {
            const existingComp = existing.components.find((c: any) => c.name.toLowerCase() === comp.name.toLowerCase());
            if (existingComp) {
              existingComp.totalRequired += comp.totalRequired;
            } else {
              existing.components.push({ ...comp });
            }
          });
          
        } else {
          materialMap.set(key, {
            id: item.id,
            name: item.name,
            required: item.required,
            available: item.available,
            unit: item.unit,
            category: item.category,
            kits: new Set([assignment.kit?.name || "Unknown"]),
            invItem: item.invItem,
            assignments: [item.assignmentDetails],
            components: item.components.map((c: any) => ({ ...c })), // Deep copy
          });
        }
      });
    });

    return Array.from(materialMap.values()).map((item) => {
      // Subtract active job quantities from the shortage calculation
      const activeJobQty = activeJobQuantities.get(item.id) || 0;
      const adjustedShortage = Math.max(0, item.required - item.available - activeJobQty);
      
      return {
        ...item,
        shortage: adjustedShortage,
        activeJobQty,
        surplus: Math.max(0, item.available - item.required),
        kits: Array.from(item.kits),
      };
    }).filter(i => !onlyShortages || i.shortage > 0); // Only show items with actual shortages if requested
  };

  const summaryData = aggregateRequirements(activeAssignments, true);

  const kitWiseData = useMemo(() => {
    const kitMap = new Map<string, any>();
    activeAssignments.forEach((assignment) => {
      const kitName = assignment.kit?.name || "Unknown";
      if (!kitMap.has(kitName)) {
        kitMap.set(kitName, {
          name: kitName,
          assignments: [],
          totalQuantity: 0,
        });
      }
      const entry = kitMap.get(kitName);
      entry.assignments.push(assignment);
      entry.totalQuantity += assignment.quantity;
    });
    
    return Array.from(kitMap.values()).map(kit => ({
      ...kit,
      requirements: aggregateRequirements(kit.assignments, false)
    }));
  }, [activeAssignments, inventory, refreshTrigger, activeJobs]);

  const monthWiseData = useMemo(() => {
    const monthMap = new Map<string, any>();
    activeAssignments.forEach((assignment) => {
      const monthKey = assignment.productionMonth || new Date(assignment._creationTime).toISOString().slice(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          assignments: [],
        });
      }
      monthMap.get(monthKey).assignments.push(assignment);
    });

    return Array.from(monthMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(month => ({
        ...month,
        requirements: aggregateRequirements(month.assignments, false)
      }));
  }, [activeAssignments, inventory, refreshTrigger, activeJobs]);

  const clientWiseData = useMemo(() => {
    const clientMap = new Map<string, any>();
    activeAssignments.forEach((assignment) => {
      // Skip assignments without client data
      if (!assignment.client) return;

      // Extract client name with better fallback logic
      let clientName = "Unknown Client";
      const client = assignment.client as any;
      
      if (typeof client === 'string') {
        clientName = client;
      } else if (typeof client === 'object') {
        clientName = 
          client.organization || 
          client.name || 
          client.buyerName || 
          client.contactPerson ||
          client.email ||
          "Unknown Client";
      }

      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, {
          clientName: clientName,
          assignments: [],
        });
      }
      clientMap.get(clientName).assignments.push(assignment);
    });

    return Array.from(clientMap.values()).map(client => ({
      ...client,
      requirements: aggregateRequirements(client.assignments, false)
    }));
  }, [activeAssignments, inventory, refreshTrigger, activeJobs]);

  const assignmentWiseData = useMemo(() => {
    if (!activeAssignments || !inventory) return [];
    
    return activeAssignments.map((assignment) => {
      const kit = assignment.kit;
      const client = assignment.client;
      
      let clientName = "Unknown Client";
      if (typeof client === 'string') {
        clientName = client;
      } else if (typeof client === 'object' && client) {
        clientName = 
          client.organization || 
          client.name || 
          client.buyerName || 
          client.contactPerson ||
          client.email ||
          "Unknown Client";
      }
      
      return {
        assignment,
        kitName: kit?.name || "Unknown Kit",
        clientName,
        quantity: assignment.quantity,
        productionMonth: assignment.productionMonth,
        requirements: aggregateRequirements([assignment], false)
      };
    }).filter(a => a.requirements.length > 0);
  }, [activeAssignments, inventory, refreshTrigger, activeJobs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sealed Packet Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Auto-populated based on Kit Assignments and their Packing Requirements
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[800px]">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
          <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
          <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
          <TabsTrigger value="assignment-wise">Assignment Wise</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Total Sealing Requirements</CardTitle>
                <CardDescription>Aggregated list of all sealed packets needed across all assignments</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sealing requirements found.</p>
                ) : (
                  <RequirementsTable items={summaryData} onCreateItem={onCreateItem} showActions={true} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kit-wise">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {kitWiseData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sealing requirements found.</p>
                ) : (
                  kitWiseData.map((kit, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{kit.name}</CardTitle>
                        <CardDescription>Total Assigned: {kit.totalQuantity}</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <RequirementsTable items={kit.requirements} onCreateItem={onCreateItem} showActions={true} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="month-wise">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {monthWiseData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sealing requirements found.</p>
                ) : (
                  monthWiseData.map((month, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                          {new Date(month.month + "-01").toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                          <RequirementsTable items={month.requirements} onCreateItem={onCreateItem} showActions={true} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="client-wise">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {clientWiseData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sealing requirements found.</p>
                ) : (
                  clientWiseData.map((client, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{client.clientName}</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <RequirementsTable items={client.requirements} onCreateItem={onCreateItem} showActions={true} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assignment-wise">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {assignmentWiseData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sealing requirements found.</p>
                ) : (
                  assignmentWiseData.map((item, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{item.kitName}</CardTitle>
                        <CardDescription>
                          Client: {item.clientName} • Quantity: {item.quantity} • Month: {item.productionMonth || "N/A"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                          <RequirementsTable items={item.requirements} onCreateItem={onCreateItem} showActions={true} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}