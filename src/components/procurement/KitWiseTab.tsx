import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MaterialTable } from "./MaterialTable";
import { MaterialShortage, Vendor } from "@/lib/procurementUtils";

interface KitWiseTabProps {
  data: any[];
  vendors: Vendor[];
  purchasingQuantities: Map<string, number>;
  selectedVendors: Map<string, string>;
  onPurchasingQtyChange: (materialName: string, qty: number) => void;
  onVendorChange: (materialName: string, vendorName: string) => void;
}

export function KitWiseTab({
  data,
  vendors,
  purchasingQuantities,
  selectedVendors,
  onPurchasingQtyChange,
  onVendorChange,
}: KitWiseTabProps) {
  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="space-y-4 pr-4">
        {data.map((kit, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{kit.name}</CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2 mb-1">
                    <Badge variant="secondary" className="font-normal">
                      Program: {kit.assignments[0]?.program?.name || "Unknown"}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      Category: {kit.assignments[0]?.kit?.category || "Unknown"}
                    </Badge>
                  </div>
                  <CardDescription>Total Assigned: {kit.totalQuantity} units</CardDescription>
                </div>
                <Badge
                  variant={
                    kit.materials.some((m: MaterialShortage) => m.shortage > 0)
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {kit.materials.filter((m: MaterialShortage) => m.shortage > 0).length} Shortages
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <MaterialTable
                materials={kit.materials}
                vendors={vendors}
                purchasingQuantities={purchasingQuantities}
                selectedVendors={selectedVendors}
                onPurchasingQtyChange={onPurchasingQtyChange}
                onVendorChange={onVendorChange}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
