import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface ProcessingRequirementsProps {
  assignments: any[];
  inventory: any[];
  activeJobs?: any[];
  allJobs?: any[];
  refreshTrigger?: number;
}

export function ProcessingRequirements({ assignments, inventory, activeJobs = [], allJobs = [], refreshTrigger }: ProcessingRequirementsProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"summary" | "kit-wise" | "month-wise" | "client-wise" | "assignment-wise">("summary");

  const activeAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => 
      a.status !== "received_from_inventory" && 
      a.status !== "dispatched" && 
      a.status !== "delivered"
    );
  }, [assignments]);

  const inventoryByName = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [i.name.toLowerCase(), i]));
  }, [inventory, refreshTrigger]);

  // Calculate active quantities for all items from all jobs (used for virtual inventory)
  const activeTargetQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    if (!allJobs) return quantities;

    allJobs.forEach(job => {
      if (job.status === "assigned" || job.status === "in_progress") {
        job.targets.forEach((target: any) => {
          const current = quantities.get(target.targetItemId) || 0;
          quantities.set(target.targetItemId, current + target.targetQuantity);
        });
      }
    });
    return quantities;
  }, [allJobs, refreshTrigger]);

  // Calculate active quantities for sealed packets from active sealing jobs
  const activeSealingTargetQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    if (!allJobs || !inventory) return quantities;

    allJobs.forEach(job => {
      // Assuming sealing jobs have a 'type' field or can be identified by their targets being sealed_packet
      const isSealingJob = job.targets.some((target: any) => {
        const targetItem = inventory.find(i => i._id === target.targetItemId);
        return targetItem && targetItem.type === "sealed_packet";
      });

      if ((job.status === "assigned" || job.status === "in_progress") && isSealingJob) {
        job.targets.forEach((target: any) => {
          const targetItem = inventory.find(i => i._id === target.targetItemId);
          if (targetItem && targetItem.type === "sealed_packet") {
            const current = quantities.get(target.targetItemId) || 0;
            quantities.set(target.targetItemId, current + target.targetQuantity);
          }
        });
      }
    });
    return quantities;
  }, [allJobs, inventory, refreshTrigger]);

  // Calculate committed quantities for pre-processed items from ASSIGNED sealing jobs (Inputs)
  // These items are physically in inventory but reserved for the sealing job
  const committedSealingSourceQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    if (!allJobs || !inventory) return quantities;

    allJobs.forEach(job => {
      // Only consider ASSIGNED jobs. In-progress jobs usually have materials deducted already.
      if (job.status === "assigned") {
        const isSealingJob = job.targets.some((target: any) => {
          const targetItem = inventory.find(i => i._id === target.targetItemId);
          return targetItem && targetItem.type === "sealed_packet";
        });

        if (isSealingJob && job.sources) {
          job.sources.forEach((source: any) => {
            const current = quantities.get(source.sourceItemId) || 0;
            quantities.set(source.sourceItemId, current + source.sourceQuantity);
          });
        }
      }
    });
    return quantities;
  }, [allJobs, inventory, refreshTrigger]);

  // Active job quantities by target item, filtered by assignment IDs
  const getActiveJobQuantitiesForAssignments = (assignmentIds: string[]) => {
    const quantities = new Map<string, number>();
    
    activeJobs.forEach(job => {
      if (job.status === "assigned" || job.status === "in_progress") {
        const hasMatchingAssignment = job.assignmentIds && job.assignmentIds.length > 0
          ? job.assignmentIds.some((id: string) => assignmentIds.includes(id))
          : false;
        
        if (hasMatchingAssignment) {
          job.targets.forEach((target: any) => {
            const current = quantities.get(target.targetItemId) || 0;
            quantities.set(target.targetItemId, current + target.targetQuantity);
          });
        }
      }
    });
    
    return quantities;
  };

  const calculateShortages = (assignment: any, virtualInventory?: Map<string, number>) => {
    const kit = assignment.kit;
    if (!kit || !inventory) return [];

    const requirements: any[] = [];
    const requiredQty = assignment.quantity;

    const processMaterial = (name: string, qtyPerKit: number, unit: string, category: string) => {
      let invItem = null;
      
      if (kit.components && kit.components.length > 0) {
        const kitComponent = kit.components.find((kc: any) => {
          const kcItem = inventory.find(i => i._id === kc.inventoryItemId);
          return kcItem && kcItem.name.toLowerCase() === name.toLowerCase();
        });
        
        if (kitComponent) {
          invItem = inventory.find(i => i._id === kitComponent.inventoryItemId);
        }
      }
      
      if (!invItem) {
        invItem = inventoryByName.get(name.toLowerCase());
      }
      
      if (invItem && invItem.type === "sealed_packet" && invItem.components && invItem.components.length > 0) {
        // Calculate how many sealed packets are needed
        const totalSealedNeeded = qtyPerKit * requiredQty;
        let actualSealedNeeded = totalSealedNeeded;

        // If virtual inventory is provided, check if we have stock of the sealed packet
        if (virtualInventory) {
            const currentStock = virtualInventory.get(invItem._id) || 0;
            const usedStock = Math.min(currentStock, totalSealedNeeded);
            actualSealedNeeded = totalSealedNeeded - usedStock;
            // Update virtual inventory (consume sealed packets)
            virtualInventory.set(invItem._id, currentStock - usedStock);
        }

        // Only explode into components if we actually need to produce more sealed packets
        if (actualSealedNeeded > 0) {
            invItem.components.forEach((comp: any) => {
              const compItem = inventory.find(i => i._id === comp.rawMaterialId);
              if (compItem && compItem.type === "pre_processed") {
                const compRequired = comp.quantityRequired * actualSealedNeeded;
                
                // Check availability from virtual inventory (which accounts for committed stock)
                let compAvailable = compItem.quantity || 0;
                if (virtualInventory) {
                    compAvailable = virtualInventory.get(compItem._id) || 0;
                }

                // Consume pre-processed items from virtual inventory
                const usedComp = Math.min(compAvailable, compRequired);
                if (virtualInventory) {
                    virtualInventory.set(compItem._id, compAvailable - usedComp);
                }

                const compShortage = Math.max(0, compRequired - compAvailable);
                
                requirements.push({
                  id: compItem._id,
                  name: compItem.name,
                  required: compRequired,
                  available: compAvailable, // This is the available amount BEFORE consumption for this specific req
                  shortage: compShortage,
                  unit: comp.unit,
                  category: `${category} (from Sealed Packet: ${name})`,
                  invItem: compItem
                });
              }
            });
        }
      } else if (invItem && invItem.type === "pre_processed") {
        const required = qtyPerKit * requiredQty;
        
        // Check availability from virtual inventory
        let available = invItem.quantity || 0;
        if (virtualInventory) {
            available = virtualInventory.get(invItem._id) || 0;
        }

        // Consume pre-processed items from virtual inventory
        const used = Math.min(available, required);
        if (virtualInventory) {
            virtualInventory.set(invItem._id, available - used);
        }

        const shortage = Math.max(0, required - available);
        
        requirements.push({
          id: invItem._id,
          name,
          required,
          available, // This is the available amount BEFORE consumption for this specific req
          shortage,
          unit,
          category,
          invItem
        });
      }
    };

    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      
      // Helper to find sealed packet in inventory using various naming conventions
      const findSealedPacket = (packetName: string) => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const pName = normalize(packetName);
        
        // 1. Try exact name
        let item = inventoryByName.get(pName);
        if (item && item.type === "sealed_packet") return item;
        
        // 2. Try [Kit Name] Packet Name (Standard format)
        const bracketed = normalize(`[${kit.name}] ${packetName}`);
        item = inventoryByName.get(bracketed);
        if (item && item.type === "sealed_packet") return item;
        
        // 3. Try [Kit Name]Packet Name (No space)
        const bracketedNoSpace = normalize(`[${kit.name}]${packetName}`);
        item = inventoryByName.get(bracketedNoSpace);
        if (item && item.type === "sealed_packet") return item;
        
        return null;
      };

      // 1. Process Packets (Sealed Packets)
      // Check if we have the sealed packet in stock before exploding into components
      structure.packets.forEach(packet => {
        const sealedItem = findSealedPacket(packet.name);
        const totalSealedNeeded = 1 * requiredQty; // Assuming 1 packet per kit entry in structure
        let actualSealedNeeded = totalSealedNeeded;

        if (sealedItem) {
            // Check availability from virtual inventory
            let currentStock = sealedItem.quantity || 0;
            if (virtualInventory) {
                currentStock = virtualInventory.get(sealedItem._id) || 0;
            }

            // Consume sealed packets from virtual inventory
            const usedStock = Math.min(currentStock, totalSealedNeeded);
            if (virtualInventory) {
                virtualInventory.set(sealedItem._id, currentStock - usedStock);
            }
            
            actualSealedNeeded = totalSealedNeeded - usedStock;
        }

        // Only process components for the packets we actually need to make
        if (actualSealedNeeded > 0) {
            packet.materials.forEach(mat => {
                // Calculate effective quantity per kit for the shortage
                // required = qtyPerKit * requiredQty
                // We want required = mat.quantity * actualSealedNeeded
                // So effectiveQtyPerKit = (mat.quantity * actualSealedNeeded) / requiredQty
                const effectiveQtyPerKit = (mat.quantity * actualSealedNeeded) / requiredQty;
                processMaterial(mat.name, effectiveQtyPerKit, mat.unit, `Component of ${packet.name}`);
            });
        }
      });

      // 2. Process Pouches (Loose Materials)
      // These are always required as loose items (unless we track pouches as items too, but usually not)
      structure.pouches.forEach(pouch => {
          pouch.materials.forEach(mat => {
              processMaterial(mat.name, mat.quantity, mat.unit, `Pouch: ${pouch.name}`);
          });
      });
    } else if (kit.packingRequirements) {
        // Fallback for unstructured but parsed requirements (legacy)
        const structure = parsePackingRequirements(kit.packingRequirements);
        const totalMaterials = calculateTotalMaterials(structure);
        totalMaterials.forEach(m => processMaterial(m.name, m.quantity, m.unit, "Main Component"));
    }

    kit.spareKits?.forEach((s: any) => processMaterial(s.name, s.quantity, s.unit, "Spare Kit"));
    kit.bulkMaterials?.forEach((b: any) => processMaterial(b.name, b.quantity, b.unit, "Bulk Material"));
    kit.miscellaneous?.forEach((m: any) => processMaterial(m.name, m.quantity, m.unit, "Miscellaneous"));

    return requirements;
  };

  // Helper to initialize virtual inventory
  const getInitializedVirtualInventory = () => {
    const virtualInventory = new Map<string, number>();
    if (!inventory) return virtualInventory;

    inventory.forEach(i => {
      let totalAvailable = i.quantity || 0;
      
      // Add active pre-processing output (items being made)
      totalAvailable += activeTargetQuantities.get(i._id) || 0; 
      
      // Add active sealing job output for sealed packets (items being made)
      if (i.type === "sealed_packet") {
          totalAvailable += activeSealingTargetQuantities.get(i._id) || 0; 
      }

      // Deduct committed sources for assigned sealing jobs (items reserved)
      // This prevents double counting items that are about to be used
      const committed = committedSealingSourceQuantities.get(i._id) || 0;
      totalAvailable = Math.max(0, totalAvailable - committed);

      virtualInventory.set(i._id, totalAvailable);
    });
    return virtualInventory;
  };

  // Material Summary: Aggregate all requirements across all assignments
  const materialSummaryData = useMemo(() => {
    if (!activeAssignments || !inventory) return [];
    
    const virtualInventory = getInitializedVirtualInventory();
    const materialMap = new Map<string, any>();

    activeAssignments.forEach((assignment) => {
      const reqs = calculateShortages(assignment, virtualInventory);
      reqs.forEach((item: any) => {
        const key = item.name.toLowerCase();
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.required += item.required;
          existing.kits.add(assignment.kit?.name || "Unknown");
          existing.assignmentIds.add(assignment._id);
        } else {
          materialMap.set(key, {
            id: item.id,
            name: item.name,
            required: item.required,
            available: item.available, // Note: This is the available qty at the time of first encounter
            unit: item.unit,
            category: item.category,
            kits: new Set([assignment.kit?.name || "Unknown"]),
            assignmentIds: new Set([assignment._id]),
            invItem: item.invItem
          });
        }
      });
    });

    return Array.from(materialMap.values()).map((item) => {
      const assignmentIds = Array.from(item.assignmentIds) as string[];
      const activeJobQty = getActiveJobQuantitiesForAssignments(assignmentIds).get(item.id) || 0;
      
      // Recalculate shortage based on Total Required vs Initial Effective Available
      // We need the initial effective available for this item to be accurate
      // Since we consumed it in the loop, we can't just use the map.
      // However, item.available stores the available amount when the FIRST requirement was processed.
      // If we process in order, this should be the "Initial Available" for the batch.
      // A safer way is to re-calculate initial available:
      
      let initialAvailable = item.invItem.quantity || 0;
      initialAvailable += activeTargetQuantities.get(item.id) || 0;
      if (item.invItem.type === "sealed_packet") {
         initialAvailable += activeSealingTargetQuantities.get(item.id) || 0;
      }
      initialAvailable = Math.max(0, initialAvailable - (committedSealingSourceQuantities.get(item.id) || 0));

      const shortage = Math.max(0, item.required - initialAvailable);
      
      return {
        ...item,
        available: initialAvailable, // Display the true initial available
        shortage,
        activeJobQty,
        kits: Array.from(item.kits),
        assignmentIds,
      };
    }).filter(i => i.shortage > 0);
  }, [activeAssignments, inventory, refreshTrigger, activeJobs, allJobs]);

  // Kit Wise: Group by kit
  const kitWiseDataFixed = useMemo(() => {
    if (!activeAssignments || !inventory) return [];
    const virtualInventory = getInitializedVirtualInventory();
    const kitMap = new Map<string, any>();

    activeAssignments.forEach((assignment) => {
      const kit = assignment.kit;
      const kitId = kit?._id || "unknown";
      const kitName = kit?.name || "Unknown Kit";
      const reqs = calculateShortages(assignment, virtualInventory);
      
      if (!kitMap.has(kitId)) {
        kitMap.set(kitId, { kitId, kitName, assignments: [], requirements: new Map<string, any>() });
      }
      const kitData = kitMap.get(kitId);
      kitData.assignments.push(assignment);
      
      reqs.forEach((req: any) => {
        const key = req.name.toLowerCase();
        if (kitData.requirements.has(key)) {
          const existing = kitData.requirements.get(key);
          existing.required += req.required;
          existing.shortage += req.shortage; // Sum the shortages!
          existing.assignmentIds.add(assignment._id);
        } else {
          kitData.requirements.set(key, {
            ...req,
            assignmentIds: new Set([assignment._id])
          });
        }
      });
    });

    return Array.from(kitMap.values()).map((kitData) => {
      const requirements = Array.from(kitData.requirements.values()).map((item: any) => {
        const assignmentIds = Array.from(item.assignmentIds) as string[];
        const activeJobQty = getActiveJobQuantitiesForAssignments(assignmentIds).get(item.id) || 0;
        return { ...item, activeJobQty, assignmentIds };
      }).filter((r: any) => r.shortage > 0);
      return { ...kitData, requirements };
    }).filter(k => k.requirements.length > 0);
  }, [activeAssignments, inventory, refreshTrigger, activeJobs, allJobs]);

  // Month Wise: Group by production month
  const monthWiseDataFixed = useMemo(() => {
    if (!activeAssignments || !inventory) return [];
    const virtualInventory = getInitializedVirtualInventory();
    const monthMap = new Map<string, any>();

    activeAssignments.forEach((assignment) => {
      const month = assignment.productionMonth || "No Month";
      const reqs = calculateShortages(assignment, virtualInventory);
      
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, assignments: [], requirements: new Map<string, any>() });
      }
      const monthData = monthMap.get(month);
      monthData.assignments.push(assignment);
      
      reqs.forEach((req: any) => {
        const key = req.name.toLowerCase();
        if (monthData.requirements.has(key)) {
          const existing = monthData.requirements.get(key);
          existing.required += req.required;
          existing.shortage += req.shortage;
          existing.assignmentIds.add(assignment._id);
        } else {
          monthData.requirements.set(key, { ...req, assignmentIds: new Set([assignment._id]) });
        }
      });
    });

    return Array.from(monthMap.values()).map((monthData) => {
      const requirements = Array.from(monthData.requirements.values()).map((item: any) => {
        const assignmentIds = Array.from(item.assignmentIds) as string[];
        const activeJobQty = getActiveJobQuantitiesForAssignments(assignmentIds).get(item.id) || 0;
        return { ...item, activeJobQty, assignmentIds };
      }).filter((r: any) => r.shortage > 0);
      return { ...monthData, requirements };
    }).filter(m => m.requirements.length > 0);
  }, [activeAssignments, inventory, refreshTrigger, activeJobs, allJobs]);

  // Client Wise: Group by client
  const clientWiseDataFixed = useMemo(() => {
    if (!activeAssignments || !inventory) return [];
    const virtualInventory = getInitializedVirtualInventory();
    const clientMap = new Map<string, any>();

    activeAssignments.forEach((assignment) => {
      const client = assignment.client;
      let clientName = "Unknown Client";
      let clientId = "unknown";
      if (typeof client === 'string') { clientName = client; clientId = client; }
      else if (typeof client === 'object' && client) {
        clientName = client.organization || client.name || client.buyerName || client.contactPerson || client.email || "Unknown Client";
        clientId = client._id || clientName;
      }
      
      const reqs = calculateShortages(assignment, virtualInventory);
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, { clientId, clientName, assignments: [], requirements: new Map<string, any>() });
      }
      const clientData = clientMap.get(clientId);
      clientData.assignments.push(assignment);
      
      reqs.forEach((req: any) => {
        const key = req.name.toLowerCase();
        if (clientData.requirements.has(key)) {
          const existing = clientData.requirements.get(key);
          existing.required += req.required;
          existing.shortage += req.shortage;
          existing.assignmentIds.add(assignment._id);
        } else {
          clientData.requirements.set(key, { ...req, assignmentIds: new Set([assignment._id]) });
        }
      });
    });

    return Array.from(clientMap.values()).map((clientData) => {
      const requirements = Array.from(clientData.requirements.values()).map((item: any) => {
        const assignmentIds = Array.from(item.assignmentIds) as string[];
        const activeJobQty = getActiveJobQuantitiesForAssignments(assignmentIds).get(item.id) || 0;
        return { ...item, activeJobQty, assignmentIds };
      }).filter((r: any) => r.shortage > 0);
      return { ...clientData, requirements };
    }).filter(c => c.requirements.length > 0);
  }, [activeAssignments, inventory, refreshTrigger, activeJobs, allJobs]);

  // Assignment Wise: Individual assignments
  const assignmentWiseData = useMemo(() => {
    if (!activeAssignments || !inventory) return [];
    const virtualInventory = getInitializedVirtualInventory();

    return activeAssignments.map((assignment) => {
      const kit = assignment.kit;
      const client = assignment.client;
      let clientName = "Unknown Client";
      if (typeof client === 'string') { clientName = client; }
      else if (typeof client === 'object' && client) {
        clientName = client.organization || client.name || client.buyerName || client.contactPerson || client.email || "Unknown Client";
      }
      
      const assignmentReqs = calculateShortages(assignment, virtualInventory);
      const activeJobQty = getActiveJobQuantitiesForAssignments([assignment._id]);
      
      const adjustedReqs = assignmentReqs.map(req => {
        const jobQty = activeJobQty.get(req.id) || 0;
        return {
          ...req,
          activeJobQty: jobQty,
          // shortage is already calculated with consumption in calculateShortages
          // but we should subtract active job qty if it wasn't already?
          // activeJobQty is usually for "In Progress" jobs for THIS assignment.
          // If we have an active job, it reduces the shortage.
          shortage: Math.max(0, req.shortage - jobQty),
          assignmentIds: [assignment._id]
        };
      }).filter(r => r.shortage > 0);
      
      return {
        assignment,
        kitName: kit?.name || "Unknown Kit",
        clientName,
        quantity: assignment.quantity,
        productionMonth: assignment.productionMonth,
        requirements: adjustedReqs
      };
    }).filter(a => a.requirements.length > 0);
  }, [activeAssignments, inventory, refreshTrigger, activeJobs, allJobs]);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const RequirementsTable = ({ items }: { items: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Item Name</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>In Progress</TableHead>
          <TableHead>Shortage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, idx) => {
          const rowKey = `${item.id}_${idx}`;
          const hasComponents = item.invItem?.components && item.invItem.components.length > 0;
          
          return (
            <>
              <TableRow key={idx}>
                <TableCell>
                  {hasComponents && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleRow(rowKey)}
                    >
                      {expandedRows[rowKey] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.required} {item.unit}</TableCell>
                <TableCell>{item.available} {item.unit}</TableCell>
                <TableCell>
                  {item.activeJobQty > 0 ? (
                    <Badge variant="outline">{item.activeJobQty} {item.unit}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="destructive">{item.shortage} {item.unit}</Badge>
                </TableCell>
              </TableRow>
              {hasComponents && expandedRows[rowKey] && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50 p-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Raw Materials Required (per unit):</p>
                      <div className="grid gap-2">
                        {item.invItem.components.map((comp: any, compIdx: number) => {
                          const rawMaterial = inventory.find(inv => inv._id === comp.rawMaterialId);
                          return (
                            <div key={compIdx} className="flex items-center justify-between text-sm border rounded p-2">
                              <span className="font-medium">{rawMaterial?.name || "Unknown"}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-muted-foreground">
                                  Required: {comp.quantityRequired} {comp.unit}
                                </span>
                                <Badge variant={rawMaterial && rawMaterial.quantity >= (comp.quantityRequired * item.shortage) ? "secondary" : "destructive"}>
                                  Stock: {rawMaterial?.quantity || 0} {comp.unit}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pre-Processed Items Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Pre-processed items that need to be created based on current assignments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">Material Summary</TabsTrigger>
          <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
          <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
          <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
          <TabsTrigger value="assignment-wise">Assignment Wise</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Material Summary</CardTitle>
              <CardDescription>Aggregated pre-processed items needed across all assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {materialSummaryData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                ) : (
                  <RequirementsTable items={materialSummaryData} />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kit-wise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kit Wise Requirements</CardTitle>
              <CardDescription>Pre-processed items grouped by kit type</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {kitWiseDataFixed.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                  ) : (
                    kitWiseDataFixed.map((kitData, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{kitData.kitName}</CardTitle>
                          <CardDescription>
                            {kitData.assignments.length} assignment(s)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <RequirementsTable items={kitData.requirements} />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month-wise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Month Wise Requirements</CardTitle>
              <CardDescription>Pre-processed items grouped by production month</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {monthWiseDataFixed.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                  ) : (
                    monthWiseDataFixed.map((monthData, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{monthData.month}</CardTitle>
                          <CardDescription>
                            {monthData.assignments.length} assignment(s)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <RequirementsTable items={monthData.requirements} />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client-wise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Wise Requirements</CardTitle>
              <CardDescription>Pre-processed items grouped by client</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {clientWiseDataFixed.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                  ) : (
                    clientWiseDataFixed.map((clientData, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{clientData.clientName}</CardTitle>
                          <CardDescription>
                            {clientData.assignments.length} assignment(s)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <RequirementsTable items={clientData.requirements} />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignment-wise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment-Specific Requirements</CardTitle>
              <CardDescription>Pre-processed items needed for each assignment</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {assignmentWiseData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
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
                          <RequirementsTable items={item.requirements} />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}