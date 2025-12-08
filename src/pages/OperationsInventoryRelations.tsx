import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Package, Plus, PackageCheck, Eye } from "lucide-react";
import { MaterialRequestsTab } from "@/components/inventory/MaterialRequestsTab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

export default function OperationsInventoryRelations() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  
  const canViewMaterialRequests = hasPermission("materialRequests", "view");
  const canCreateMaterialRequests = hasPermission("materialRequests", "create");
  const canViewPacking = hasPermission("packing", "view");
  
  const inventory = useQuery(api.inventory.list);
  const packingRequests = useQuery(api.packingRequests.list);
  const createRequest = useMutation(api.materialRequests.create);
  const fulfillPackingRequest = useMutation(api.packingRequests.fulfill);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<Array<{
    inventoryId: string;
    name: string;
    quantity: number;
    unit: string;
  }>>([{ inventoryId: "", name: "", quantity: 0, unit: "" }]);
  
  const [viewItemsSheet, setViewItemsSheet] = useState<{
    open: boolean;
    request: any | null;
  }>({
    open: false,
    request: null,
  });
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleAddItem = () => {
    setItems([...items, { inventoryId: "", name: "", quantity: 0, unit: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === "inventoryId") {
      const selectedItem = inventory?.find(inv => inv._id === value);
      if (selectedItem) {
        newItems[index] = {
          inventoryId: value,
          name: selectedItem.name,
          quantity: newItems[index].quantity,
          unit: selectedItem.unit,
        };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const handleSubmit = async () => {
    try {
      // Validate items
      const validItems = items.filter(item => item.inventoryId && item.quantity > 0);
      if (validItems.length === 0) {
        toast.error("Please add at least one item with a valid quantity");
        return;
      }

      await createRequest({
        items: validItems.map(item => ({
          inventoryId: item.inventoryId as any,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
        purpose: purpose || undefined,
      });

      toast.success("Material request submitted successfully");
      setIsDialogOpen(false);
      setPurpose("");
      setItems([{ inventoryId: "", name: "", quantity: 0, unit: "" }]);
    } catch (error) {
      toast.error("Failed to submit material request");
      console.error(error);
    }
  };

  const handleFulfillPackingRequest = async (id: any) => {
    try {
      await fulfillPackingRequest({ id });
      toast.success("Packing request fulfilled - Inventory reduced and assignments updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to fulfill packing request");
    }
  };

  if (!canViewMaterialRequests && !canViewPacking) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Operations & Inventory Relations</h1>
              <p className="text-muted-foreground mt-2">
                Manage material requests and packing operations
              </p>
            </div>
            
            {canCreateMaterialRequests && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Inventory
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Request Inventory Materials</DialogTitle>
                    <DialogDescription>
                      Submit a request for materials needed from inventory
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="purpose">Purpose (Optional)</Label>
                      <Textarea
                        id="purpose"
                        placeholder="Describe the purpose of this request..."
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Materials</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddItem}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-2">
                            <Label>Material</Label>
                            <Select
                              value={item.inventoryId}
                              onValueChange={(value) => handleItemChange(index, "inventoryId", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select material" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory?.map((inv) => (
                                  <SelectItem key={inv._id} value={inv._id}>
                                    {inv.name} ({inv.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="w-32 space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity || ""}
                              onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>

                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit}>
                        Submit Request
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="mt-6">
            <Tabs defaultValue="material-requests" className="w-full">
              <TabsList>
                {canViewMaterialRequests && (
                  <TabsTrigger value="material-requests">Material Requests</TabsTrigger>
                )}
                {canViewPacking && (
                  <TabsTrigger value="packing-requests">Packing Requests</TabsTrigger>
                )}
              </TabsList>

              {canViewMaterialRequests && (
                <TabsContent value="material-requests">
                  <MaterialRequestsTab />
                </TabsContent>
              )}

              {canViewPacking && (
                <TabsContent value="packing-requests">
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Request ID</TableHead>
                          <TableHead>Assignments</TableHead>
                          <TableHead>Materials</TableHead>
                          <TableHead>Requested By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packingRequests?.map((request) => (
                          <TableRow key={request._id}>
                            <TableCell className="font-mono text-xs">
                              {request._id.slice(-8)}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {request.assignments.map((a: any) => (
                                  <div key={a._id} className="text-sm">
                                    {a.kitName} (×{a.quantity})
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {request.items.length} item(s)
                              </div>
                            </TableCell>
                            <TableCell>{request.requesterEmail}</TableCell>
                            <TableCell>
                              {new Date(request._creationTime).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={request.status === "done" ? "default" : "secondary"}>
                                {request.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewItemsSheet({ open: true, request })}
                                  title="View Items"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {hasPermission("inventory", "editStock") && (
                                  <>
                                    {request.status === "pending" ? (
                                      <Button
                                        size="sm"
                                        onClick={() => handleFulfillPackingRequest(request._id)}
                                      >
                                        <PackageCheck className="h-4 w-4 mr-2" />
                                        Fulfill & Reduce Stock
                                      </Button>
                                    ) : request.status === "done" ? (
                                      <span className="text-sm text-muted-foreground">
                                        Fulfilled by {request.fulfillerEmail}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </motion.div>
      </div>

      <Sheet open={viewItemsSheet.open} onOpenChange={(open) => !open && setViewItemsSheet({ open: false, request: null })}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Packing Request Items</SheetTitle>
            <SheetDescription>
              Request ID: {viewItemsSheet.request?._id.slice(-8)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Assignments</h4>
              <div className="space-y-2">
                {viewItemsSheet.request?.assignments.map((a: any) => (
                  <div key={a._id} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">{a.kitName}</span>
                    <Badge variant="outline">×{a.quantity}</Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold mb-2">Materials Required</h4>
              <div className="space-y-4">
                {/* Main Pouch Materials */}
                {viewItemsSheet.request?.items.filter((item: any) => item.category === "main_pouch").length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Main Pouch</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItemsSheet.request?.items
                          .filter((item: any) => item.category === "main_pouch")
                          .map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {item.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {item.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      All materials reduced directly from inventory
                    </p>
                  </div>
                )}

                {/* Sealed Packets */}
                {viewItemsSheet.request?.items.filter((item: any) => item.category === "sealed_packet").length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Sealed Packets</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Packet Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItemsSheet.request?.items
                          .filter((item: any) => item.category === "sealed_packet")
                          .map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {item.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Sealed packet stock reduced directly
                    </p>
                  </div>
                )}

                {/* Bulk Materials */}
                {viewItemsSheet.request?.items.filter((item: any) => item.category === "bulk").length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Bulk Materials</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItemsSheet.request?.items
                          .filter((item: any) => item.category === "bulk")
                          .map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {item.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Reduced directly from inventory
                    </p>
                  </div>
                )}

                {/* Spare Materials */}
                {viewItemsSheet.request?.items.filter((item: any) => item.category === "spare").length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Spare Materials</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItemsSheet.request?.items
                          .filter((item: any) => item.category === "spare")
                          .map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {item.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Reduced directly from inventory
                    </p>
                  </div>
                )}

                {/* Miscellaneous */}
                {viewItemsSheet.request?.items.filter((item: any) => item.category === "misc").length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Miscellaneous</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItemsSheet.request?.items
                          .filter((item: any) => item.category === "misc")
                          .map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {item.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Reduced directly from inventory
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={viewItemsSheet.request?.status === "done" ? "default" : "secondary"}>
                  {viewItemsSheet.request?.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Requested by:</span>
                <span className="font-medium">{viewItemsSheet.request?.requesterEmail}</span>
              </div>
              {viewItemsSheet.request?.status === "done" && viewItemsSheet.request?.fulfillerEmail && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Fulfilled by:</span>
                  <span className="font-medium">{viewItemsSheet.request?.fulfillerEmail}</span>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
}