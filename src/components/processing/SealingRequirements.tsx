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
  onStartJob: (targetItemId: Id<"inventory"> | string, quantity: number, components: any[]) => void;
}

export function SealingRequirements({ assignments, inventory, onStartJob }: SealingRequirementsProps) {
  const [activeTab, setActiveTab] = useState("summary");

  // Normalize string helper: lowercase, trim, single spaces
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const inventoryNormalized = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [normalize(i.name), i]));
  }, [inventory]);

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
        // 1. Try exact match of packet name
        let foundItem = inventoryNormalized.get(normalize(packetName));

        // 2. Try "[Kit Name] [Packet Name]"
        if (!foundItem) {
          const prefixedName = `${kit.name} ${packetName}`;
          foundItem = inventoryNormalized.get(normalize(prefixedName));
        }

        // Calculate components based on Kit Definition (Source)
        const components = packet.materials.map((mat: any) => {
          // Also try to find material with normalized name
          const matName = mat.name.trim();
          let matInv = inventoryNormalized.get(normalize(matName));
          
          return {
            name: mat.name,
            quantityPerPacket: mat.quantity,
            totalRequired: mat.quantity * requiredQty,
            unit: mat.unit,
            inventoryItem: matInv,
            inventoryId: matInv?._id
          };
        });

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
          // Suggest the prefixed name if not found
          const suggestedName = `${kit.name} ${packetName}`;
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

  const aggregateRequirements = (assignmentList: any[]) => {
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

    return Array.from(materialMap.values()).map((item) => ({
      ...item,
      shortage: Math.max(0, item.required - item.available),
      surplus: Math.max(0, item.available - item.required),
      kits: Array.from(item.kits),
    }));
  };

  const summaryData = aggregateRequirements(assignments);

  const kitWiseData = useMemo(() => {
    const kitMap = new Map<string, any>();
    assignments.forEach((assignment) => {
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
      requirements: aggregateRequirements(kit.assignments)
    }));
  }, [assignments, inventory]);

  const monthWiseData = useMemo(() => {
    const monthMap = new Map<string, any>();
    assignments.forEach((assignment) => {
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
        requirements: aggregateRequirements(month.assignments)
      }));
  }, [assignments, inventory]);

  const clientWiseData = useMemo(() => {
    const clientMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      const clientName = assignment.client?.name || assignment.client?.buyerName || "Unknown Client";
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
      requirements: aggregateRequirements(client.assignments)
    }));
  }, [assignments, inventory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sealed Packet Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Auto-populated based on Kit Assignments and their Packing Requirements
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
          <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
          <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
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
                  <RequirementsTable items={summaryData} onStartJob={onStartJob} />
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
                        <RequirementsTable items={kit.requirements} onStartJob={onStartJob} />
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
                        <RequirementsTable items={month.requirements} onStartJob={onStartJob} />
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
                        <RequirementsTable items={client.requirements} onStartJob={onStartJob} />
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