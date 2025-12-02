import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2, CheckCircle, XCircle, Clock, Package } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePermissions } from "@/hooks/use-permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MaterialRequestsTab() {
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Array<{
    inventoryId: Id<"inventory">;
    name: string;
    quantity: number;
    unit: string;
    maxStock: number;
  }>>([]);
  const [purpose, setPurpose] = useState("");

  // Create Item Form State
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    type: "raw" as "raw" | "pre_processed" | "finished" | "sealed_packet",
    quantity: 0,
    unit: "",
    minStockLevel: 0,
    location: "",
    notes: "",
    subcategory: "",
    vendorId: "" as Id<"vendors"> | "",
  });
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  const inventory = useQuery(api.inventory.list);
  const requestsData = useQuery(api.materialRequests.list);
  const createRequest = useMutation(api.materialRequests.create);
  const approveRequest = useMutation(api.materialRequests.approve);
  const rejectRequest = useMutation(api.materialRequests.reject);
  const createItem = useMutation(api.inventory.create);
  const categories = useQuery(api.inventoryCategories.list, {});
  const vendors = useQuery(api.vendors.list);
  const { hasPermission } = usePermissions();

  const filteredInventory = inventory?.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subcategory?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 20) || [];

  const handleAddItem = (item: any) => {
    if (selectedItems.some(i => i.inventoryId === item._id)) {
      toast.error("Item already added to request");
      return;
    }
    setSelectedItems([...selectedItems, {
      inventoryId: item._id,
      name: item.name,
      quantity: 1,
      unit: item.unit,
      maxStock: item.quantity
    }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...selectedItems];
    newItems.splice(index, 1);
    setSelectedItems(newItems);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const newItems = [...selectedItems];
    newItems[index].quantity = qty;
    setSelectedItems(newItems);
  };

  const handleSubmitRequest = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Please specify a purpose");
      return;
    }

    try {
      await createRequest({
        items: selectedItems.map(i => ({
          inventoryId: i.inventoryId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit
        })),
        purpose
      });
      toast.success("Request submitted successfully");
      setIsRequestDialogOpen(false);
      setSelectedItems([]);
      setPurpose("");
    } catch (error) {
      toast.error("Failed to submit request");
      console.error(error);
    }
  };

  const handleCreateItem = async () => {
    if (!itemForm.name.trim()) {
      toast.error("Please enter an item name");
      return;
    }
    if (!itemForm.unit.trim()) {
      toast.error("Please enter a unit");
      return;
    }

    try {
      const dataToSubmit: any = {
        name: itemForm.name,
        description: itemForm.description || undefined,
        type: itemForm.type,
        quantity: itemForm.quantity,
        unit: itemForm.unit,
        minStockLevel: itemForm.minStockLevel || undefined,
        location: itemForm.location || undefined,
        notes: itemForm.notes || undefined,
        subcategory: itemForm.subcategory || undefined,
        vendorId: itemForm.vendorId || undefined,
      };

      await createItem(dataToSubmit);
      toast.success("Item created successfully");
      setIsCreateItemDialogOpen(false);
      setItemForm({
        name: "",
        description: "",
        type: "raw",
        quantity: 0,
        unit: "",
        minStockLevel: 0,
        location: "",
        notes: "",
        subcategory: "",
        vendorId: "",
      });
    } catch (error) {
      toast.error("Failed to create item");
      console.error(error);
    }
  };

  const handleApprove = async (requestId: Id<"materialRequests">) => {
    try {
      await approveRequest({ requestId });
      toast.success("Request approved and inventory updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve request");
    }
  };

  const handleReject = async (requestId: Id<"materialRequests">) => {
    try {
      await rejectRequest({ requestId });
      toast.success("Request rejected");
    } catch (error) {
      toast.error("Failed to reject request");
    }
  };

  if (!requestsData) return <div>Loading...</div>;

  const { requests, isManager } = requestsData;
  const canCreate = hasPermission("materialRequests", "create");
  const canApprove = hasPermission("materialRequests", "approve");
  const canReject = hasPermission("materialRequests", "reject");
  const canCreateInventory = hasPermission("inventory", "create");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Material Requests</h2>
          <p className="text-muted-foreground">Request items from inventory for projects or usage.</p>
        </div>
        <div className="flex gap-2">
          {canCreateInventory && (
            <Dialog open={isCreateItemDialogOpen} onOpenChange={setIsCreateItemDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Package className="mr-2 h-4 w-4" />
                  Create Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Inventory Item</DialogTitle>
                  <DialogDescription>Add a new item to the inventory system.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Item Name *</Label>
                      <Input
                        value={itemForm.name}
                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                        placeholder="Enter item name"
                      />
                    </div>
                    <div>
                      <Label>Type *</Label>
                      <Select
                        value={itemForm.type}
                        onValueChange={(value: any) => setItemForm({ ...itemForm, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="raw">Raw Material</SelectItem>
                          <SelectItem value="pre_processed">Pre-Processed</SelectItem>
                          <SelectItem value="finished">Finished</SelectItem>
                          <SelectItem value="sealed_packet">Sealed Packet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      placeholder="Enter description"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Unit *</Label>
                      <Input
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                        placeholder="e.g., kg, pcs"
                      />
                    </div>
                    <div>
                      <Label>Min Stock Level</Label>
                      <Input
                        type="number"
                        value={itemForm.minStockLevel}
                        onChange={(e) => setItemForm({ ...itemForm, minStockLevel: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Subcategory</Label>
                      <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {itemForm.subcategory || "Select category"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search category..." />
                            <CommandEmpty>No category found.</CommandEmpty>
                            <CommandGroup>
                              {categories?.map((cat) => (
                                <CommandItem
                                  key={cat._id}
                                  value={cat.name}
                                  onSelect={() => {
                                    setItemForm({ ...itemForm, subcategory: cat.name });
                                    setCategoryPopoverOpen(false);
                                  }}
                                >
                                  {cat.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={itemForm.location}
                        onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                        placeholder="Storage location"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Vendor</Label>
                    <Select
                      value={itemForm.vendorId}
                      onValueChange={(value) => setItemForm({ ...itemForm, vendorId: value as Id<"vendors"> })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {vendors?.map((vendor) => (
                          <SelectItem key={vendor._id} value={vendor._id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={itemForm.notes}
                      onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                      placeholder="Additional notes"
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateItemDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateItem}>Create Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {canCreate && (
            <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>New Material Request</DialogTitle>
                  <DialogDescription>Select items from inventory to request.</DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search inventory..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                    <Card className="flex flex-col min-h-0">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm">Available Items</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-y-auto p-0">
                        <div className="divide-y">
                          {filteredInventory.map((item) => (
                            <div key={item._id} className="p-3 flex justify-between items-center hover:bg-muted/50">
                              <div className="overflow-hidden">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Stock: {item.quantity} {item.unit}
                                </p>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => handleAddItem(item)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col min-h-0">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm">Selected Items</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No items selected</p>
                        ) : (
                          selectedItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 border rounded-md bg-card">
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-sm">{item.name}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveItem(idx)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value))}
                                  className="h-8 w-24"
                                />
                                <span className="text-xs text-muted-foreground">{item.unit}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <Label>Purpose / Note</Label>
                    <Textarea 
                      placeholder="Why do you need these materials?"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmitRequest}>Submit Request</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                {(canApprove || canReject) && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(canApprove || canReject) ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No requests found
                  </TableCell>
                </TableRow>
              )}
              {requests?.map((req) => (
                <TableRow key={req._id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(req._creationTime).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{req.requesterEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {req.items.map((item, idx) => (
                        <span key={idx} className="text-sm">
                          {item.quantity} {item.unit} x {item.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={req.purpose}>
                    {req.purpose || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      req.status === "approved" ? "default" : 
                      req.status === "rejected" ? "destructive" : "secondary"
                    }>
                      {req.status === "approved" && <CheckCircle className="mr-1 h-3 w-3" />}
                      {req.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                      {req.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                      {req.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  {(canApprove || canReject) && (
                    <TableCell>
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          {canApprove && (
                            <Button size="sm" onClick={() => handleApprove(req._id)} className="h-8">
                              Approve
                            </Button>
                          )}
                          {canReject && (
                            <Button size="sm" variant="outline" onClick={() => handleReject(req._id)} className="h-8 text-destructive hover:text-destructive">
                              Reject
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}