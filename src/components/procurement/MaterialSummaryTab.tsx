import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MaterialTable } from "./MaterialTable";
import { MaterialShortage, Vendor } from "@/lib/procurementUtils";

interface MaterialSummaryTabProps {
  materials: MaterialShortage[];
  vendors: Vendor[];
  purchasingQuantities: Map<string, number>;
  selectedVendors: Map<string, string>;
  onPurchasingQtyChange: (materialName: string, qty: number) => void;
  onVendorChange: (materialName: string, vendorName: string) => void;
}

export function MaterialSummaryTab({
  materials,
  vendors,
  purchasingQuantities,
  selectedVendors,
  onPurchasingQtyChange,
  onVendorChange,
}: MaterialSummaryTabProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Total Material Requirements</CardTitle>
        <CardDescription>Aggregated list of all materials needed across all assignments</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[calc(100vh-350px)]">
          <div className="p-6 pt-0">
            <MaterialTable
              materials={materials}
              vendors={vendors}
              purchasingQuantities={purchasingQuantities}
              selectedVendors={selectedVendors}
              onPurchasingQtyChange={onPurchasingQtyChange}
              onVendorChange={onVendorChange}
            />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
