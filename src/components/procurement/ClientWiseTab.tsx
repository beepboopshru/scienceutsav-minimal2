import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcurementMaterial, shouldIncludeAssignment } from "@/lib/procurementUtils";

interface ClientWiseTabProps {
  materials: ProcurementMaterial[];
  assignments: any[];
  clients: any[];
}

export function ClientWiseTab({ materials, assignments, clients }: ClientWiseTabProps) {
  // Group assignments by client
  const clientGroups = assignments.reduce((acc: any, assignment) => {
    if (!shouldIncludeAssignment(assignment.status)) return acc;
    
    const clientId = assignment.clientId;
    if (!acc[clientId]) {
      const client = clients.find(c => (c.clientId === clientId) || (c._id === clientId));
      acc[clientId] = {
        id: clientId,
        name: client?.name || client?.buyerName || "Unknown Client",
        assignments: [],
        materials: new Set()
      };
    }
    
    acc[clientId].assignments.push(assignment);
    
    // Find materials for this assignment's kit
    const kitMaterials = materials.filter(m => m.kits.some(k => k.id === assignment.kitId));
    kitMaterials.forEach(m => acc[clientId].materials.add(m));
    
    return acc;
  }, {});

  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {Object.values(clientGroups).map((group: any) => (
        <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-4">
                <span className="font-semibold">{group.name}</span>
                <Badge variant="outline">{group.assignments.length} Assignments</Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6">
              {/* Materials Table */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Material Requirements</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(group.materials).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.orderRequired} {item.unit}</TableCell>
                        <TableCell className="text-right">
                          <span className={item.shortage > 0 ? "text-red-500 font-medium" : ""}>
                            {item.shortage} {item.unit}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
