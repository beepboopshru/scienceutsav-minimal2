import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MaterialTable } from "./MaterialTable";
import { MaterialShortage, Vendor, aggregateMaterials, InventoryItem } from "@/lib/procurementUtils";

interface AssignmentWiseTabProps {
  assignments: any[];
  kits: any[];
  clients: any[];
  b2cClients: any[];
  inventoryByName: Map<string, InventoryItem>;
  inventoryById: Map<string, InventoryItem>;
  vendors: Vendor[];
  approvedMaterialRequests: any;
  processingJobs: any;
  purchasingQuantities: Map<string, number>;
  selectedVendors: Map<string, string>;
  onPurchasingQtyChange: (materialName: string, qty: number) => void;
  onVendorChange: (materialName: string, vendorName: string) => void;
}

export function AssignmentWiseTab({
  assignments,
  kits,
  clients,
  b2cClients,
  inventoryByName,
  inventoryById,
  vendors,
  approvedMaterialRequests,
  processingJobs,
  purchasingQuantities,
  selectedVendors,
  onPurchasingQtyChange,
  onVendorChange,
}: AssignmentWiseTabProps) {
  
  // Filter active assignments
  const activeAssignments = assignments.filter((a) => {
    const status = a.status;
    return (
      status === "assigned" ||
      status === "in_production" ||
      status === "ready_to_pack" ||
      status === "transferred_to_dispatch" ||
      status === "ready_for_dispatch"
    );
  });

  if (activeAssignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No active assignments found.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="space-y-4 pr-4">
        {activeAssignments.map((assignment) => {
          const kit = kits.find((k) => k._id === assignment.kitId);
          const client = assignment.clientType === "b2b"
            ? clients?.find((c) => c._id === assignment.clientId)
            : b2cClients?.find((c) => c._id === assignment.clientId);

          if (!kit) return null;

          // Calculate materials for this specific assignment
          const allMaterials = aggregateMaterials(
            [assignment],
            inventoryByName,
            inventoryById,
            vendors || [],
            approvedMaterialRequests || undefined,
            processingJobs || undefined
          );

          // Filter to only show materials with shortages
          const materials = allMaterials.filter((m) => m.shortage > 0);
          
          // Skip assignments with no shortages
          if (materials.length === 0) return null;

          const totalShortages = materials.length;

          return (
            <Card key={assignment._id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{kit.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 mt-2 mb-1">
                      <Badge variant="secondary" className="font-normal">
                        Program: {assignment.program?.name || "Unknown"}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        Category: {kit.category || "Unknown"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Client: {assignment.clientType === "b2b" 
                        ? (client as any)?.name 
                        : (client as any)?.buyerName || "Unknown"} • 
                      Quantity: {assignment.quantity} units • 
                      Month: {assignment.productionMonth || "N/A"}
                    </CardDescription>
                  </div>
                  <Badge variant="destructive">
                    {totalShortages} Shortage{totalShortages !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialTable
                  materials={materials}
                  vendors={vendors}
                  purchasingQuantities={purchasingQuantities}
                  selectedVendors={selectedVendors}
                  onPurchasingQtyChange={onPurchasingQtyChange}
                  onVendorChange={onVendorChange}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
