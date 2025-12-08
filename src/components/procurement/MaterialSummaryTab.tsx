import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcurementMaterial } from "@/lib/procurementUtils";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaterialSummaryTabProps {
  materials: ProcurementMaterial[];
  vendors: any[];
}

export function MaterialSummaryTab({ materials, vendors }: MaterialSummaryTabProps) {
  const saveQuantity = useMutation(api.procurement.savePurchasingQuantity);
  const saveVendor = useMutation(api.procurement.saveVendorSelection);

  const handleQuantityChange = (materialId: any, quantity: number) => {
    saveQuantity({ materialId, quantity });
  };

  const handleVendorChange = (materialId: any, vendorId: any) => {
    saveVendor({ materialId, vendorId: vendorId as any });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Order Req.</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Min. Stock</TableHead>
            <TableHead className="text-right">Shortage</TableHead>
            <TableHead className="w-[120px]">Purchasing Qty</TableHead>
            <TableHead className="w-[200px]">Vendor</TableHead>
            <TableHead className="text-right">Est. Cost</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                No material requirements found
              </TableCell>
            </TableRow>
          ) : (
            materials.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="text-right">{item.orderRequired} {item.unit}</TableCell>
                <TableCell className="text-right">{item.available} {item.unit}</TableCell>
                <TableCell className="text-right">{item.minStockLevel} {item.unit}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={item.shortage > 0 ? "destructive" : "secondary"}>
                    {item.shortage} {item.unit}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    defaultValue={item.purchasingQty}
                    className="h-8"
                    onBlur={(e) => handleQuantityChange(item.id, parseFloat(e.target.value))}
                  />
                </TableCell>
                <TableCell>
                  <Select 
                    defaultValue={item.vendorId} 
                    onValueChange={(value) => handleVendorChange(item.id, value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v._id} value={v._id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  ₹{item.estCost.toLocaleString()}
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-semibold">Used in Kits:</p>
                          {item.kits.map((k, i) => (
                            <p key={i} className="text-xs">
                              {k.name}: {k.quantity} kits
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
