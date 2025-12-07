import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { MaterialShortage, Vendor } from "@/lib/procurementUtils";

interface MaterialTableProps {
  materials: MaterialShortage[];
  vendors: Vendor[];
  purchasingQuantities: Map<string, number>;
  selectedVendors: Map<string, string>;
  onPurchasingQtyChange: (materialName: string, qty: number) => void;
  onVendorChange: (materialName: string, vendorName: string) => void;
}

export function MaterialTable({
  materials,
  vendors,
  purchasingQuantities,
  selectedVendors,
  onPurchasingQtyChange,
  onVendorChange,
}: MaterialTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Order Req.</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Min. Stock</TableHead>
          <TableHead>Shortage (Procurement)</TableHead>
          <TableHead>Purchasing Qty</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead>Est. Cost</TableHead>
          <TableHead className="w-[50px]">Kits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((mat, idx) => {
          const materialKey = mat.name.toLowerCase();
          const purchasingQty = purchasingQuantities.get(materialKey) ?? mat.shortage;
          const selectedVendor = selectedVendors.get(materialKey) || mat.vendorName;
          
          // Get vendors for this material
          const materialVendors = vendors?.filter(v => 
            v.itemPrices?.some(p => p.itemId === mat.inventoryId)
          ) || [];
          
          const estimatedCost = mat.vendorPrice
            ? (purchasingQty * mat.vendorPrice).toFixed(2)
            : null;

          return (
            <TableRow key={idx}>
              <TableCell className="font-medium">{mat.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {mat.category}
                </Badge>
              </TableCell>
              <TableCell>
                {mat.required} {mat.unit}
              </TableCell>
              <TableCell>
                {mat.available} {mat.unit}
              </TableCell>
              <TableCell>
                {mat.minStockLevel || 0} {mat.unit}
              </TableCell>
              <TableCell>
                {mat.shortage > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    {mat.shortage} {mat.unit}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    In Stock
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  value={purchasingQty}
                  onChange={(e) => onPurchasingQtyChange(mat.name, Number(e.target.value))}
                  className="w-24"
                  placeholder="0"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={selectedVendor || ""}
                  onValueChange={(value) => onVendorChange(mat.name, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialVendors.length > 0 ? (
                      materialVendors.map((vendor) => (
                        <SelectItem key={vendor._id} value={vendor.name}>
                          {vendor.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-vendor" disabled>
                        No vendors available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {estimatedCost ? (
                  <span className="font-medium">₹{estimatedCost}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">No price</span>
                )}
              </TableCell>
              <TableCell>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Info className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Used in Kits</h4>
                      <div className="text-sm text-muted-foreground max-h-[200px] overflow-y-auto">
                        {mat.kits.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {mat.kits.map((kit, idx) => (
                              <li key={idx}>{kit}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No kits found</p>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
