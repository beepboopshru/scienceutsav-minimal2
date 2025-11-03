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
  Package,
  FileText,
  Settings,
  Info,
  Scissors,
  Upload,
  Trash2
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
  const services = useQuery(api.services.list);
  const kits = useQuery(api.kits.list);
  
  const createItem = useMutation(api.inventory.create);
  const updateItem = useMutation(api.inventory.update);
  const updateQuantity = useMutation(api.inventory.updateQuantity);
  const removeItem = useMutation(api.inventory.remove);
  const createCategory = useMutation(api.inventoryCategories.create);
  const removeCategory = useMutation(api.inventoryCategories.remove);
  const createProcessingJob = useMutation(api.processingJobs.create);
  const createVendorImport = useMutation(api.vendorImports.create);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("all");
  const [editingQuantity, setEditingQuantity] = useState<Id<"inventory"> | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);

  // Dialog states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [preProcessingOpen, setPreProcessingOpen] = useState(false);
  const [billImportOpen, setBillImportOpen] = useState(false);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [vendorInfoOpen, setVendorInfoOpen] = useState(false);
  const [bomViewerOpen, setBomViewerOpen] = useState(false);

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

  // Filter inventory
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesSubcategory = filterSubcategory === "all" || item.subcategory === filterSubcategory;
    return matchesSearch && matchesType && matchesSubcategory;
  });

  // Get unique subcategories for current type filter
  const availableSubcategories = Array.from(
    new Set(
      inventory
        .filter((item) => filterType === "all" || item.type === filterType)
        .map((item) => item.subcategory)
        .filter((subcat): subcat is string => typeof subcat === "string" && subcat.trim() !== "")
    )
  );

  const handleAddItem = async () => {
    try {
      await createItem(itemForm);
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
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to add item");
    }
  };

  const handleEditItem = async () => {
    if (!selectedItem) return;
    try {
      await updateItem({ id: selectedItem._id, ...itemForm });
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

  const handleQuantitySave = async (itemId: Id<"inventory">) => {
    try {
      await updateQuantity({ id: itemId, quantity: tempQuantity });
      toast.success("Quantity updated");
      setEditingQuantity(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update quantity");
    }
  };

  const handleCreateProcessingJob = async () => {
    try {
      const jobData: any = {
        name: processingForm.name,
        sourceItemId: processingForm.sourceItemId,
        sourceQuantity: processingForm.sourceQuantity,
        targets: processingForm.targets,
      };
      
      if (processingForm.processedBy) {
        jobData.processedBy = processingForm.processedBy;
      }
      if (processingForm.processedByType) {
        jobData.processedByType = processingForm.processedByType;
      }
      if (processingForm.notes) {
        jobData.notes = processingForm.notes;
      }
      
      await createProcessingJob(jobData);
      toast.success("Processing job created");
      setPreProcessingOpen(false);
      navigate("/inventory/processing-jobs");
    } catch (error: any) {
      toast.error(error.message || "Failed to create processing job");
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
    });
    setEditItemOpen(true);
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
                <Scissors className="mr-2 h-4 w-4" />
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
              <DialogContent className="max-w-2xl">
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddItem}>Add Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={preProcessingOpen} onOpenChange={setPreProcessingOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Scissors className="mr-2 h-4 w-4" />
                  Start Pre-Processing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Processing Job</DialogTitle>
                  <DialogDescription>Transform raw materials into pre-processed items</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Job Name</Label>
                    <Input
                      value={processingForm.name}
                      onChange={(e) => setProcessingForm({ ...processingForm, name: e.target.value })}
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Source Material</Label>
                      <Select
                        value={processingForm.sourceItemId}
                        onValueChange={(value: any) => setProcessingForm({ ...processingForm, sourceItemId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory?.filter((item) => item.type === "raw").map((item) => (
                            <SelectItem key={item._id} value={item._id}>
                              {item.name} ({item.quantity} {item.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Source Quantity</Label>
                      <Input
                        type="number"
                        value={processingForm.sourceQuantity}
                        onChange={(e) => setProcessingForm({ ...processingForm, sourceQuantity: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Separator />
                  <Label>Target Items</Label>
                  {processingForm.targets.map((target, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Select
                          value={target.targetItemId}
                          onValueChange={(value: any) => {
                            const newTargets = [...processingForm.targets];
                            newTargets[index].targetItemId = value;
                            setProcessingForm({ ...processingForm, targets: newTargets });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select target" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventory?.filter((item) => item.type === "pre_processed").map((item) => (
                              <SelectItem key={item._id} value={item._id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="Quantity"
                          value={target.targetQuantity}
                          onChange={(e) => {
                            const newTargets = [...processingForm.targets];
                            newTargets[index].targetQuantity = Number(e.target.value);
                            setProcessingForm({ ...processingForm, targets: newTargets });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setProcessingForm({
                        ...processingForm,
                        targets: [...processingForm.targets, { targetItemId: "" as Id<"inventory">, targetQuantity: 0 }],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Target
                  </Button>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Processed By Type</Label>
                      <Select
                        value={processingForm.processedByType}
                        onValueChange={(value: any) => setProcessingForm({ ...processingForm, processedByType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_house">In-House</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {processingForm.processedByType !== "in_house" && (
                      <div className="space-y-2">
                        <Label>Select {processingForm.processedByType === "vendor" ? "Vendor" : "Service"}</Label>
                        <Select
                          value={processingForm.processedBy}
                          onValueChange={(value) => setProcessingForm({ ...processingForm, processedBy: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${processingForm.processedByType}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(processingForm.processedByType === "vendor" ? vendors : services)?.map((item) => (
                              <SelectItem key={item._id} value={item._id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={processingForm.notes}
                      onChange={(e) => setProcessingForm({ ...processingForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPreProcessingOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateProcessingJob}>Create Job</Button>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{item.name}</div>
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
                            <Button size="sm" onClick={() => handleQuantitySave(item._id)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => handleQuantityEdit(item)}
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
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(item)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
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
                          >
                            Delete
                          </Button>
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
            <DialogContent className="max-w-2xl">
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditItemOpen(false)}>Cancel</Button>
                <Button onClick={handleEditItem}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </Layout>
  );
}