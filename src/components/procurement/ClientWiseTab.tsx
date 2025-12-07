import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MaterialTable } from "./MaterialTable";
import { AssignmentsTable } from "./AssignmentsTable";
import { MaterialShortage, Vendor } from "@/lib/procurementUtils";

interface ClientWiseTabProps {
  data: any[];
  vendors: Vendor[];
  purchasingQuantities: Map<string, number>;
  selectedVendors: Map<string, string>;
  onPurchasingQtyChange: (materialName: string, qty: number) => void;
  onVendorChange: (materialName: string, vendorName: string) => void;
}

export function ClientWiseTab({
  data,
  vendors,
  purchasingQuantities,
  selectedVendors,
  onPurchasingQtyChange,
  onVendorChange,
}: ClientWiseTabProps) {
  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="space-y-4 pr-4">
        {data.map((client, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{client.clientName}</CardTitle>
                  <CardDescription>Total Kits Ordered: {client.totalKits}</CardDescription>
                </div>
                <Badge
                  variant={
                    client.materials.some((m: MaterialShortage) => m.shortage > 0)
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {client.materials.filter((m: MaterialShortage) => m.shortage > 0).length} Shortages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <AssignmentsTable assignments={client.assignments} />
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Material Requirements</h4>
                <MaterialTable
                  materials={client.materials}
                  vendors={vendors}
                  purchasingQuantities={purchasingQuantities}
                  selectedVendors={selectedVendors}
                  onPurchasingQtyChange={onPurchasingQtyChange}
                  onVendorChange={onVendorChange}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
