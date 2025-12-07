import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcurementMaterial, shouldIncludeAssignment } from "@/lib/procurementUtils";

interface AssignmentWiseTabProps {
  materials: ProcurementMaterial[];
  assignments: any[];
  kits: any[];
  clients: any[];
}

export function AssignmentWiseTab({ materials, assignments, kits, clients }: AssignmentWiseTabProps) {
  const activeAssignments = assignments.filter(a => shouldIncludeAssignment(a.status));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {activeAssignments.map((assignment) => {
        const kit = kits.find(k => k._id === assignment.kitId);
        const client = clients.find(c => (c.clientId === assignment.clientId) || (c._id === assignment.clientId));
        const assignmentMaterials = materials.filter(m => m.kits.some(k => k.id === kit?._id));
        const shortageCount = assignmentMaterials.filter(m => m.shortage > 0).length;

        return (
          <Card key={assignment._id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base font-medium leading-tight">
                  {kit?.name}
                </CardTitle>
                {shortageCount > 0 && (
                  <Badge variant="destructive">{shortageCount} Shortages</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {client?.name || client?.buyerName} • {assignment.quantity} Kits
              </p>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="secondary" className="capitalize">
                    {assignment.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Month:</span>
                  <span>{assignment.productionMonth || "Unscheduled"}</span>
                </div>
                
                {assignmentMaterials.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold mb-2">Key Shortages:</p>
                    <div className="space-y-1">
                      {assignmentMaterials
                        .filter(m => m.shortage > 0)
                        .slice(0, 3)
                        .map(m => (
                          <div key={m.id} className="flex justify-between text-xs">
                            <span className="truncate max-w-[150px]">{m.name}</span>
                            <span className="text-red-500">{m.shortage} {m.unit}</span>
                          </div>
                        ))}
                      {assignmentMaterials.filter(m => m.shortage > 0).length > 3 && (
                        <p className="text-xs text-muted-foreground pt-1">
                          + {assignmentMaterials.filter(m => m.shortage > 0).length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
