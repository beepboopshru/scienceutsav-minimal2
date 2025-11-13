import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { 
  Loader2, 
  Plus, 
  Search, 
  AlertTriangle,
  FileText,
  Settings,
  Upload,
  Trash2,
  Package,
  ListTree,
  Edit,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function Inventory() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const inventory = useQuery(api.inventory.list);
  const categories = useQuery(api.inventoryCategories.list, {});
  const vendors = useQuery(api.vendors.list);
  const kits = useQuery(api.kits.list);
  
  const createItem = useMutation(api.inventory.create);
  const updateItem = useMutation(api.inventory.update);
  const updateQuantity = useMutation(api.inventory.updateQuantity);
  const removeItem = useMutation(api.inventory.remove);
  const createCategory = useMutation(api.inventoryCategories.create);
  const removeCategory = useMutation(api.inventoryCategories.remove);
  const createVendorImport = useMutation(api.vendorImports.create);
  const updateKit = useMutation(api.kits.update);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("all");
  const [editingQuantity, setEditingQuantity] = useState<Id<"inventory"> | string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const [viewPacketOpen, setViewPacketOpen] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<any>(null);
  const [vendorInfoOpen, setVendorInfoOpen] = useState(false);
  const [selectedItemForVendors, setSelectedItemForVendors] = useState<any>(null);
  const [bomViewerOpen, setBomViewerOpen] = useState(false);
  const [selectedBomItem, setSelectedBomItem] = useState<any>(null);

  // Dialog states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [billImportOpen, setBillImportOpen] = useState(false);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);

  const getVendorsForItem = useQuery(
    api.vendors.getVendorsForItem,
    selectedItemForVendors && !selectedItemForVendors.isKitPacket
      ? { itemId: selectedItemForVendors._id }
      : "skip"
  );

  // Form states
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    type: "raw" as "raw" | "pre_processed" | "finished" | "sealed_packet",
    quantity: 0,
    unit: "",
    minStockLevel: 10,
    location: "",
    notes: "",
    subcategory: "",
    components: [] as Array<{ rawMaterialId: Id<"inventory">, quantityRequired: number, unit: string }>,
  });

  const [processingForm, setProcessingForm] = useState({
    name: "",
    sourceItemId: "" as Id<"inventory">,
    sourceQuantity: 0,
    targets: [{ targetItemId: "" as Id<"inventory">, targetQuantity: 0 }],
    processedBy: "",
    processedByType: "in_house" as "vendor" | "service" | "in_house",
    notes: "",
  });

  const [billForm, setBillForm] = useState({
    vendorId: "" as Id<"vendors">,
    billNumber: "",
    billDate: new Date().toISOString().split('T')[0],
    items: [{ inventoryId: "" as Id<"inventory">, quantity: 0, unitPrice: 0 }],
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    value: "",
    categoryType: "raw_material" as "raw_material" | "pre_processed",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !inventory || !categories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  // Create virtual packet items from kits
  const virtualPackets: any[] = [];
  if (kits) {
    kits.forEach((kit) => {
      if (kit.packingRequirements) {
        try {
          const packingData = JSON.parse(kit.packingRequirements);
          if (packingData.packets && Array.isArray(packingData.packets)) {
            packingData.packets.forEach((packet: any, index: number) => {
              virtualPackets.push({
                _id: `${kit._id}_packet_${index}`,
                name: `[${kit.name}] ${packet.name}`,
                description: `Sealed packet from ${kit.name}`,
                type: "sealed_packet",
                quantity: kit.stockCount,
                unit: "packet",
                minStockLevel: 0,
                location: "",
                notes: "",
                subcategory: "sealed_packet",
                isKitPacket: true,
                sourceKit: kit,
                componentType: "packet",
                componentData: packet,
              });
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    });
  }

  // Combine real inventory with virtual packets
  const combinedInventory = [...inventory, ...virtualPackets];

  // Filter inventory
  const filteredInventory = combinedInventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesSubcategory = filterSubcategory === "all" || item.subcategory === filterSubcategory;
    return matchesSearch && matchesType && matchesSubcategory;
  });

  // Get unique subcategories for current type filter
  const availableSubcategories = Array.from(
    new Set(
      combinedInventory
        .filter((item) => filterType === "all" || item.type === filterType)
        .map((item) => item.subcategory)
        .filter((subcat): subcat is string => typeof subcat === "string" && subcat.trim() !== "")
    )
  );

  const handleAddItem = async () => {
    try {
      const dataToSubmit = { ...itemForm };
      if (itemForm.type !== "pre_processed" || itemForm.components.length === 0) {
        delete (dataToSubmit as any).components;
      }
      await createItem(dataToSubmit);
      toast.success("Item added successfully");
      setAddItemOpen(false);
      setItemForm({
        name: "",
        description: "",
        type: "raw",
        quantity: 0,
        unit: "",
        minStockLevel: 10,
        location: "",
        notes: "",
        subcategory: "",
        components: [],
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to add item");
    }
  };

  const handleEditItem = async () => {
    if (!selectedItem) return;
    try {
      const dataToSubmit = { id: selectedItem._id, ...itemForm };
      if (itemForm.type !== "pre_processed" || itemForm.components.length === 0) {
        delete (dataToSubmit as any).components;
      }
      await updateItem(dataToSubmit);
      toast.success("Item updated successfully");
      setEditItemOpen(false);
      setSelectedItem(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update item");
    }
  };

  const handleQuantityEdit = (item: any) => {
    setEditingQuantity(item._id);
    setTempQuantity(item.quantity);
  };

  const handleQuantitySave = async (itemId: Id<"inventory"> | string, item: any) => {
    try {
      if (item.isKitPacket && item.sourceKit) {
        // For virtual packets, update the kit's stockCount
        const updateKit = useMutation(api.kits.update);
        await updateKit({ 
          id: item.sourceKit._id, 
          stockCount: tempQuantity 
        });
        toast.success("Kit stock count updated");
      } else {
        // For real inventory items
        await updateQuantity({ id: itemId as Id<"inventory">, quantity: tempQuantity });
        toast.success("Quantity updated");
      }
      setEditingQuantity(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update quantity");
    }
  };

  const handleBillImport = async () => {
    try {
      const totalAmount = billForm.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      await createVendorImport({
        ...billForm,
        totalAmount,
      });
      toast.success("Bill imported successfully");
      setBillImportOpen(false);
      setBillForm({
        vendorId: "" as Id<"vendors">,
        billNumber: "",
        billDate: new Date().toISOString().split('T')[0],
        items: [{ inventoryId: "" as Id<"inventory">, quantity: 0, unitPrice: 0 }],
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to import bill");
    }
  };

  const handleAddCategory = async () => {
    try {
      await createCategory(categoryForm);
      toast.success("Category added");
      setCategoryForm({ name: "", value: "", categoryType: "raw_material" });
    } catch (error: any) {
      toast.error(error.message || "Failed to add category");
    }
  };

  const openEditDialog = (item: any) => {
    setSelectedItem(item);
    setItemForm({
      name: item.name,
      description: item.description || "",
      type: item.type,
      quantity: item.quantity,
      unit: item.unit,
      minStockLevel: item.minStockLevel || 10,
      location: item.location || "",
      notes: item.notes || "",
      subcategory: item.subcategory || "",
      components: item.components || [],
    });
    setEditItemOpen(true);
  };

  const openViewPacketDialog = (packet: any) => {
    setSelectedPacket(packet);
    setViewPacketOpen(true);
  };

  return (
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage materials, stock levels, and processing
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/inventory/processing-jobs")} variant="outline">
                Processing Jobs
              </Button>
              <Button onClick={() => navigate("/inventory/bill-records")} variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Bill Records
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                  <DialogDescription>Create a new inventory item</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      placeholder="Brief description of the item"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                        placeholder="e.g., 100"
                      />
                      <p className="text-xs text-muted-foreground">Current stock amount</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                        placeholder="e.g., kg, pcs, meters"
                      />
                      <p className="text-xs text-muted-foreground">Measurement unit</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Min Stock Level</Label>
                      <Input
                        type="number"
                        value={itemForm.minStockLevel}
                        onChange={(e) => setItemForm({ ...itemForm, minStockLevel: Number(e.target.value) })}
                        placeholder="e.g., 10"
                      />
                      <p className="text-xs text-muted-foreground">Low stock alert threshold</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={itemForm.location}
                        onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subcategory</Label>
                      <Select
                        value={itemForm.subcategory}
                        onValueChange={(value) => setItemForm({ ...itemForm, subcategory: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                            <SelectItem key={cat._id} value={cat.value}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={itemForm.notes}
                      onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                    />
                  </div>
                  
                  {itemForm.type === "pre_processed" && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <ListTree className="h-4 w-4" />
                          Bill of Materials (BOM)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Define the raw materials required to create this pre-processed item
                        </p>
                        {itemForm.components.map((component, index) => (
                          <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                            <Select
                              value={component.rawMaterialId}
                              onValueChange={(value: any) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].rawMaterialId = value;
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select raw material" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory?.filter(item => item.type === "raw").map((rawItem) => (
                                  <SelectItem key={rawItem._id} value={rawItem._id}>
                                    {rawItem.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="Quantity"
                              value={component.quantityRequired}
                              onChange={(e) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].quantityRequired = Number(e.target.value);
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            />
                            <Input
                              placeholder="Unit"
                              value={component.unit}
                              onChange={(e) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].unit = e.target.value;
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newComponents = itemForm.components.filter((_, i) => i !== index);
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setItemForm({
                              ...itemForm,
                              components: [...itemForm.components, { rawMaterialId: "" as Id<"inventory">, quantityRequired: 0, unit: "" }],
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Component
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddItem}>Add Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={billImportOpen} onOpenChange={setBillImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Bill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Vendor Bill</DialogTitle>
                  <DialogDescription>Record a purchase from a vendor</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select
                        value={billForm.vendorId}
                        onValueChange={(value: any) => setBillForm({ ...billForm, vendorId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors?.map((vendor) => (
                            <SelectItem key={vendor._id} value={vendor._id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Bill Number</Label>
                      <Input
                        value={billForm.billNumber}
                        onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bill Date</Label>
                      <Input
                        type="date"
                        value={billForm.billDate}
                        onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <Separator />
                  <Label>Items</Label>
                  {billForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-start">
                      <div className="space-y-2">
                        <Select
                          value={item.inventoryId}
                          onValueChange={(value: any) => {
                            const newItems = [...billForm.items];
                            newItems[index].inventoryId = value;
                            setBillForm({ ...billForm, items: newItems });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventory?.map((invItem) => (
                              <SelectItem key={invItem._id} value={invItem._id}>
                                {invItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="e.g., 50"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...billForm.items];
                            newItems[index].quantity = Number(e.target.value);
                            setBillForm({ ...billForm, items: newItems });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Quantity purchased</p>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="e.g., 150.00"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const newItems = [...billForm.items];
                            newItems[index].unitPrice = Number(e.target.value);
                            setBillForm({ ...billForm, items: newItems });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Price per unit (₹)</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newItems = billForm.items.filter((_, i) => i !== index);
                          if (newItems.length === 0) {
                            setBillForm({ ...billForm, items: [{ inventoryId: "" as Id<"inventory">, quantity: 0, unitPrice: 0 }] });
                          } else {
                            setBillForm({ ...billForm, items: newItems });
                          }
                        }}
                        disabled={billForm.items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBillForm({
                        ...billForm,
                        items: [...billForm.items, { inventoryId: "" as Id<"inventory">, quantity: 0, unitPrice: 0 }],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                  <div className="text-right font-semibold">
                    Total: ₹{billForm.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBillImportOpen(false)}>Cancel</Button>
                  <Button onClick={handleBillImport}>Import Bill</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={categoryManagementOpen} onOpenChange={setCategoryManagementOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Subcategories</DialogTitle>
                  <DialogDescription>Add or remove inventory subcategories</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Add New Category</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Name (e.g., Electronics)"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      />
                      <Input
                        placeholder="Value (e.g., electronics)"
                        value={categoryForm.value}
                        onChange={(e) => setCategoryForm({ ...categoryForm, value: e.target.value })}
                      />
                    </div>
                    <Select
                      value={categoryForm.categoryType}
                      onValueChange={(value: any) => setCategoryForm({ ...categoryForm, categoryType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw_material">Raw Material</SelectItem>
                        <SelectItem value="pre_processed">Pre-Processed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddCategory} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Existing Categories</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {categories?.map((cat) => (
                        <div key={cat._id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {cat.categoryType === "raw_material" ? "Raw Material" : "Pre-Processed"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await removeCategory({ id: cat._id });
                                toast.success("Category removed");
                              } catch (error: any) {
                                toast.error(error.message);
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="raw">Raw Material</SelectItem>
                      <SelectItem value="pre_processed">Pre-Processed</SelectItem>
                      <SelectItem value="finished">Finished</SelectItem>
                      <SelectItem value="sealed_packet">Sealed Packet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select value={filterSubcategory} onValueChange={setFilterSubcategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subcategories</SelectItem>
                      {availableSubcategories.filter(Boolean).map((subcat) => (
                        <SelectItem key={subcat} value={subcat}>
                          {subcat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Table */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Items ({filteredInventory.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subcategory</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendor Info</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-2">
                            {item.isKitPacket && <Package className="h-4 w-4 text-muted-foreground" />}
                            {!item.isKitPacket && item.type === "pre_processed" && item.components && item.components.length > 0 && (
                              <ListTree className="h-4 w-4 text-blue-500" />
                            )}
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.type === "raw" ? "Raw" : item.type === "pre_processed" ? "Pre-Processed" : item.type === "finished" ? "Finished" : "Sealed Packet"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.subcategory || "-"}</TableCell>
                      <TableCell>
                        {editingQuantity === item._id ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={tempQuantity}
                              onChange={(e) => setTempQuantity(Number(e.target.value))}
                              className="w-20"
                            />
                            <Button size="sm" onClick={() => handleQuantitySave(item._id, item)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => handleQuantityEdit(item)}
                            title={item.isKitPacket ? "Click to edit kit stock count" : "Click to edit quantity"}
                          >
                            {item.quantity}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.location || "-"}</TableCell>
                      <TableCell>
                        {item.minStockLevel && item.quantity <= item.minStockLevel ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!item.isKitPacket && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItemForVendors(item);
                              setVendorInfoOpen(true);
                            }}
                          >
                            View
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {item.isKitPacket ? (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => openViewPacketDialog(item)}
                              title="View Components"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              {item.type === "pre_processed" && item.components && item.components.length > 0 && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => {
                                    setSelectedBomItem(item);
                                    setBomViewerOpen(true);
                                  }}
                                  title="View BOM"
                                >
                                  <ListTree className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => openEditDialog(item)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={async () => {
                                  if (confirm("Delete this item?")) {
                                    try {
                                      await removeItem({ id: item._id });
                                      toast.success("Item deleted");
                                    } catch (error: any) {
                                      toast.error(error.message);
                                    }
                                  }
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit Item Dialog */}
          <Dialog open={editItemOpen} onOpenChange={setEditItemOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Inventory Item</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    placeholder="Brief description of the item"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                      value={itemForm.unit}
                      onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock Level</Label>
                    <Input
                      type="number"
                      value={itemForm.minStockLevel}
                      onChange={(e) => setItemForm({ ...itemForm, minStockLevel: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={itemForm.location}
                      onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategory</Label>
                    <Select
                      value={itemForm.subcategory}
                      onValueChange={(value) => setItemForm({ ...itemForm, subcategory: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                          <SelectItem key={cat._id} value={cat.value}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={itemForm.notes}
                      onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                    />
                  </div>
                  
                  {itemForm.type === "pre_processed" && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <ListTree className="h-4 w-4" />
                          Bill of Materials (BOM)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Define the raw materials required to create this pre-processed item
                        </p>
                        {itemForm.components.map((component, index) => (
                          <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                            <Select
                              value={component.rawMaterialId}
                              onValueChange={(value: any) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].rawMaterialId = value;
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select raw material" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory?.filter(item => item.type === "raw").map((rawItem) => (
                                  <SelectItem key={rawItem._id} value={rawItem._id}>
                                    {rawItem.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="Quantity"
                              value={component.quantityRequired}
                              onChange={(e) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].quantityRequired = Number(e.target.value);
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            />
                            <Input
                              placeholder="Unit"
                              value={component.unit}
                              onChange={(e) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].unit = e.target.value;
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newComponents = itemForm.components.filter((_, i) => i !== index);
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setItemForm({
                              ...itemForm,
                              components: [...itemForm.components, { rawMaterialId: "" as Id<"inventory">, quantityRequired: 0, unit: "" }],
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Component
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditItemOpen(false)}>Cancel</Button>
                <Button onClick={handleEditItem}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Vendor Info Dialog */}
          <Dialog open={vendorInfoOpen} onOpenChange={setVendorInfoOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Vendor Information</DialogTitle>
                <DialogDescription>
                  {selectedItemForVendors?.name && `Vendors supplying: ${selectedItemForVendors.name}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {getVendorsForItem === undefined ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : getVendorsForItem && getVendorsForItem.length > 0 ? (
                  <div className="space-y-3">
                    {getVendorsForItem.map((vendor: any) => {
                      const priceInfo = vendor.itemPrices?.find(
                        (p: any) => p.itemId === selectedItemForVendors?._id
                      );
                      return (
                        <Card key={vendor._id}>
                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-semibold text-lg">{vendor.name}</h3>
                                  {vendor.organization && (
                                    <p className="text-sm text-muted-foreground">{vendor.organization}</p>
                                  )}
                                </div>
                                {priceInfo && (
                                  <Badge variant="secondary" className="text-base">
                                    ₹{priceInfo.averagePrice.toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                              <Separator />
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {vendor.contactPerson && (
                                  <div>
                                    <span className="text-muted-foreground">Contact: </span>
                                    <span>{vendor.contactPerson}</span>
                                  </div>
                                )}
                                {vendor.phone && (
                                  <div>
                                    <span className="text-muted-foreground">Phone: </span>
                                    <span>{vendor.phone}</span>
                                  </div>
                                )}
                                {vendor.email && (
                                  <div>
                                    <span className="text-muted-foreground">Email: </span>
                                    <span>{vendor.email}</span>
                                  </div>
                                )}
                                {vendor.gstn && (
                                  <div>
                                    <span className="text-muted-foreground">GSTN: </span>
                                    <span>{vendor.gstn}</span>
                                  </div>
                                )}
                              </div>
                              {vendor.address && (
                                <>
                                  <Separator />
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Address: </span>
                                    <span>{vendor.address}</span>
                                  </div>
                                </>
                              )}
                              {!priceInfo && (
                                <div className="text-sm text-muted-foreground italic">
                                  No price information available
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No vendors associated with this item
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setVendorInfoOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View BOM Dialog */}
          <Dialog open={bomViewerOpen} onOpenChange={setBomViewerOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bill of Materials (BOM)</DialogTitle>
                <DialogDescription>
                  {selectedBomItem?.name && `Components required for: ${selectedBomItem.name}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Pre-Processed Item</Badge>
                  <span className="text-sm text-muted-foreground">
                    Raw materials required to create this item
                  </span>
                </div>
                <Separator />
                <div>
                  <Label className="text-base">Raw Materials</Label>
                  <div className="mt-4 space-y-3">
                    {selectedBomItem?.components?.map((component: any, index: number) => {
                      const rawMaterial = inventory?.find(item => item._id === component.rawMaterialId);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{rawMaterial?.name || "Unknown Material"}</p>
                            <p className="text-sm text-muted-foreground">
                              Type: {rawMaterial?.type === "raw" ? "Raw Material" : rawMaterial?.type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{component.quantityRequired} {component.unit}</p>
                            <p className="text-xs text-muted-foreground">per unit</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  This BOM defines the raw materials needed to produce one unit of this pre-processed item.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setBomViewerOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Packet Dialog */}
          <Dialog open={viewPacketOpen} onOpenChange={setViewPacketOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Packet Components</DialogTitle>
                <DialogDescription>
                  {selectedPacket?.sourceKit && `From kit: ${selectedPacket.sourceKit.name}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Sealed Packet</Badge>
                  <span className="text-sm text-muted-foreground">
                    This is a virtual item derived from kit definitions
                  </span>
                </div>
                <Separator />
                <div>
                  <Label className="text-base">Materials in Packet</Label>
                  <div className="mt-4 space-y-3">
                    {selectedPacket?.componentData?.materials?.map((material: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{material.name}</p>
                          {material.notes && (
                            <p className="text-sm text-muted-foreground">{material.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{material.quantity} {material.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  To modify this packet, edit the source kit in the Kits page.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setViewPacketOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </Layout>
  );
}