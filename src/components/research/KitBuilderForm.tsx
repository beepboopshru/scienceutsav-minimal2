import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Box, ArrowLeft, Save } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, stringifyPackingRequirements } from "@/lib/kitPacking";

interface KitBuilderFormProps {
  programs: Array<{ 
    _id: Id<"programs">; 
    name: string; 
    status?: string;
    categories?: string[];
    usesVariants?: boolean;
  }>;
  inventory: Array<{ _id: Id<"inventory">; name: string; quantity: number }>;
  editingKit?: {
    _id: Id<"kits">;
    name: string;
    programId: Id<"programs">;
    serialNumber?: string;
    category?: string;
    cstemVariant?: "explorer" | "discoverer";
    description?: string;
    remarks?: string;
    tags?: string[];
    notes?: string;
    stockCount?: number;
    lowStockThreshold?: number;
    isStructured?: boolean;
    packingRequirements?: string;
    spareKits?: Array<{ name: string; quantity: number; unit: string; notes?: string }>;
    bulkMaterials?: Array<{ name: string; quantity: number; unit: string; notes?: string }>;
    miscellaneous?: Array<{ name: string; quantity: number; unit: string; notes?: string }>;
    components?: Array<{
      inventoryItemId: Id<"inventory">;
      quantityPerKit: number;
      unit: string;
      wastageNotes?: string;
      comments?: string;
    }>;
  } | null;
  onSave: (kitData: any) => Promise<void>;
  onCancel: () => void;
}

export function KitBuilderForm({ programs, inventory, editingKit, onSave, onCancel }: KitBuilderFormProps) {
  const [kitForm, setKitForm] = useState({
    name: editingKit?.name || "",
    programId: editingKit?.programId || ("" as Id<"programs">),
    serialNumber: editingKit?.serialNumber || "",
    category: editingKit?.category || "",
    cstemVariant: editingKit?.cstemVariant || undefined,
    description: editingKit?.description || "",
    remarks: editingKit?.remarks || "",
    tags: editingKit?.tags || [],
    notes: editingKit?.notes || "",
    stockCount: editingKit?.stockCount || 0,
    lowStockThreshold: editingKit?.lowStockThreshold || 10,
    isStructured: editingKit?.isStructured || false,
    packingRequirements: editingKit?.packingRequirements || "",
    spareKits: editingKit?.spareKits || [],
    bulkMaterials: editingKit?.bulkMaterials || [],
    miscellaneous: editingKit?.miscellaneous || [],
    components: editingKit?.components || [],
  });

  const activePrograms = programs.filter((p) => p.status !== "archived");

  const addComponent = () => {
    setKitForm({
      ...kitForm,
      components: [
        ...kitForm.components,
        {
          inventoryItemId: "" as Id<"inventory">,
          quantityPerKit: 1,
          unit: "pcs",
          wastageNotes: "",
          comments: "",
        },
      ],
    });
  };

  const removeComponent = (index: number) => {
    setKitForm({
      ...kitForm,
      components: kitForm.components.filter((_, i) => i !== index),
    });
  };

  const updateComponent = (index: number, field: string, value: any) => {
    const updated = [...kitForm.components];
    updated[index] = { ...updated[index], [field]: value };
    setKitForm({ ...kitForm, components: updated });
  };

  const calculateKitCost = () => {
    let total = 0;
    for (const comp of kitForm.components) {
      const item = inventory.find((i) => i._id === comp.inventoryItemId);
      if (item) {
        total += comp.quantityPerKit * 10; // Placeholder price
      }
    }
    return total;
  };

  const calculateBuildableUnits = () => {
    if (kitForm.components.length === 0) return 0;
    let min = Infinity;
    for (const comp of kitForm.components) {
      const item = inventory.find((i) => i._id === comp.inventoryItemId);
      if (item) {
        const buildable = Math.floor(item.quantity / comp.quantityPerKit);
        min = Math.min(min, buildable);
      }
    }
    return min === Infinity ? 0 : min;
  };

  const handleSave = async () => {
    await onSave(kitForm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{editingKit ? "Edit Kit" : "Create New Kit"}</h2>
            <p className="text-sm text-muted-foreground">Define kit specifications and bill of materials</p>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          {editingKit ? "Update Kit" : "Create Kit"}
        </Button>
      </div>

      <Separator />

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
              />
            </div>
            <div>
              <Label>Program *</Label>
              <Select
                value={kitForm.programId}
                onValueChange={(value) => setKitForm({ ...kitForm, programId: value as Id<"programs"> })}
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
              />
            </div>
            <div>
              <Label>Category</Label>
              {(() => {
                const selectedProgram = programs.find(p => p._id === kitForm.programId);
                const programCategories = selectedProgram?.categories || [];
                
                if (programCategories.length > 0) {
                  return (
                    <Select
                      value={kitForm.category || "none"}
                      onValueChange={(value) => setKitForm({ ...kitForm, category: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {programCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }
                
                return (
                  <Input
                    value={kitForm.category}
                    onChange={(e) => setKitForm({ ...kitForm, category: e.target.value })}
                    placeholder="e.g., Physics"
                  />
                );
              })()}
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={kitForm.description}
              onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })}
              placeholder="Brief overview of the kit"
              rows={3}
            />
          </div>

          <div>
            <Label>Remarks (Internal Notes)</Label>
            <Textarea
              value={kitForm.remarks}
              onChange={(e) => setKitForm({ ...kitForm, remarks: e.target.value })}
              placeholder="Internal notes, version history, etc."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* BOM Structure Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Bill of Materials (BOM)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-base">BOM Structure</Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={!kitForm.isStructured ? "default" : "outline"}
                onClick={() => setKitForm({ ...kitForm, isStructured: false })}
              >
                Legacy (Components)
              </Button>
              <Button
                size="sm"
                variant={kitForm.isStructured ? "default" : "outline"}
                onClick={() => setKitForm({ ...kitForm, isStructured: true })}
              >
                Structured (Pouches/Packets)
              </Button>
            </div>
          </div>

          <Separator />

          {/* Structured BOM: Pouches and Packets */}
          {kitForm.isStructured ? (
            <div className="space-y-6">
              {/* Pouches */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base">Pouches</Label>
                    <p className="text-sm text-muted-foreground">Containers assembled during packing</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const structure = parsePackingRequirements(kitForm.packingRequirements);
                      structure.pouches.push({ name: "Main Pouch", materials: [] });
                      setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Pouch
                  </Button>
                </div>
                {(() => {
                  const structure = parsePackingRequirements(kitForm.packingRequirements);
                  return structure.pouches.map((pouch, pouchIdx) => (
                    <Card key={pouchIdx} className="mb-4">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Input
                            value={pouch.name}
                            onChange={(e) => {
                              structure.pouches[pouchIdx].name = e.target.value;
                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                            }}
                            placeholder="Pouch name (e.g., Main Pouch)"
                            className="max-w-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              structure.pouches.splice(pouchIdx, 1);
                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                            }}
                          >
                            Remove Pouch
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material Name</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pouch.materials.map((material, matIdx) => (
                              <TableRow key={matIdx}>
                                <TableCell>
                                  <Input
                                    value={material.name}
                                    onChange={(e) => {
                                      structure.pouches[pouchIdx].materials[matIdx].name = e.target.value;
                                      setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                    }}
                                    placeholder="Match inventory name"
                                  />
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
                                    placeholder="pcs"
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
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      structure.pouches[pouchIdx].materials.splice(matIdx, 1);
                                      setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                    }}
                                  >
                                    Remove
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
                          onClick={() => {
                            structure.pouches[pouchIdx].materials.push({ name: "", quantity: 1, unit: "pcs" });
                            setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Material
                        </Button>
                      </CardContent>
                    </Card>
                  ));
                })()}
              </div>

              {/* Packets */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base">Packets (Pre-sealed)</Label>
                    <p className="text-sm text-muted-foreground">Pre-sealed sub-units prepared ahead of time</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const structure = parsePackingRequirements(kitForm.packingRequirements);
                      structure.packets.push({ name: "Packet A", materials: [] });
                      setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Packet
                  </Button>
                </div>
                {(() => {
                  const structure = parsePackingRequirements(kitForm.packingRequirements);
                  return structure.packets.map((packet, packetIdx) => (
                    <Card key={packetIdx} className="mb-4 border-blue-200">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Input
                            value={packet.name}
                            onChange={(e) => {
                              structure.packets[packetIdx].name = e.target.value;
                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                            }}
                            placeholder="Packet name (e.g., Packet A - Hardware)"
                            className="max-w-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              structure.packets.splice(packetIdx, 1);
                              setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                            }}
                          >
                            Remove Packet
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material Name</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {packet.materials.map((material, matIdx) => (
                              <TableRow key={matIdx}>
                                <TableCell>
                                  <Input
                                    value={material.name}
                                    onChange={(e) => {
                                      structure.packets[packetIdx].materials[matIdx].name = e.target.value;
                                      setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                    }}
                                    placeholder="Match inventory name"
                                  />
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
                                    placeholder="pcs"
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
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      structure.packets[packetIdx].materials.splice(matIdx, 1);
                                      setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                                    }}
                                  >
                                    Remove
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
                          onClick={() => {
                            structure.packets[packetIdx].materials.push({ name: "", quantity: 1, unit: "pcs" });
                            setKitForm({ ...kitForm, packingRequirements: stringifyPackingRequirements(structure) });
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Material
                        </Button>
                      </CardContent>
                    </Card>
                  ));
                })()}
              </div>
            </div>
          ) : (
            /* Legacy BOM: Components */
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base">Components</Label>
                <Button size="sm" variant="outline" onClick={addComponent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Component
                </Button>
              </div>

              {kitForm.components.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Box className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No components added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inventory Item</TableHead>
                      <TableHead>Qty/Kit</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kitForm.components.map((comp, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select
                            value={comp.inventoryItemId}
                            onValueChange={(value) => updateComponent(idx, "inventoryItemId", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory.map((item) => (
                                <SelectItem key={item._id} value={item._id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={comp.quantityPerKit}
                            onChange={(e) => updateComponent(idx, "quantityPerKit", parseFloat(e.target.value))}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={comp.unit}
                            onChange={(e) => updateComponent(idx, "unit", e.target.value)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={comp.wastageNotes || ""}
                            onChange={(e) => updateComponent(idx, "wastageNotes", e.target.value)}
                            placeholder="Optional"
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeComponent(idx)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {kitForm.components.length > 0 && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated Cost:</span>
                    <span className="text-sm">₹{calculateKitCost().toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Buildable Units:</span>
                    <span className="text-sm">{calculateBuildableUnits()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
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
          />
        </CardContent>
      </Card>
    </div>
  );
}