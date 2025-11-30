import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useBlocker } from "react-router";
import { Loader2, Save, ArrowLeft, Plus, Trash2, X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, stringifyPackingRequirements } from "@/lib/kitPacking";
import { cn } from "@/lib/utils";
import { QuickAddInventoryDialog } from "@/components/research/QuickAddInventoryDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function KitBuilder() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editKitId = searchParams.get("edit") as Id<"kits"> | null;
  const programIdFromUrl = searchParams.get("program") as Id<"programs"> | null;

  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const inventory = useQuery(api.inventory.list);
  const categories = useQuery(api.inventoryCategories.list, {});
  const editingKit = useQuery(api.kits.get, editKitId ? { id: editKitId } : "skip");
  const createKit = useMutation(api.kits.create);
  const updateKit = useMutation(api.kits.update);
  const createInventoryItem = useMutation(api.inventory.create);

  const [kitForm, setKitForm] = useState({
    name: "",
    programId: "" as Id<"programs">,
    serialNumber: "",
    conceptName: "",
    subject: "",
    category: "",
    description: "",
    isStructured: true,
    packingRequirements: "",
    spareKits: [] as Array<{ name: string; quantity: number; unit: string; subcategory?: string; notes?: string }>,
    bulkMaterials: [] as Array<{ name: string; quantity: number; unit: string; subcategory?: string; notes?: string }>,
    miscellaneous: [] as Array<{ name: string; quantity: number; unit: string; notes?: string }>,
  });
  const [didInitFromEdit, setDidInitFromEdit] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Quick add inventory dialog state
  const [quickAddInventoryOpen, setQuickAddInventoryOpen] = useState(false);
  const [quickAddContext, setQuickAddContext] = useState<{
    section: "pouch" | "packet" | "spare" | "bulk";
    pouchIdx?: number;
    packetIdx?: number;
    itemIdx?: number;
    defaultSubcategory?: string;
  } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (editingKit && !didInitFromEdit) {
      setKitForm({
        name: editingKit.name || "",
        programId: editingKit.programId || ("" as Id<"programs">),
        serialNumber: editingKit.serialNumber || "",
        conceptName: editingKit.conceptName || "",
        subject: editingKit.subject || "",
        category: editingKit.category || "",
        description: editingKit.description || "",
        isStructured: editingKit.isStructured ?? true,
        packingRequirements: editingKit.packingRequirements || "",
        spareKits: editingKit.spareKits || [],
        bulkMaterials: editingKit.bulkMaterials || [],
        miscellaneous: editingKit.miscellaneous || [],
      });
      setDidInitFromEdit(true);
    } else if (!editingKit && programIdFromUrl && !kitForm.programId) {
      setKitForm((prev) => ({ ...prev, programId: programIdFromUrl }));
    }
  }, [editingKit, programIdFromUrl, didInitFromEdit, kitForm.programId]);

  useEffect(() => {
    setDidInitFromEdit(false);
  }, [editKitId]);

  // Track form changes
  useEffect(() => {
    if (didInitFromEdit || kitForm.name) {
      setHasUnsavedChanges(true);
    }
  }, [kitForm, didInitFromEdit]);

  if (isLoading || !user || !programs || !kits || !inventory || !categories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const activePrograms = programs.filter((p) => p.status !== "archived");
  const selectedProgram = programs.find((p) => p._id === kitForm.programId);
  const structure = parsePackingRequirements(kitForm.packingRequirements);

  // Helper to get inventory items by subcategory
  const getInventoryBySubcategory = (subcategory: string) => {
    if (!subcategory) return [];
    return inventory.filter((item) => item.subcategory === subcategory);
  };

  const getInventoryItem = (name: string) => {
    return inventory.find((i) => i.name === name);
  };

  const handleQuickAddSuccess = () => {
    setQuickAddInventoryOpen(false);
  };

  const handleSave = async () => {
    if (!kitForm.name || !kitForm.programId) {
      toast.error("Please fill in required fields (Name, Program)");
      return;
    }

    try {
      if (editKitId) {
        await updateKit({
          id: editKitId,
          name: kitForm.name,
          serialNumber: kitForm.serialNumber || undefined,
          conceptName: kitForm.conceptName || undefined,
          subject: kitForm.subject || undefined,
          category: kitForm.category || undefined,
          description: kitForm.description || undefined,
          isStructured: kitForm.isStructured,
          packingRequirements: kitForm.packingRequirements || undefined,
          spareKits: kitForm.spareKits.filter(s => s.name && s.name.trim()).length > 0 ? kitForm.spareKits.filter(s => s.name && s.name.trim()) : undefined,
          bulkMaterials: kitForm.bulkMaterials.filter(b => b.name && b.name.trim()).length > 0 ? kitForm.bulkMaterials.filter(b => b.name && b.name.trim()) : undefined,
          miscellaneous: kitForm.miscellaneous.filter(m => m.name && m.name.trim()).length > 0 ? kitForm.miscellaneous.filter(m => m.name && m.name.trim()) : undefined,
        });
        toast.success("Kit updated successfully");
      } else {
        await createKit({
          ...kitForm,
          stockCount: 0,
          lowStockThreshold: 5,
        });
        toast.success("Kit created successfully");
      }
      setHasUnsavedChanges(false);
      navigate("/research");
    } catch (error) {
      toast.error("Failed to save kit");
      console.error("Save error:", error);
    }
  };

  const addPouch = () => {
    structure.pouches.push({ name: `Pouch ${structure.pouches.length + 1}`, materials: [] });
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const addPacket = () => {
    structure.packets.push({ name: `10.${structure.packets.length + 1}`, materials: [] });
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const removePouch = (index: number) => {
    structure.pouches.splice(index, 1);
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const removePacket = (index: number) => {
    structure.packets.splice(index, 1);
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const addMaterialToPouch = (pouchIdx: number) => {
    structure.pouches[pouchIdx].materials.push({ name: "", quantity: 1, unit: "pcs", subcategory: "" });
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const addMaterialToPacket = (packetIdx: number) => {
    structure.packets[packetIdx].materials.push({ name: "", quantity: 1, unit: "pcs", subcategory: "" });
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const removeMaterialFromPouch = (pouchIdx: number, matIdx: number) => {
    structure.pouches[pouchIdx].materials.splice(matIdx, 1);
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const removeMaterialFromPacket = (packetIdx: number, matIdx: number) => {
    structure.packets[packetIdx].materials.splice(matIdx, 1);
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const addSpareKit = () => {
    setKitForm({
      ...kitForm,
      spareKits: [...kitForm.spareKits, { name: "", quantity: 1, unit: "pcs", subcategory: "" }],
    });
  };

  const removeSpareKit = (index: number) => {
    setKitForm({
      ...kitForm,
      spareKits: kitForm.spareKits.filter((_, i) => i !== index),
    });
  };

  const addBulkMaterial = () => {
    setKitForm({
      ...kitForm,
      bulkMaterials: [...kitForm.bulkMaterials, { name: "", quantity: 1, unit: "pcs", subcategory: "" }],
    });
  };

  const removeBulkMaterial = (index: number) => {
    setKitForm({
      ...kitForm,
      bulkMaterials: kitForm.bulkMaterials.filter((_, i) => i !== index),
    });
  };

  const addMiscItem = () => {
    setKitForm({
      ...kitForm,
      miscellaneous: [...kitForm.miscellaneous, { name: "", quantity: 1, unit: "pcs" }],
    });
  };

  const removeMiscItem = (index: number) => {
    setKitForm({
      ...kitForm,
      miscellaneous: kitForm.miscellaneous.filter((_, i) => i !== index),
    });
  };

  const canEdit = hasPermission("kits", "edit");

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 dark:bg-neutral-900 min-h-screen">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/research")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{editKitId ? "Edit Kit Sheet" : "Create New Kit"}</h1>
                <p className="text-sm text-muted-foreground">Define your kit components with live preview</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/research")}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canEdit}>
                <Save className="mr-2 h-4 w-4" />
                {editKitId ? "Update Kit" : "Create Kit"}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Kit Preview (Collapsible) */}
            <Collapsible open={isPreviewOpen} onOpenChange={setIsPreviewOpen} className="w-full">
              <Card className="bg-white dark:bg-neutral-800">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Kit Preview</CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-9 p-0">
                        {isPreviewOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span className="sr-only">Toggle Preview</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pb-6">
                    <div>
                      <h3 className="font-bold text-xl mb-1">{kitForm.name || "Kit Name"}</h3>
                      <p className="text-sm text-muted-foreground">{kitForm.description || "Description about the kit"}</p>
                    </div>

                    <Separator />

                    {/* Main Pouch Items */}
                    {structure.pouches.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">
                          Main Pouch Items ({structure.pouches.reduce((acc, p) => acc + p.materials.length, 0)})
                        </h4>
                        {structure.pouches.map((pouch, idx) => (
                          <div key={idx} className="mb-3">
                            <p className="text-sm font-medium mb-1">{pouch.name}</p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                              {pouch.materials.map((mat, matIdx) => {
                                const desc = getInventoryItem(mat.name)?.description;
                                return (
                                  <li key={matIdx}>
                                    • {mat.subcategory ? `[${mat.subcategory}] ` : ""}{mat.name} {desc ? `(${desc})` : ""} - {mat.quantity} {mat.unit}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sealed Packets */}
                    {structure.packets.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Sealed Packets ({structure.packets.length})</h4>
                          {structure.packets.map((packet, idx) => (
                            <div key={idx} className="mb-3">
                              <p className="text-sm font-medium mb-1">{packet.name}</p>
                              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                {packet.materials.map((mat, matIdx) => {
                                  const desc = getInventoryItem(mat.name)?.description;
                                  return (
                                    <li key={matIdx}>
                                      • {mat.subcategory ? `[${mat.subcategory}] ` : ""}{mat.name} {desc ? `(${desc})` : ""} - {mat.quantity} {mat.unit}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Spare Materials */}
                    {kitForm.spareKits.filter(s => s.name && s.name.trim()).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Spare Materials ({kitForm.spareKits.filter(s => s.name && s.name.trim()).length})</h4>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            {kitForm.spareKits.filter(s => s.name && s.name.trim()).map((spare, idx) => {
                              const desc = getInventoryItem(spare.name)?.description;
                              return (
                                <li key={idx}>
                                  • {spare.subcategory ? `[${spare.subcategory}] ` : ""}{spare.name} {desc ? `(${desc})` : ""} - {spare.quantity} {spare.unit}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </>
                    )}

                    {/* Bulk Materials */}
                    {kitForm.bulkMaterials.filter(b => b.name && b.name.trim()).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Bulk Materials ({kitForm.bulkMaterials.filter(b => b.name && b.name.trim()).length})</h4>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            {kitForm.bulkMaterials.filter(b => b.name && b.name.trim()).map((bulk, idx) => {
                              const desc = getInventoryItem(bulk.name)?.description;
                              return (
                                <li key={idx}>
                                  • {bulk.subcategory ? `[${bulk.subcategory}] ` : ""}{bulk.name} {desc ? `(${desc})` : ""} - {bulk.quantity} {bulk.unit}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </>
                    )}

                    {/* Misc Materials */}
                    {kitForm.miscellaneous.filter(m => m.name && m.name.trim()).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Misc Materials ({kitForm.miscellaneous.filter(m => m.name && m.name.trim()).length})</h4>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            {kitForm.miscellaneous.filter(m => m.name && m.name.trim()).map((misc, idx) => (
                              <li key={idx}>
                                • {misc.name} - {misc.quantity} {misc.unit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Kit Name</Label>
                  <Input
                    value={kitForm.name}
                    onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })}
                    placeholder="e.g., Banjo Boy"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <Label>Kit Number</Label>
                  <Input
                    value={kitForm.serialNumber}
                    onChange={(e) => setKitForm({ ...kitForm, serialNumber: e.target.value })}
                    placeholder="e.g., T0"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <Label>Concept Name</Label>
                  <Input
                    value={kitForm.conceptName}
                    onChange={(e) => setKitForm({ ...kitForm, conceptName: e.target.value })}
                    placeholder="e.g., Sound"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <Label>Kit Type</Label>
                  <Select
                    value={kitForm.programId}
                    onValueChange={(value) => setKitForm({ ...kitForm, programId: value as Id<"programs"> })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePrograms.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category</Label>
                  {selectedProgram?.categories && selectedProgram.categories.length > 0 ? (
                    <Select
                      value={kitForm.category || "none"}
                      onValueChange={(value) => setKitForm({ ...kitForm, category: value === "none" ? "" : value })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {selectedProgram.categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={kitForm.category}
                      onChange={(e) => setKitForm({ ...kitForm, category: e.target.value })}
                      placeholder="e.g., Explorer test"
                      disabled={!canEdit}
                    />
                  )}
                </div>

                <div>
                  <Label>Subject</Label>
                  <Input
                    value={kitForm.subject}
                    onChange={(e) => setKitForm({ ...kitForm, subject: e.target.value })}
                    placeholder="e.g., Physics"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={kitForm.description}
                    onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })}
                    placeholder="Description about the kit"
                    rows={3}
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <Label>Kit Image</Label>
                  <div className="flex items-center gap-2">
                    <Input type="file" disabled={!canEdit} />
                    <span className="text-sm text-muted-foreground">No file chosen</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kit Components */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kit Components</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="main-pouch" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="main-pouch">Main Pouch</TabsTrigger>
                    <TabsTrigger value="sealed-packets">Sealed Packets</TabsTrigger>
                    <TabsTrigger value="spare">Spare Materials</TabsTrigger>
                    <TabsTrigger value="bulk">Bulk Materials</TabsTrigger>
                    <TabsTrigger value="misc">Misc Materials</TabsTrigger>
                  </TabsList>

                  {/* Main Pouch Tab */}
                  <TabsContent value="main-pouch" className="space-y-4 mt-4">
                    <Button size="sm" onClick={addPouch} disabled={!canEdit}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Main Pouch Item
                    </Button>
                    {structure.pouches.map((pouch, pouchIdx) => (
                      <div key={pouchIdx} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            value={pouch.name}
                            onChange={(e) => {
                              structure.pouches[pouchIdx].name = e.target.value;
                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                            }}
                            placeholder="Pouch name"
                            className="max-w-xs"
                            disabled={!canEdit}
                          />
                          <Button size="sm" variant="ghost" onClick={() => removePouch(pouchIdx)} disabled={!canEdit}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {pouch.materials.map((material, matIdx) => (
                          <div key={matIdx} className="border-l-2 border-muted pl-3 py-2">
                            <div className="flex items-center gap-2">
                              <Select
                                value={material.subcategory || ""}
                                onValueChange={(value) => {
                                  structure.pouches[pouchIdx].materials[matIdx].subcategory = value;
                                  setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                }}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="w-[20%]">
                                  <SelectValue placeholder="Subcategory" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                                    <SelectItem key={cat._id} value={cat.value}>
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    disabled={!canEdit || !material.subcategory}
                                    className="w-[25%] justify-between"
                                  >
                                    {material.name || "Select item"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Search inventory..." />
                                    <CommandList>
                                      <CommandEmpty>
                                        <div className="p-2 text-center">
                                          <p className="text-sm text-muted-foreground mb-2">No item found.</p>
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setQuickAddContext({ 
                                                section: "pouch", 
                                                pouchIdx, 
                                                itemIdx: matIdx,
                                                defaultSubcategory: material.subcategory || ""
                                              });
                                              setQuickAddInventoryOpen(true);
                                            }}
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add New Item
                                          </Button>
                                        </div>
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {getInventoryBySubcategory(material.subcategory || "").map((item) => (
                                          <CommandItem
                                            key={item._id}
                                            value={item.name}
                                            onSelect={() => {
                                              structure.pouches[pouchIdx].materials[matIdx].name = item.name;
                                              structure.pouches[pouchIdx].materials[matIdx].unit = item.unit;
                                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                material.name === item.name ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col items-start">
                                              <span>{item.name}</span>
                                              {item.description && (
                                                <span className="text-xs text-muted-foreground">{item.description}</span>
                                              )}
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <Input
                                value={getInventoryItem(material.name)?.description || ""}
                                placeholder="Description"
                                className="w-[25%] bg-muted/50"
                                readOnly
                                disabled
                              />
                              <Input
                                type="number"
                                value={material.quantity}
                                onChange={(e) => {
                                  structure.pouches[pouchIdx].materials[matIdx].quantity = parseFloat(e.target.value);
                                  setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                }}
                                className="w-[10%]"
                                disabled={!canEdit}
                              />
                              <Input
                                value={material.unit}
                                className="w-[10%]"
                                disabled
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeMaterialFromPouch(pouchIdx, matIdx)}
                                disabled={!canEdit}
                                className="w-[10%]"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addMaterialToPouch(pouchIdx)}
                          disabled={!canEdit}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Material
                        </Button>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Sealed Packets Tab */}
                  <TabsContent value="sealed-packets" className="space-y-4 mt-4">
                    <Button size="sm" onClick={addPacket} disabled={!canEdit}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Sealed Packet
                    </Button>
                    {structure.packets.map((packet, packetIdx) => (
                      <div key={packetIdx} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            value={packet.name}
                            onChange={(e) => {
                              structure.packets[packetIdx].name = e.target.value;
                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                            }}
                            placeholder="Packet name"
                            className="max-w-xs"
                            disabled={!canEdit}
                          />
                          <Button size="sm" variant="ghost" onClick={() => removePacket(packetIdx)} disabled={!canEdit}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {packet.materials.map((material, matIdx) => (
                          <div key={matIdx} className="border-l-2 border-muted pl-3 py-2">
                            <div className="flex items-center gap-2">
                              <Select
                                value={material.subcategory || ""}
                                onValueChange={(value) => {
                                  structure.packets[packetIdx].materials[matIdx].subcategory = value;
                                  setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                }}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="w-[20%]">
                                  <SelectValue placeholder="Subcategory" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                                    <SelectItem key={cat._id} value={cat.value}>
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    disabled={!canEdit || !material.subcategory}
                                    className="w-[25%] justify-between"
                                  >
                                    {material.name || "Select item"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Search inventory..." />
                                    <CommandList>
                                      <CommandEmpty>
                                        <div className="p-2 text-center">
                                          <p className="text-sm text-muted-foreground mb-2">No item found.</p>
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setQuickAddContext({ 
                                                section: "packet", 
                                                packetIdx, 
                                                itemIdx: matIdx,
                                                defaultSubcategory: material.subcategory || ""
                                              });
                                              setQuickAddInventoryOpen(true);
                                            }}
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add New Item
                                          </Button>
                                        </div>
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {getInventoryBySubcategory(material.subcategory || "").map((item) => (
                                          <CommandItem
                                            key={item._id}
                                            value={item.name}
                                            onSelect={() => {
                                              structure.packets[packetIdx].materials[matIdx].name = item.name;
                                              structure.packets[packetIdx].materials[matIdx].unit = item.unit;
                                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                material.name === item.name ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col items-start">
                                              <span>{item.name}</span>
                                              {item.description && (
                                                <span className="text-xs text-muted-foreground">{item.description}</span>
                                              )}
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <Input
                                value={getInventoryItem(material.name)?.description || ""}
                                placeholder="Description"
                                className="w-[25%] bg-muted/50"
                                readOnly
                                disabled
                              />
                              <Input
                                type="number"
                                value={material.quantity}
                                onChange={(e) => {
                                  structure.packets[packetIdx].materials[matIdx].quantity = parseFloat(e.target.value);
                                  setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                }}
                                className="w-[10%]"
                                disabled={!canEdit}
                              />
                              <Input
                                value={material.unit}
                                className="w-[10%]"
                                disabled
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeMaterialFromPacket(packetIdx, matIdx)}
                                disabled={!canEdit}
                                className="w-[10%]"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addMaterialToPacket(packetIdx)}
                          disabled={!canEdit}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Material
                        </Button>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Spare Materials Tab */}
                  <TabsContent value="spare" className="space-y-4 mt-4">
                    <Button size="sm" onClick={addSpareKit} disabled={!canEdit}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Spare Material
                    </Button>
                    {kitForm.spareKits.map((spare, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={spare.subcategory || ""}
                            onValueChange={(value) => {
                              const updated = [...kitForm.spareKits];
                              updated[idx].subcategory = value;
                              setKitForm({ ...kitForm, spareKits: updated });
                            }}
                            disabled={!canEdit}
                          >
                            <SelectTrigger className="w-[20%]">
                              <SelectValue placeholder="Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                                <SelectItem key={cat._id} value={cat.value}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                disabled={!canEdit || !spare.subcategory}
                                className="w-[25%] justify-between"
                              >
                                {spare.name || "Select item"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                              <Command>
                                <CommandInput placeholder="Search inventory..." />
                                <CommandList>
                                  <CommandEmpty>
                                    <div className="p-2 text-center">
                                      <p className="text-sm text-muted-foreground mb-2">No item found.</p>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setQuickAddContext({ 
                                            section: "spare", 
                                            itemIdx: idx,
                                            defaultSubcategory: spare.subcategory || ""
                                          });
                                          setQuickAddInventoryOpen(true);
                                        }}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add New Item
                                      </Button>
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {getInventoryBySubcategory(spare.subcategory || "").map((item) => (
                                      <CommandItem
                                        key={item._id}
                                        value={item.name}
                                        onSelect={() => {
                                          const updated = [...kitForm.spareKits];
                                          updated[idx].name = item.name;
                                          updated[idx].unit = item.unit;
                                          setKitForm({ ...kitForm, spareKits: updated });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            spare.name === item.name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col items-start">
                                          <span>{item.name}</span>
                                          {item.description && (
                                            <span className="text-xs text-muted-foreground">{item.description}</span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <Input
                            value={getInventoryItem(spare.name)?.description || ""}
                            placeholder="Description"
                            className="w-[25%] bg-muted/50"
                            readOnly
                            disabled
                          />
                          <Input
                            type="number"
                            value={spare.quantity}
                            onChange={(e) => {
                              const updated = [...kitForm.spareKits];
                              updated[idx].quantity = parseFloat(e.target.value);
                              setKitForm({ ...kitForm, spareKits: updated });
                            }}
                            className="w-[10%]"
                            disabled={!canEdit}
                          />
                          <Input
                            value={spare.unit}
                            className="w-[10%]"
                            disabled
                          />
                          <Button size="icon" variant="ghost" onClick={() => removeSpareKit(idx)} disabled={!canEdit} className="w-[10%]">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Bulk Materials Tab */}
                  <TabsContent value="bulk" className="space-y-4 mt-4">
                    <Button size="sm" onClick={addBulkMaterial} disabled={!canEdit}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Bulk Material
                    </Button>
                    {kitForm.bulkMaterials.map((bulk, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={bulk.subcategory || ""}
                            onValueChange={(value) => {
                              const updated = [...kitForm.bulkMaterials];
                              updated[idx].subcategory = value;
                              setKitForm({ ...kitForm, bulkMaterials: updated });
                            }}
                            disabled={!canEdit}
                          >
                            <SelectTrigger className="w-[20%]">
                              <SelectValue placeholder="Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                                <SelectItem key={cat._id} value={cat.value}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                disabled={!canEdit || !bulk.subcategory}
                                className="w-[25%] justify-between"
                              >
                                {bulk.name || "Select item"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                              <Command>
                                <CommandInput placeholder="Search inventory..." />
                                <CommandList>
                                  <CommandEmpty>
                                    <div className="p-2 text-center">
                                      <p className="text-sm text-muted-foreground mb-2">No item found.</p>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setQuickAddContext({ 
                                            section: "bulk", 
                                            itemIdx: idx,
                                            defaultSubcategory: bulk.subcategory || ""
                                          });
                                          setQuickAddInventoryOpen(true);
                                        }}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add New Item
                                      </Button>
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {getInventoryBySubcategory(bulk.subcategory || "").map((item) => (
                                      <CommandItem
                                        key={item._id}
                                        value={item.name}
                                        onSelect={() => {
                                          const updated = [...kitForm.bulkMaterials];
                                          updated[idx].name = item.name;
                                          updated[idx].unit = item.unit;
                                          setKitForm({ ...kitForm, bulkMaterials: updated });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            bulk.name === item.name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col items-start">
                                          <span>{item.name}</span>
                                          {item.description && (
                                            <span className="text-xs text-muted-foreground">{item.description}</span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <Input
                            value={getInventoryItem(bulk.name)?.description || ""}
                            placeholder="Description"
                            className="w-[25%] bg-muted/50"
                            readOnly
                            disabled
                          />
                          <Input
                            type="number"
                            value={bulk.quantity}
                            onChange={(e) => {
                              const updated = [...kitForm.bulkMaterials];
                              updated[idx].quantity = parseFloat(e.target.value);
                              setKitForm({ ...kitForm, bulkMaterials: updated });
                            }}
                            className="w-[10%]"
                            disabled={!canEdit}
                          />
                          <Input
                            value={bulk.unit}
                            className="w-[10%]"
                            disabled
                          />
                          <Button size="icon" variant="ghost" onClick={() => removeBulkMaterial(idx)} disabled={!canEdit} className="w-[10%]">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Misc Materials Tab */}
                  <TabsContent value="misc" className="space-y-4 mt-4">
                    <Button size="sm" onClick={addMiscItem} disabled={!canEdit}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Misc Material
                    </Button>
                    {kitForm.miscellaneous.map((misc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={misc.name}
                          onChange={(e) => {
                            const updated = [...kitForm.miscellaneous];
                            updated[idx].name = e.target.value;
                            setKitForm({ ...kitForm, miscellaneous: updated });
                          }}
                          placeholder="Material name"
                          className="flex-1"
                          disabled={!canEdit}
                        />
                        <Input
                          type="number"
                          value={misc.quantity}
                          onChange={(e) => {
                            const updated = [...kitForm.miscellaneous];
                            updated[idx].quantity = parseFloat(e.target.value);
                            setKitForm({ ...kitForm, miscellaneous: updated });
                          }}
                          className="w-20"
                          disabled={!canEdit}
                        />
                        <Input
                          value={misc.unit}
                          onChange={(e) => {
                            const updated = [...kitForm.miscellaneous];
                            updated[idx].unit = e.target.value;
                            setKitForm({ ...kitForm, miscellaneous: updated });
                          }}
                          className="w-20"
                          disabled={!canEdit}
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeMiscItem(idx)} disabled={!canEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </motion.div>
        
        <QuickAddInventoryDialog 
          open={quickAddInventoryOpen} 
          onOpenChange={setQuickAddInventoryOpen}
          defaultSubcategory={quickAddContext?.defaultSubcategory}
          onSuccess={handleQuickAddSuccess}
        />

        {/* Unsaved Changes Warning Dialog */}
        <Dialog open={blocker.state === "blocked"} onOpenChange={(open) => {
          if (!open && blocker.state === "blocked" && blocker.reset) {
            blocker.reset();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                You have unsaved changes in the kit builder. If you leave now, your changes will be lost. Would you like to proceed?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => blocker.reset?.()}>
                Stay on Page
              </Button>
              <Button variant="destructive" onClick={() => {
                setHasUnsavedChanges(false);
                blocker.proceed?.();
              }}>
                Leave Without Saving
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}