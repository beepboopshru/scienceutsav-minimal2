import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Package, Plus, PackageCheck, Eye, Check, ChevronsUpDown } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  
  const [comboboxOpen, setComboboxOpen] = useState<Record<number, boolean>>({});

  const [viewItemsSheet, setViewItemsSheet] = useState<{
    open: boolean;
    request: any | null;
  }>({
    open: false,
    request: null,
  });
  
  const [fulfillDialog, setFulfillDialog] = useState<{
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
      setFulfillDialog({ open: false, request: null });
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
                            <Popover
                              open={comboboxOpen[index]}
                              onOpenChange={(open) => setComboboxOpen(prev => ({ ...prev, [index]: open }))}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={comboboxOpen[index]}
                                  className="w-full justify-between"
                                >
                                  {item.inventoryId
                                    ? inventory?.find((inv) => inv._id === item.inventoryId)?.name
                                    : "Select material"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search material..." />
                                  <CommandList>
                                    <CommandEmpty>No material found.</CommandEmpty>
                                    <CommandGroup>
                                      {inventory?.map((inv) => (
                                        <CommandItem
                                          key={inv._id}
                                          value={inv.name}
                                          onSelect={() => {
                                            handleItemChange(index, "inventoryId", inv._id);
                                            setComboboxOpen(prev => ({ ...prev, [index]: false }));
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              item.inventoryId === inv._id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {inv.name} ({inv.unit})
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
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
                <TabsTrigger value="completed-requests">Completed Requests</TabsTrigger>
              </TabsList>

              {canViewMaterialRequests && (
                <TabsContent value="material-requests">
                  <MaterialRequestsTab view="active" />
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
                        {packingRequests?.filter(r => r.status !== "done").map((request) => (
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
                                        onClick={() => setFulfillDialog({ open: true, request })}
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
                        {packingRequests?.filter(r => r.status !== "done").length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No active packing requests found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="completed-requests">
                <div className="space-y-8">
                  {canViewMaterialRequests && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Completed Material Requests</h3>
                      <MaterialRequestsTab view="completed" />
                    </div>
                  )}
                  
                  {canViewPacking && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Completed Packing Requests</h3>
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
                          {packingRequests?.filter(r => r.status === "done").map((request) => (
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
                                <Badge variant="outline">
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
                                  <span className="text-sm text-muted-foreground">
                                    Fulfilled by {request.fulfillerEmail}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {packingRequests?.filter(r => r.status === "done").length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No completed packing requests found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>

      {/* Fulfill Confirmation Dialog */}
      <Dialog open={fulfillDialog.open} onOpenChange={(open) => !open && setFulfillDialog({ open: false, request: null })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Fulfillment</DialogTitle>
            <DialogDescription>
              The following items will be reduced from inventory. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-semibold mb-3">Items to be Reduced</h4>
              <div className="space-y-2">
                {fulfillDialog.request?.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-background rounded border">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.type} • {item.category || 'uncategorized'}
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-4">
                      -{item.quantity} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">Affected Assignments</h4>
              <div className="space-y-1">
                {fulfillDialog.request?.assignments.map((a: any) => (
                  <div key={a._id} className="text-sm py-1">
                    • {a.kitName} (×{a.quantity})
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <div className="text-yellow-600 dark:text-yellow-500 mt-0.5">⚠️</div>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This will immediately reduce inventory quantities and update assignment statuses to "received_from_inventory". Make sure all items are available before proceeding.
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFulfillDialog({ open: false, request: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleFulfillPackingRequest(fulfillDialog.request?._id)}
            >
              <PackageCheck className="h-4 w-4 mr-2" />
              Confirm & Fulfill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <h4 className="text-sm font-semibold mb-2">Kit Structure & Materials</h4>
              <div className="space-y-4">
                {viewItemsSheet.request?.assignments.map((assignment: any, assignmentIdx: number) => (
                  <div key={assignmentIdx} className="border rounded-lg p-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="font-semibold">{assignment.kitName}</h5>
                      <Badge variant="outline">×{assignment.quantity}</Badge>
                    </div>
                    
                    {assignment.kitStructure ? (
                      <div className="space-y-3">
                        {/* Pouches with their materials */}
                        {assignment.kitStructure.pouches && assignment.kitStructure.pouches.length > 0 && (
                          <div>
                            <h6 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Pouches</h6>
                            {assignment.kitStructure.pouches.map((pouch: any, pouchIdx: number) => (
                              <div key={pouchIdx} className="ml-2 mb-3 border-l-2 border-primary/20 pl-3">
                                <div className="font-medium text-sm mb-1">{pouch.name || `Pouch ${pouchIdx + 1}`}</div>
                                {pouch.materials && pouch.materials.length > 0 && (
                                  <div className="ml-2 space-y-1">
                                    {pouch.materials.map((material: any, matIdx: number) => {
                                      // Find the actual quantity from the packing request items
                                      const materialItem = viewItemsSheet.request?.items.find(
                                        (item: any) => item.category === "main_pouch" && item.name === material.name
                                      );
                                      const displayQuantity = materialItem?.quantity || 0;
                                      
                                      return (
                                        <div key={matIdx} className="text-sm py-1 flex items-center justify-between">
                                          <span className="text-muted-foreground">
                                            • {material.name}
                                            <Badge variant="secondary" className="text-xs ml-2">
                                              {material.type || 'raw'}
                                            </Badge>
                                          </span>
                                          <Badge variant="outline" className="text-xs ml-2">
                                            {displayQuantity} {materialItem?.unit || 'pcs'}
                                          </Badge>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Sealed Packets */}
                        {assignment.kitStructure.packets && assignment.kitStructure.packets.length > 0 && (
                          <div>
                            <h6 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Sealed Packets</h6>
                            <div className="ml-2 space-y-1">
                              {assignment.kitStructure.packets.map((packet: any, packetIdx: number) => {
                                // Find the actual quantity from the packing request items
                                // Match by name and category
                                const packetItem = viewItemsSheet.request?.items.find(
                                  (item: any) => item.category === "sealed_packet" && item.name === packet.name
                                );
                                
                                // If not found by exact match, calculate default quantity
                                const displayQuantity = packetItem?.quantity || (assignment.quantity * (packet.quantity || 1));
                                const displayUnit = packetItem?.unit || packet.unit || 'pcs';
                                
                                return (
                                  <div key={packetIdx} className="text-sm py-1 flex items-center justify-between">
                                    <span className="text-muted-foreground">• {packet.name}</span>
                                    <Badge variant="outline" className="text-xs ml-2">
                                      {displayQuantity} {displayUnit}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No structured packing requirements available</p>
                    )}
                    
                    {/* Additional categories if they exist */}
                    {viewItemsSheet.request?.items.filter((item: any) => item.category === "bulk").length > 0 && (
                      <div>
                        <h6 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Bulk Materials</h6>
                        <div className="ml-2 space-y-1">
                          {viewItemsSheet.request?.items
                            .filter((item: any) => item.category === "bulk")
                            .map((item: any, idx: number) => (
                              <div key={idx} className="text-sm py-1 flex items-center justify-between">
                                <span className="text-muted-foreground">• {item.name}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {item.quantity} {item.unit}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    
                    {viewItemsSheet.request?.items.filter((item: any) => item.category === "spare").length > 0 && (
                      <div>
                        <h6 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Spare Materials</h6>
                        <div className="ml-2 space-y-1">
                          {viewItemsSheet.request?.items
                            .filter((item: any) => item.category === "spare")
                            .map((item: any, idx: number) => (
                              <div key={idx} className="text-sm py-1 flex items-center justify-between">
                                <span className="text-muted-foreground">• {item.name}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {item.quantity} {item.unit}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    
                    {viewItemsSheet.request?.items.filter((item: any) => item.category === "misc").length > 0 && (
                      <div>
                        <h6 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Miscellaneous</h6>
                        <div className="ml-2 space-y-1">
                          {viewItemsSheet.request?.items
                            .filter((item: any) => item.category === "misc")
                            .map((item: any, idx: number) => (
                              <div key={idx} className="text-sm py-1 flex items-center justify-between">
                                <span className="text-muted-foreground">• {item.name}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {item.quantity} {item.unit}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <p className="text-xs text-muted-foreground mt-2 italic">
                  All materials are reduced directly from inventory upon fulfillment
                </p>
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