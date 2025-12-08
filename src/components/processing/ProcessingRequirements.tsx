import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import { Scissors, ChevronDown, ChevronRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ProcessingRequirementsProps {
  assignments: any[];
  inventory: any[];
  activeJobs?: any[];
  onStartJob: (targetItemId: Id<"inventory">, quantity: number, assignmentIds?: Id<"assignments">[]) => void;
  refreshTrigger?: number;
}

export function ProcessingRequirements({ assignments, inventory, activeJobs = [], onStartJob, refreshTrigger }: ProcessingRequirementsProps) {
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const inventoryByName = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [i.name.toLowerCase(), i]));
  }, [inventory, refreshTrigger]);

  // Calculate active job quantities by target item, filtered by assignment IDs
  const getActiveJobQuantitiesForAssignments = (assignmentIds: string[]) => {
    const quantities = new Map<string, number>();
    
    activeJobs.forEach(job => {
      if (job.status === "assigned" || job.status === "in_progress") {
        // Only count this job if it's linked to one of the current assignments
        const hasMatchingAssignment = job.assignmentIds && job.assignmentIds.some((id: string) => assignmentIds.includes(id));
        
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

  const calculateShortages = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !inventory) return [];

    const requirements: any[] = [];
    const requiredQty = assignment.quantity;

    const processMaterial = (name: string, qtyPerKit: number, unit: string, category: string) => {
      // First, check if the kit's components array specifies which inventory item to use
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
      
      // If not found in kit components, fall back to name lookup
      if (!invItem) {
        invItem = inventoryByName.get(name.toLowerCase());
      }
      
      // Check if this is a sealed packet - if so, explode its BOM for pre-processed items
      if (invItem && invItem.type === "sealed_packet" && invItem.components && invItem.components.length > 0) {
        // Look for pre-processed components in the sealed packet BOM
        invItem.components.forEach((comp: any) => {
          const compItem = inventory.find(i => i._id === comp.rawMaterialId);
          if (compItem && compItem.type === "pre_processed") {
            const compRequired = comp.quantityRequired * qtyPerKit * requiredQty;
            const compAvailable = compItem.quantity || 0;
            const compShortage = Math.max(0, compRequired - compAvailable);
            
            if (compShortage > 0) {
              requirements.push({
                id: compItem._id,
                name: compItem.name,
                required: compRequired,
                available: compAvailable,
                shortage: compShortage,
                unit: comp.unit,
                category: `${category} (from Sealed Packet: ${name})`,
                invItem: compItem
              });
            }
          }
        });
      } else if (invItem && invItem.type === "pre_processed") {
        // Regular pre-processed item (not from sealed packet) - use the exact item from kit definition
        const required = qtyPerKit * requiredQty;
        const available = invItem.quantity || 0;
        const shortage = Math.max(0, required - available);
        
        if (shortage > 0) {
          requirements.push({
            id: invItem._id,
            name,
            required,
            available,
            shortage,
            unit,
            category,
            invItem
          });
        }
      }
    };

    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      const totalMaterials = calculateTotalMaterials(structure);
      totalMaterials.forEach(m => processMaterial(m.name, m.quantity, m.unit, "Main Component"));
    }

    kit.spareKits?.forEach((s: any) => processMaterial(s.name, s.quantity, s.unit, "Spare Kit"));
    kit.bulkMaterials?.forEach((b: any) => processMaterial(b.name, b.quantity, b.unit, "Bulk Material"));
    kit.miscellaneous?.forEach((m: any) => processMaterial(m.name, m.quantity, m.unit, "Miscellaneous"));

    return requirements;
  };

  const aggregateRequirements = (assignmentList: any[]) => {
    const materialMap = new Map<string, any>();

    assignmentList.forEach((assignment) => {
      const reqs = calculateShortages(assignment);
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
            available: item.available,
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
      // Get assignment IDs for this material requirement
      const assignmentIds = Array.from(item.assignmentIds) as string[];
      
      // Subtract active job quantities that are linked to these specific assignments
      const activeJobQty = getActiveJobQuantitiesForAssignments(assignmentIds).get(item.id) || 0;
      const adjustedShortage = Math.max(0, item.required - item.available - activeJobQty);
      
      return {
        ...item,
        shortage: adjustedShortage,
        activeJobQty,
        kits: Array.from(item.kits),
        assignmentIds,
      };
    }).filter(i => i.shortage > 0);
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
    })).filter(k => k.requirements.length > 0);
  }, [assignments, inventory, refreshTrigger, activeJobs]);

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
      })).filter(m => m.requirements.length > 0);
  }, [assignments, inventory, refreshTrigger, activeJobs]);

  const clientWiseData = useMemo(() => {
    const clientMap = new Map<string, any>();
    assignments.forEach((assignment) => {
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
      requirements: aggregateRequirements(client.assignments)
    })).filter(c => c.requirements.length > 0);
  }, [assignments, inventory, refreshTrigger, activeJobs]);

  const assignmentWiseData = useMemo(() => {
    if (!assignments || !inventory) return [];
    
    return assignments.map((assignment) => {
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
        requirements: aggregateRequirements([assignment])
      };
    }).filter(a => a.requirements.length > 0);
  }, [assignments, inventory, refreshTrigger, activeJobs]);

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
          <TableHead>Action</TableHead>
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
                <TableCell>
                  <Button size="sm" onClick={() => onStartJob(item.id, item.shortage, item.assignmentIds)}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Start Job
                  </Button>
                </TableCell>
              </TableRow>
              {hasComponents && expandedRows[rowKey] && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-muted/50 p-4">
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
                <CardTitle>Total Processing Requirements</CardTitle>
                <CardDescription>Aggregated list of all pre-processed items needed</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                ) : (
                  <RequirementsTable items={summaryData} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kit-wise">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {kitWiseData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                ) : (
                  kitWiseData.map((kit, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{kit.name}</CardTitle>
                        <CardDescription>Total Assigned: {kit.totalQuantity}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <RequirementsTable items={kit.requirements} />
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
                  <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                ) : (
                  monthWiseData.map((month, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                          {new Date(month.month + "-01").toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RequirementsTable items={month.requirements} />
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
                  <p className="text-muted-foreground text-center py-8">No processing requirements found.</p>
                ) : (
                  clientWiseData.map((client, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{client.clientName}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RequirementsTable items={client.requirements} />
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
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}