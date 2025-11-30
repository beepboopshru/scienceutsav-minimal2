import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState, useMemo } from "react";
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
  Eye,
  Check,
  ChevronsUpDown,
  PlusCircle,
  MinusCircle
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Inventory() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  
  const canView = hasPermission("inventory", "view");
  const canEdit = hasPermission("inventory", "edit");
  const canEditBOM = hasPermission("inventory", "editBOM");
  
  const inventory = useQuery(api.inventory.list);
  const categories = useQuery(api.inventoryCategories.list, {});
  const vendors = useQuery(api.vendors.list);
  const kits = useQuery(api.kits.list);
  const programs = useQuery(api.programs.list);
  
  const createItem = useMutation(api.inventory.create);
  const updateItem = useMutation(api.inventory.update);
  const updateQuantity = useMutation(api.inventory.updateQuantity);
  const removeItem = useMutation(api.inventory.remove);
  const createCategory = useMutation(api.inventoryCategories.create);
  const removeCategory = useMutation(api.inventoryCategories.remove);
  const createVendorImport = useMutation(api.vendorImports.create);
  const updateKit = useMutation(api.kits.update);
  const generateUploadUrl = useMutation(api.vendorImports.generateUploadUrl);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const adjustKitStock = useMutation(api.kits.adjustStock);
  const updateKitStockCount = useMutation(api.kits.updateStockCount);

  const [activeTab, setActiveTab] = useState<"raw" | "pre_processed" | "finished" | "sealed_packet">("raw");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("all");
  const [editingQuantity, setEditingQuantity] = useState<Id<"inventory"> | string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const [vendorInfoOpen, setVendorInfoOpen] = useState(false);
  const [selectedItemForVendors, setSelectedItemForVendors] = useState<any>(null);
  const [bomViewerOpen, setBomViewerOpen] = useState(false);
  const [selectedBomItem, setSelectedBomItem] = useState<any>(null);

  // Dialog states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<any>(null);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [billImportOpen, setBillImportOpen] = useState(false);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);

  const getVendorsForItem = useQuery(
    api.vendors.getVendorsForItem,
    selectedItemForVendors
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
    billImageFile: null as File | null,
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    value: "",
    categoryType: "raw_material" as "raw_material" | "pre_processed",
  });

  // Combine real inventory with virtual packets
  const combinedInventory = useMemo(() => {
    return inventory || [];
  }, [inventory]);

  // Filter inventory based on active tab
  const filteredInventory = useMemo(() => {
    if (activeTab === "finished") {
      // For finished tab, show kits instead of inventory items
      if (!kits) return [];
      return kits.filter((kit) => {
        const matchesSearch = searchTerm.trim() === "" || kit.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProgram = filterSubcategory === "all" || kit.programId === filterSubcategory;
        return matchesSearch && matchesProgram;
      });
    } else {
      // For other tabs, show inventory items
      return combinedInventory.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = item.type === activeTab;
        const matchesSubcategory = filterSubcategory === "all" || item.subcategory === filterSubcategory;
        return matchesSearch && matchesType && matchesSubcategory;
      });
    }
  }, [activeTab, kits, combinedInventory, searchTerm, filterSubcategory]);

  // Get unique subcategories for current tab
  const availableSubcategories = useMemo(() => {
    if (activeTab === "finished") {
      if (!kits) return [];
      return Array.from(new Set(kits.map(k => k.programId).filter(Boolean)));
    }
    return Array.from(
      new Set(
        combinedInventory
          .filter((item) => item.type === activeTab)
          .map((item) => item.subcategory)
          .filter((subcat): subcat is string => typeof subcat === "string" && subcat.trim() !== "")
      )
    );
  }, [activeTab, combinedInventory, kits]);

  // Reset filters when tab changes
  useEffect(() => {
    setSearchTerm("");
    setFilterSubcategory("all");
  }, [activeTab]);

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

  if (!canView) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

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
    setTempQuantity(activeTab === "finished" ? item.stockCount : item.quantity);
  };

  const handleQuantitySave = async (itemId: Id<"inventory"> | string, item: any) => {
    try {
      if (activeTab === "finished") {
        // For kits
        await updateKitStockCount({ id: itemId as Id<"kits">, stockCount: tempQuantity });
      } else {
        // For inventory items
        await updateQuantity({ id: itemId as Id<"inventory">, quantity: tempQuantity });
      }
      toast.success("Quantity updated");
      setEditingQuantity(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update quantity");
    }
  };

  const handleBillImport = async () => {
    try {
      let billImageId: Id<"_storage"> | undefined = undefined;

      // Upload bill image if provided
      if (billForm.billImageFile) {
        // Convert image to WebP
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(billForm.billImageFile!);
        });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        // Convert to WebP blob
        const webpBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.9);
        });

        // Generate upload URL from Convex mutation
        const uploadUrl = await generateUploadUrl({});

        // Upload the WebP image to the generated URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: webpBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload bill image');
        }

        const { storageId } = await uploadResponse.json();
        billImageId = storageId;
      }

      const totalAmount = billForm.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      
      await createVendorImport({
        vendorId: billForm.vendorId,
        billNumber: billForm.billNumber,
        billDate: billForm.billDate,
        items: billForm.items,
        totalAmount,
        billImageId,
      });
      
      toast.success("Bill imported successfully");
      setBillImportOpen(false);
      setBillForm({
        vendorId: "" as Id<"vendors">,
        billNumber: "",
        billDate: new Date().toISOString().split('T')[0],
        items: [{ inventoryId: "" as Id<"inventory">, quantity: 0, unitPrice: 0 }],
        billImageFile: null,
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

  const handleDelete = async (id: Id<"inventory">) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const result = await removeItem({ id });
      if (result && 'requestCreated' in result && result.requestCreated) {
        toast.success("Deletion request submitted for admin approval");
      } else {
        toast.success("Item deleted successfully");
      }
      setSelectedItem(null);
    } catch (error) {
      toast.error("Failed to delete item");
    }
  };

  const handleOpenAdjustStock = (item: any, type: "add" | "subtract") => {
    setSelectedAdjustItem(item);
    setAdjustmentType(type);
    setAdjustmentAmount(0);
    setAdjustStockOpen(true);
  };

  const handleAdjustStock = async () => {
    if (!selectedAdjustItem || adjustmentAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const adjustment = adjustmentType === "add" ? adjustmentAmount : -adjustmentAmount;
      if (activeTab === "finished") {
        // For kits
        await adjustKitStock({ id: selectedAdjustItem._id, adjustment });
      } else {
        // For inventory items
        await adjustStock({ id: selectedAdjustItem._id, adjustment });
      }
      toast.success(`Stock ${adjustmentType === "add" ? "added" : "subtracted"} successfully`);
      setAdjustStockOpen(false);
      setSelectedAdjustItem(null);
      setAdjustmentAmount(0);
    } catch (error: any) {
      toast.error(error.message || "Failed to adjust stock");
    }
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
                Pre-Processing Jobs
              </Button>
              <Button onClick={() => navigate("/inventory/bill-records")} variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Bill Records
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Item
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
                          <SelectItem value="finished">Ready Made</SelectItem>
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
                  
                  {itemForm.type === "pre_processed" && canEditBOM && (
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
                              disabled={!canEditBOM}
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
                              disabled={!canEditBOM}
                              onChange={(e) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].quantityRequired = Number(e.target.value);
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            />
                            <Input
                              placeholder="Unit"
                              value={component.unit}
                              disabled={!canEditBOM}
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
                          disabled={!canEditBOM}
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
                  <Button onClick={handleAddItem}>Create Item</Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            )}

            {canEdit && (
              <Dialog open={billImportOpen} onOpenChange={setBillImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Bill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Vendor Bill</DialogTitle>
                  <DialogDescription>Record a purchase from a vendor</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !billForm.vendorId && "text-muted-foreground"
                            )}
                          >
                            {billForm.vendorId
                              ? vendors?.find((vendor) => vendor._id === billForm.vendorId)?.name
                              : "Select vendor"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search vendor..." />
                            <CommandList>
                              <CommandEmpty>No vendor found.</CommandEmpty>
                              <CommandGroup>
                                {vendors?.map((vendor) => (
                                  <CommandItem
                                    key={vendor._id}
                                    value={vendor.name}
                                    onSelect={() => {
                                      setBillForm({ ...billForm, vendorId: vendor._id });
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        billForm.vendorId === vendor._id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {vendor.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                  <div className="space-y-2">
                    <Label>Bill Image</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setBillForm({ ...billForm, billImageFile: file });
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload an image of the bill (any format, will be stored as WebP)
                    </p>
                    {billForm.billImageFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {billForm.billImageFile.name}
                      </div>
                    )}
                  </div>
                  <Separator />
                  <Label>Items</Label>
                  {billForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-start">
                      <div className="space-y-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !item.inventoryId && "text-muted-foreground"
                              )}
                            >
                              {item.inventoryId
                                ? inventory?.find((invItem) => invItem._id === item.inventoryId)?.name
                                : "Select item"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Search item..." />
                              <CommandList>
                                <CommandEmpty>No item found.</CommandEmpty>
                                <CommandGroup>
                                  {inventory?.map((invItem) => (
                                    <CommandItem
                                      key={invItem._id}
                                      value={invItem.name}
                                      onSelect={() => {
                                        const newItems = [...billForm.items];
                                        newItems[index].inventoryId = invItem._id;
                                        setBillForm({ ...billForm, items: newItems });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.inventoryId === invItem._id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {invItem.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
            )}

            {canEdit && (
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
                    <Input
                      placeholder="Category Name (e.g., Electronics)"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    />
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
            )}
          </div>

          {/* Tabbed Inventory View */}
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="raw">Raw Materials</TabsTrigger>
              <TabsTrigger value="pre_processed">Pre-Processed</TabsTrigger>
              <TabsTrigger value="sealed_packet">Sealed Packets</TabsTrigger>
              <TabsTrigger value="finished">Ready Made</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Label>Subcategory</Label>
                      <Select value={filterSubcategory} onValueChange={setFilterSubcategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Subcategories</SelectItem>
                          {availableSubcategories.filter(Boolean).map((subcat) => (
                            <SelectItem key={subcat} value={subcat}>
                              {activeTab === "finished" 
                                ? programs?.find(p => p._id === subcat)?.name || subcat
                                : categories?.find(cat => cat.value === subcat)?.name || subcat}
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
                  <CardTitle>
                    {activeTab === "raw" && "Raw Materials"}
                    {activeTab === "pre_processed" && "Pre-Processed Items"}
                    {activeTab === "finished" && "Ready Made Goods"}
                    {activeTab === "sealed_packet" && "Sealed Packets"}
                    {" "}({filteredInventory.length})
                  </CardTitle>
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
                  {filteredInventory.map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-2">
                            {item.type === "pre_processed" && item.components && item.components.length > 0 && (
                              <ListTree className="h-4 w-4 text-blue-500" />
                            )}
                            {item.name}
                          </div>
                          {activeTab !== "finished" && item.description && (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {activeTab === "finished" 
                            ? "Ready Made Kits"
                            : item.type === "raw" ? "Raw" : item.type === "pre_processed" ? "Pre-Processed" : item.type === "finished" ? "Ready Made" : "Sealed Packet"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.subcategory 
                          ? categories?.find(cat => cat.value === item.subcategory)?.name || item.subcategory
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {editingQuantity === item._id && canEdit ? (
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
                            className={canEdit ? "cursor-pointer hover:underline" : ""}
                            onClick={canEdit ? () => handleQuantityEdit(item) : undefined}
                            title={canEdit ? "Click to edit quantity" : ""}
                          >
                            {activeTab === "finished" ? item.stockCount : item.quantity}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.location || "-"}</TableCell>
                      <TableCell>
                        {activeTab === "finished" ? (
                          item.lowStockThreshold && item.stockCount <= item.lowStockThreshold ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In Stock</Badge>
                          )
                        ) : (
                          item.minStockLevel && item.quantity <= item.minStockLevel ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In Stock</Badge>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        {item.type !== "pre_processed" && (
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
                              {canEdit && (
                                <>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleOpenAdjustStock(item, "add")}
                                    title="Add Stock"
                                  >
                                    <PlusCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleOpenAdjustStock(item, "subtract")}
                                    title="Subtract Stock"
                                  >
                                    <MinusCircle className="h-4 w-4 text-red-600" />
                                  </Button>
                                  {activeTab !== "finished" && (
                                    <>
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
                                </>
                              )}
                            </>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>

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
                        <SelectItem value="finished">Ready Made</SelectItem>
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
                  
                  {itemForm.type === "pre_processed" && canEditBOM && (
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
                              disabled={!canEditBOM}
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
                              disabled={!canEditBOM}
                              onChange={(e) => {
                                const newComponents = [...itemForm.components];
                                newComponents[index].quantityRequired = Number(e.target.value);
                                setItemForm({ ...itemForm, components: newComponents });
                              }}
                            />
                            <Input
                              placeholder="Unit"
                              value={component.unit}
                              disabled={!canEditBOM}
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
                          disabled={!canEditBOM}
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

          {/* Adjust Stock Dialog */}
          <Dialog open={adjustStockOpen} onOpenChange={setAdjustStockOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {adjustmentType === "add" ? "Add Stock" : "Subtract Stock"}
                </DialogTitle>
                <DialogDescription>
                  {adjustmentType === "add" 
                    ? `Add stock to: ${selectedAdjustItem?.name}` 
                    : `Subtract stock from: ${selectedAdjustItem?.name}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Current Quantity</Label>
                  <div className="text-2xl font-bold">
                    {activeTab === "finished" ? selectedAdjustItem?.stockCount : selectedAdjustItem?.quantity} {selectedAdjustItem?.unit}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount to {adjustmentType === "add" ? "Add" : "Subtract"}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                    placeholder={`Enter amount in ${selectedAdjustItem?.unit}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Quantity</Label>
                  <div className="text-xl font-semibold text-muted-foreground">
                    {adjustmentType === "add" 
                      ? (activeTab === "finished" ? selectedAdjustItem?.stockCount : selectedAdjustItem?.quantity || 0) + adjustmentAmount
                      : Math.max(0, (activeTab === "finished" ? selectedAdjustItem?.stockCount : selectedAdjustItem?.quantity || 0) - adjustmentAmount)
                    } {selectedAdjustItem?.unit}
                  </div>
                </div>
                {adjustmentType === "subtract" && adjustmentAmount > (activeTab === "finished" ? selectedAdjustItem?.stockCount : selectedAdjustItem?.quantity || 0) && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Warning: This will result in negative stock (will be set to 0)
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdjustStockOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleAdjustStock}
                  variant={adjustmentType === "add" ? "default" : "destructive"}
                >
                  {adjustmentType === "add" ? "Add Stock" : "Subtract Stock"}
                </Button>
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
        </motion.div>
      </div>
    </Layout>
  );
}