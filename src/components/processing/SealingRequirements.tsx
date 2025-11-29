import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ChevronDown, ChevronRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";

interface SealingRequirementsProps {
  assignments: any[];
  inventory: any[];
  onStartJob: (targetItemId: Id<"inventory">, quantity: number) => void;
}

export function SealingRequirements({ assignments, inventory, onStartJob }: SealingRequirementsProps) {
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Get all sealed packet inventory items
  const sealedPackets = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => item.type === "sealed_packet");
  }, [inventory]);

  const inventoryByName = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [i.name.toLowerCase(), i]));
  }, [inventory]);

  const calculateRequirements = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !sealedPackets.length) return [];

    const requirements: any[] = [];
    const requiredQty = assignment.quantity;

    // Process a material and check if it's a sealed packet
    const processMaterial = (name: string, qtyPerKit: number, unit: string, category: string) => {
      const invItem = inventoryByName.get(name.toLowerCase());
      
      // Debug: Log what we're checking
      console.log(`Checking material: ${name}, Found in inventory:`, invItem ? `Yes (type: ${invItem.type})` : 'No');
      
      // Only process if this material is a sealed packet type
      if (!invItem || invItem.type !== "sealed_packet") {
        return;
      }

      const required = qtyPerKit * requiredQty;
      const available = invItem.quantity || 0;
      const shortage = Math.max(0, required - available);
      
      requirements.push({
        id: invItem._id,
        name: invItem.name,
        required,
        available,
        shortage,
        unit: invItem.unit,
        category,
        invItem,
        assignmentDetails: {
          clientName: assignment.client?.name || assignment.client?.buyerName || "Unknown",
          kitName: kit.name,
          quantity: assignment.quantity,
          productionMonth: assignment.productionMonth,
        }
      });
    };

    // Check main components (packingRequirements)
    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      const totalMaterials = calculateTotalMaterials(structure);
      totalMaterials.forEach(m => processMaterial(m.name, m.quantity, m.unit, "Main Component"));
    }

    // Check spare kits
    kit.spareKits?.forEach((s: any) => processMaterial(s.name, s.quantity, s.unit, "Spare Kit"));

    // Check bulk materials
    kit.bulkMaterials?.forEach((b: any) => processMaterial(b.name, b.quantity, b.unit, "Bulk Material"));

    // Check miscellaneous
    kit.miscellaneous?.forEach((m: any) => processMaterial(m.name, m.quantity, m.unit, "Miscellaneous"));

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

  const toggleRow = (key: string) => {
    setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const RequirementsTable = ({ items }: { items: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Sealed Packet Name</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>In Stock</TableHead>
          <TableHead>Deficit/Surplus</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, idx) => {
          const rowKey = `${item.id}_${idx}`;
          const hasComponents = item.invItem?.components && item.invItem.components.length > 0;
          const hasDeficit = item.shortage > 0;
          const hasSurplus = item.surplus > 0;
          
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
                <TableCell>
                  <Badge variant={hasDeficit ? "destructive" : "secondary"}>
                    {item.available} {item.unit}
                  </Badge>
                </TableCell>
                <TableCell>
                  {hasDeficit && (
                    <Badge variant="destructive">Deficit: {item.shortage} {item.unit}</Badge>
                  )}
                  {hasSurplus && (
                    <Badge variant="secondary">Surplus: {item.surplus} {item.unit}</Badge>
                  )}
                  {!hasDeficit && !hasSurplus && (
                    <Badge variant="outline">Exact Match</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {hasDeficit && (
                    <Button size="sm" onClick={() => onStartJob(item.id, item.shortage)}>
                      <Package className="mr-2 h-4 w-4" />
                      Start Job
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              {expandedRows[rowKey] && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50 p-4">
                    <div className="space-y-4">
                      {/* Component Breakdown */}
                      {hasComponents && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Raw Materials Required (per packet):</p>
                          <div className="grid gap-2">
                            {item.invItem.components.map((comp: any, compIdx: number) => {
                              const rawMaterial = inventory.find(inv => inv._id === comp.rawMaterialId);
                              const totalNeeded = comp.quantityRequired * item.shortage;
                              const stockAvailable = rawMaterial?.quantity || 0;
                              const hasEnoughStock = stockAvailable >= totalNeeded;
                              
                              return (
                                <div key={compIdx} className="flex items-center justify-between text-sm border rounded p-2">
                                  <span className="font-medium">{rawMaterial?.name || "Unknown"}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground">
                                      Per Packet: {comp.quantityRequired} {comp.unit}
                                    </span>
                                    <span className="text-muted-foreground">
                                      Total Needed: {totalNeeded} {comp.unit}
                                    </span>
                                    <Badge variant={hasEnoughStock ? "secondary" : "destructive"}>
                                      Stock: {stockAvailable} {comp.unit}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Assignment Details */}
                      {item.assignments && item.assignments.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Assignment Details:</p>
                          <div className="grid gap-2">
                            {item.assignments.map((assignment: any, aIdx: number) => (
                              <div key={aIdx} className="text-sm border rounded p-2 bg-background">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-muted-foreground">Client:</span>{" "}
                                    <span className="font-medium">{assignment.clientName}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Kit:</span>{" "}
                                    <span className="font-medium">{assignment.kitName}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Quantity:</span>{" "}
                                    <span className="font-medium">{assignment.quantity}</span>
                                  </div>
                                  {assignment.productionMonth && (
                                    <div>
                                      <span className="text-muted-foreground">Month:</span>{" "}
                                      <span className="font-medium">{assignment.productionMonth}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
        <h2 className="text-xl font-semibold">Sealed Packet Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Auto-populated based on current B2B and B2C assignments
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
                  <RequirementsTable items={summaryData} />
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
                  <p className="text-muted-foreground text-center py-8">No sealing requirements found.</p>
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
        </div>
      </Tabs>
    </div>
  );
}