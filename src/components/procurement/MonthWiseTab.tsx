import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcurementMaterial, shouldIncludeAssignment } from "@/lib/procurementUtils";

interface MonthWiseTabProps {
  materials: ProcurementMaterial[];
  assignments: any[];
  kits: any[];
  clients: any[];
}

export function MonthWiseTab({ materials, assignments, kits, clients }: MonthWiseTabProps) {
  // Group assignments by month
  const monthGroups = assignments.reduce((acc: any, assignment) => {
    if (!shouldIncludeAssignment(assignment.status)) return acc;
    
    const month = assignment.productionMonth || "Unscheduled";
    if (!acc[month]) {
      acc[month] = {
        month,
        assignments: [],
        materials: new Set()
      };
    }
    
    acc[month].assignments.push(assignment);
    
    // Find materials for this assignment's kit
    const kitMaterials = materials.filter(m => m.kits.some(k => k.id === assignment.kitId));
    kitMaterials.forEach(m => acc[month].materials.add(m));
    
    return acc;
  }, {});

  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {Object.values(monthGroups).map((group: any) => (
        <AccordionItem key={group.month} value={group.month} className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-4">
                <span className="font-semibold">{group.month}</span>
                <Badge variant="outline">{group.assignments.length} Assignments</Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6">
              {/* Assignments Table */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Assignments</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Kit</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.assignments.map((assignment: any) => {
                      const client = clients.find(c => 
                        (c.clientId === assignment.clientId) || (c._id === assignment.clientId)
                      );
                      const kit = kits.find(k => k._id === assignment.kitId);
                      return (
                        <TableRow key={assignment._id}>
                          <TableCell>{client?.name || client?.buyerName || "Unknown"}</TableCell>
                          <TableCell>{kit?.name}</TableCell>
                          <TableCell className="text-right">{assignment.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {assignment.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

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
