import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcurementMaterial } from "@/lib/procurementUtils";

interface KitWiseTabProps {
  materials: ProcurementMaterial[];
  assignments: any[];
  kits: any[];
}

export function KitWiseTab({ materials, assignments, kits }: KitWiseTabProps) {
  // Group materials by kit
  const kitGroups = kits.map(kit => {
    const kitMaterials = materials.filter(m => m.kits.some(k => k.id === kit._id));
    const totalShortage = kitMaterials.reduce((acc, m) => acc + m.shortage, 0);
    
    // Calculate total assigned quantity for this kit
    const assignedQty = assignments
      .filter(a => a.kitId === kit._id && !["received_from_inventory", "dispatched", "delivered"].includes(a.status))
      .reduce((acc, a) => acc + a.quantity, 0);

    return {
      kit,
      materials: kitMaterials,
      totalShortage,
      assignedQty
    };
  }).filter(g => g.materials.length > 0);

  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {kitGroups.map((group) => (
        <AccordionItem key={group.kit._id} value={group.kit._id} className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-4">
                <span className="font-semibold">{group.kit.name}</span>
                <Badge variant="outline">{group.assignedQty} Assigned</Badge>
              </div>
              {group.totalShortage > 0 && (
                <Badge variant="destructive">{group.totalShortage} Shortages</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.materials.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.orderRequired} {item.unit}</TableCell>
                    <TableCell className="text-right">{item.available} {item.unit}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.shortage > 0 ? "text-red-500 font-medium" : ""}>
                        {item.shortage} {item.unit}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
