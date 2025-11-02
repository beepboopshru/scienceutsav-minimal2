import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2, Save, ArrowLeft, Plus, Trash2, GripVertical, Image as ImageIcon, FileText, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, stringifyPackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import { ResearchFileManager } from "@/components/research/ResearchFileManager";

export default function KitBuilder() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editKitId = searchParams.get("edit") as Id<"kits"> | null;

  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const inventory = useQuery(api.inventory.list);
  const editingKit = editKitId ? useQuery(api.kits.get, { id: editKitId }) : null;

  const createKit = useMutation(api.kits.create);
  const updateKit = useMutation(api.kits.update);

  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [currentFileType, setCurrentFileType] = useState<"image" | "laser" | "component" | "workbook">("image");

  const [kitForm, setKitForm] = useState({
    name: "",
    programId: "" as Id<"programs">,
    serialNumber: "",
    category: "",
    cstemVariant: undefined as "explorer" | "discoverer" | undefined,
    description: "",
    remarks: "",
    tags: [] as string[],
    notes: "",
    stockCount: 0,
    isStructured: true,
    packingRequirements: "",
    spareKits: [] as Array<{ name: string; quantity: number; unit: string; notes?: string }>,
    bulkMaterials: [] as Array<{ name: string; quantity: number; unit: string; notes?: string }>,
    miscellaneous: [] as Array<{ name: string; quantity: number; unit: string; notes?: string }>,
    components: [] as Array<{
      inventoryItemId: Id<"inventory">;
      quantityPerKit: number;
      unit: string;
      wastageNotes?: string;
      comments?: string;
    }>,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (editingKit) {
      setKitForm({
        name: editingKit.name || "",
        programId: editingKit.programId || ("" as Id<"programs">),
        serialNumber: editingKit.serialNumber || "",
        category: editingKit.category || "",
        cstemVariant: editingKit.cstemVariant,
        description: editingKit.description || "",
        remarks: editingKit.remarks || "",
        tags: editingKit.tags || [],
        notes: editingKit.notes || "",
        stockCount: editingKit.stockCount || 0,
        isStructured: editingKit.isStructured || true,
        packingRequirements: editingKit.packingRequirements || "",
        spareKits: editingKit.spareKits || [],
        bulkMaterials: editingKit.bulkMaterials || [],
        miscellaneous: editingKit.miscellaneous || [],
        components: editingKit.components || [],
      });
    }
  }, [editingKit]);

  if (isLoading || !user || !programs || !kits || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const activePrograms = programs.filter((p) => p.status !== "archived");
  const selectedProgram = programs.find((p) => p._id === kitForm.programId);
  const structure = parsePackingRequirements(kitForm.packingRequirements);

  const calculateEstimatedCost = () => {
    const materials = calculateTotalMaterials(structure);
    let total = 0;
    materials.forEach((material) => {
      const item = inventory.find((i) => i.name === material.name);
      if (item) {
        total += material.quantity * 10; // Placeholder pricing
      }
    });
    return total;
  };

  const calculateBuildableUnits = () => {
    const materials = calculateTotalMaterials(structure);
    if (materials.length === 0) return 0;
    let min = Infinity;
    materials.forEach((material) => {
      const item = inventory.find((i) => i.name === material.name);
      if (item && material.quantity > 0) {
        const buildable = Math.floor(item.quantity / material.quantity);
        min = Math.min(min, buildable);
      }
    });
    return min === Infinity ? 0 : min;
  };

  const getShortages = () => {
    const materials = calculateTotalMaterials(structure);
    const shortages: Array<{ name: string; required: number; available: number }> = [];
    materials.forEach((material) => {
      const item = inventory.find((i) => i.name === material.name);
      if (!item || item.quantity < material.quantity) {
        shortages.push({
          name: material.name,
          required: material.quantity,
          available: item?.quantity || 0,
        });
      }
    });
    return shortages;
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
          ...kitForm,
        });
        toast.success("Kit updated successfully");
      } else {
        await createKit({
          ...kitForm,
          stockCount: kitForm.stockCount || 0,
        });
        toast.success("Kit created successfully");
      }
      navigate("/research");
    } catch (error) {
      toast.error("Failed to save kit");
    }
  };

  const addPouch = () => {
    structure.pouches.push({ name: "New Pouch", materials: [] });
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const addPacket = () => {
    structure.packets.push({ name: "New Packet", materials: [] });
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
    structure.pouches[pouchIdx].materials.push({ name: "", quantity: 1, unit: "pcs" });
    setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
  };

  const addMaterialToPacket = (packetIdx: number) => {
    structure.packets[packetIdx].materials.push({ name: "", quantity: 1, unit: "pcs" });
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

  const openFileManager = (type: "image" | "laser" | "component" | "workbook") => {
    setCurrentFileType(type);
    setFileManagerOpen(true);
  };

  const handlePreviewSheet = () => {
    navigate(`/kit-sheet-maker?kit=${editKitId || ""}`);
  };

  const estimatedCost = calculateEstimatedCost();
  const buildableUnits = calculateBuildableUnits();
  const shortages = getShortages();

  const canEdit = user.role === "admin" || user.role === "research_development";

  return (
    <Layout>
      <div className="p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/research")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{editKitId ? "Edit Kit" : "Create New Kit"}</h1>
                <p className="text-muted-foreground">Define kit specifications and bill of materials</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreviewSheet} disabled={!editKitId}>
                <Printer className="mr-2 h-4 w-4" />
                Preview Sheet
              </Button>
              <Button onClick={handleSave} disabled={!canEdit}>
                <Save className="mr-2 h-4 w-4" />
                {editKitId ? "Update Kit" : "Create Kit"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Kit Name *</Label>
                      <Input
                        value={kitForm.name}
                        onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })}
                        placeholder="e.g., Electric Circuit Kit"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <Label>Program *</Label>
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Serial Number</Label>
                      <Input
                        value={kitForm.serialNumber}
                        onChange={(e) => setKitForm({ ...kitForm, serialNumber: e.target.value })}
                        placeholder="Optional"
                        disabled={!canEdit}
                      />
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
                          placeholder="e.g., Physics"
                          disabled={!canEdit}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={kitForm.description}
                      onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })}
                      placeholder="Brief overview of the kit"
                      rows={3}
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label>Remarks (Internal Notes)</Label>
                    <Textarea
                      value={kitForm.remarks}
                      onChange={(e) => setKitForm({ ...kitForm, remarks: e.target.value })}
                      placeholder="Internal notes, version history, etc."
                      rows={2}
                      disabled={!canEdit}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* BOM Workspace */}
              <Card>
                <CardHeader>
                  <CardTitle>Bill of Materials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pouches */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label className="text-base">Pouches</Label>
                        <p className="text-sm text-muted-foreground">Containers assembled during packing</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addPouch} disabled={!canEdit}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Pouch
                      </Button>
                    </div>
                    {structure.pouches.map((pouch, pouchIdx) => (
                      <Card key={pouchIdx} className="mb-4">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removePouch(pouchIdx)} disabled={!canEdit}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>Qty/Kit</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pouch.materials.map((material, matIdx) => (
                                <TableRow key={matIdx}>
                                  <TableCell>
                                    <Select
                                      value={material.name}
                                      onValueChange={(value) => {
                                        structure.pouches[pouchIdx].materials[matIdx].name = value;
                                        const item = inventory.find((i) => i.name === value);
                                        if (item) {
                                          structure.pouches[pouchIdx].materials[matIdx].unit = item.unit;
                                        }
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      disabled={!canEdit}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {inventory.map((item) => (
                                          <SelectItem key={item._id} value={item.name}>
                                            {item.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={material.quantity}
                                      onChange={(e) => {
                                        structure.pouches[pouchIdx].materials[matIdx].quantity = parseFloat(e.target.value);
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      className="w-20"
                                      disabled={!canEdit}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={material.unit}
                                      onChange={(e) => {
                                        structure.pouches[pouchIdx].materials[matIdx].unit = e.target.value;
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      className="w-20"
                                      disabled={!canEdit}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={material.notes || ""}
                                      onChange={(e) => {
                                        structure.pouches[pouchIdx].materials[matIdx].notes = e.target.value;
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      placeholder="Optional"
                                      disabled={!canEdit}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeMaterialFromPouch(pouchIdx, matIdx)}
                                      disabled={!canEdit}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => addMaterialToPouch(pouchIdx)}
                            disabled={!canEdit}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Material
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Packets */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label className="text-base">Packets (Pre-sealed)</Label>
                        <p className="text-sm text-muted-foreground">Pre-sealed bundles prepared ahead</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addPacket} disabled={!canEdit}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Packet
                      </Button>
                    </div>
                    {structure.packets.map((packet, packetIdx) => (
                      <Card key={packetIdx} className="mb-4 border-blue-200">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removePacket(packetIdx)} disabled={!canEdit}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>Qty/Kit</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {packet.materials.map((material, matIdx) => (
                                <TableRow key={matIdx}>
                                  <TableCell>
                                    <Select
                                      value={material.name}
                                      onValueChange={(value) => {
                                        structure.packets[packetIdx].materials[matIdx].name = value;
                                        const item = inventory.find((i) => i.name === value);
                                        if (item) {
                                          structure.packets[packetIdx].materials[matIdx].unit = item.unit;
                                        }
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      disabled={!canEdit}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {inventory.map((item) => (
                                          <SelectItem key={item._id} value={item.name}>
                                            {item.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={material.quantity}
                                      onChange={(e) => {
                                        structure.packets[packetIdx].materials[matIdx].quantity = parseFloat(e.target.value);
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      className="w-20"
                                      disabled={!canEdit}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={material.unit}
                                      onChange={(e) => {
                                        structure.packets[packetIdx].materials[matIdx].unit = e.target.value;
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      className="w-20"
                                      disabled={!canEdit}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={material.notes || ""}
                                      onChange={(e) => {
                                        structure.packets[packetIdx].materials[matIdx].notes = e.target.value;
                                        setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                      }}
                                      placeholder="Optional"
                                      disabled={!canEdit}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeMaterialFromPacket(packetIdx, matIdx)}
                                      disabled={!canEdit}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => addMaterialToPacket(packetIdx)}
                            disabled={!canEdit}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Material
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Assembly Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Assembly Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={kitForm.notes}
                    onChange={(e) => setKitForm({ ...kitForm, notes: e.target.value })}
                    placeholder="Special instructions, assembly tips, handling notes..."
                    rows={4}
                    disabled={!canEdit}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Live Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Live Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Estimated Cost</Label>
                    <p className="text-2xl font-bold">₹{estimatedCost.toFixed(2)}</p>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-sm text-muted-foreground">Buildable Units</Label>
                    <p className="text-2xl font-bold">{buildableUnits}</p>
                  </div>
                  {shortages.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-sm text-muted-foreground mb-2">Shortages</Label>
                        <div className="space-y-2">
                          {shortages.map((shortage, idx) => (
                            <div key={idx} className="text-xs">
                              <Badge variant="destructive" className="mb-1">
                                {shortage.name}
                              </Badge>
                              <p className="text-muted-foreground">
                                Need: {shortage.required} | Have: {shortage.available}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Media & Files */}
              <Card>
                <CardHeader>
                  <CardTitle>Media & Files</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openFileManager("image")}
                    disabled={!editKitId}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Kit Images
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openFileManager("laser")}
                    disabled={!editKitId}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Laser Files
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openFileManager("component")}
                    disabled={!editKitId}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Component Pictures
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openFileManager("workbook")}
                    disabled={!editKitId}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Workbooks & Misc
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>

      {/* File Manager Modal */}
      {editKitId && (
        <ResearchFileManager
          kitId={editKitId}
          fileType={currentFileType}
          open={fileManagerOpen}
          onOpenChange={setFileManagerOpen}
          currentFiles={editingKit?.images || []}
          currentFileIds={editingKit?.fileIds || []}
        />
      )}
    </Layout>
  );
}
