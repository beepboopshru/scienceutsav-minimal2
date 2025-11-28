import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import { Scissors } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface ProcessingRequirementsProps {
  assignments: any[];
  inventory: any[];
  onStartJob: (targetItemId: Id<"inventory">, quantity: number) => void;
}

export function ProcessingRequirements({ assignments, inventory, onStartJob }: ProcessingRequirementsProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const inventoryByName = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [i.name.toLowerCase(), i]));
  }, [inventory]);

  const calculateShortages = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !inventory) return [];

    const requirements: any[] = [];
    const requiredQty = assignment.quantity;

    const processMaterial = (name: string, qtyPerKit: number, unit: string, category: string) => {
      const invItem = inventoryByName.get(name.toLowerCase());
      // We only care about pre-processed items or items with components (BOM)
      if (!invItem || (invItem.type !== "pre_processed" && (!invItem.components || invItem.components.length === 0))) {
        return;
      }

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
        } else {
          materialMap.set(key, {
            id: item.id,
            name: item.name,
            required: item.required,
            available: item.available,
            unit: item.unit,
            category: item.category,
            kits: new Set([assignment.kit?.name || "Unknown"]),
            invItem: item.invItem
          });
        }
      });
    });

    return Array.from(materialMap.values()).map((item) => ({
      ...item,
      shortage: Math.max(0, item.required - item.available),
      kits: Array.from(item.kits),
    })).filter(i => i.shortage > 0);
  };

  // Generate Data Views
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
      })).filter(m => m.requirements.length > 0);
  }, [assignments, inventory]);

  const clientWiseData = useMemo(() => {
    const clientMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      const clientName = (assignment.client as any)?.name || "Unknown Client";
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
  }, [assignments, inventory]);

  const RequirementsTable = ({ items }: { items: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item Name</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Shortage</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.required} {item.unit}</TableCell>
            <TableCell>{item.available} {item.unit}</TableCell>
            <TableCell>
              <Badge variant="destructive">{item.shortage} {item.unit}</Badge>
            </TableCell>
            <TableCell>
              <Button size="sm" onClick={() => onStartJob(item.id, item.shortage)}>
                <Scissors className="mr-2 h-4 w-4" />
                Start Job
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Processing Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Items that need to be processed based on current assignments
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
        </div>
      </Tabs>
    </div>
  );
}
