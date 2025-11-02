import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  Package,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Copy,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parsePackingRequirements } from "@/lib/kitPacking";

type KitForm = {
  name: string;
  programId: Id<"programs"> | "";
  category?: string;
  description?: string;
  stockCount: number;
  lowStockThreshold: number;
  packingRequirements?: string;
};

export default function Kits() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  const kits = useQuery(api.kits.list);
  const programs = useQuery(api.programs.list);
  const inventory = useQuery(api.inventory.list);

  const createKit = useMutation(api.kits.create);
  const updateKit = useMutation(api.kits.update);
  const removeKit = useMutation(api.kits.remove);
  const cloneKit = useMutation(api.kits.clone);

  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<Id<"programs"> | "all">("all");
  const [expandedKitId, setExpandedKitId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<any | null>(null);
  const [newMaterial, setNewMaterial] = useState("");
  const [formData, setFormData] = useState<KitForm>({
    name: "",
    programId: "" as Id<"programs">,
    category: undefined,
    description: "",
    stockCount: 0,
    lowStockThreshold: 5,
    packingRequirements: "",
  });

  useEffect(() => {
    if (!isCreateOpen) {
      setEditingKit(null);
      setFormData({
        name: "",
        programId: "" as Id<"programs">,
        category: undefined,
        description: "",
        stockCount: 0,
        lowStockThreshold: 5,
        packingRequirements: "",
      });
    }
  }, [isCreateOpen]);

  const filteredKits = useMemo(() => {
    if (!kits) return [];
    return kits
      .filter((k) => (selectedProgram === "all" ? true : k.programId === selectedProgram))
      .filter((k) => (search.trim() ? k.name.toLowerCase().includes(search.toLowerCase()) : true));
  }, [kits, search, selectedProgram]);

  if (isLoading || !user || !kits || !programs || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const programLookup = new Map(programs.map((p) => [String(p._id), p]));

  const toggleExpand = (id: string) => {
    setExpandedKitId((prev) => (prev === id ? null : id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.programId) {
      toast("Please provide a name and select a program");
      return;
    }
    try {
      if (editingKit) {
        await updateKit({
          id: editingKit._id,
          name: formData.name,
          // Removed programId since kits.update doesn't accept it
          category: formData.category,
          description: formData.description,
          stockCount: formData.stockCount,
          lowStockThreshold: formData.lowStockThreshold,
          packingRequirements: formData.packingRequirements,
        });
        toast("Kit updated");
      } else {
        await createKit({
          name: formData.name,
          programId: formData.programId as Id<"programs">,
          stockCount: formData.stockCount,
          category: formData.category,
          description: formData.description,
          lowStockThreshold: formData.lowStockThreshold,
          packingRequirements: formData.packingRequirements,
        });
        toast("Kit created");
      }
      setIsCreateOpen(false);
    } catch (err) {
      toast("Failed to save kit", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleEdit = (kit: any) => {
    if (kit.isStructured) {
      navigate(`/kit-sheet-maker?edit=${kit._id}`);
      return;
    }
    setEditingKit(kit);
    setFormData({
      name: kit.name || "",
      programId: kit.programId || ("" as Id<"programs">),
      category: kit.category || undefined,
      description: kit.description || "",
      stockCount: typeof kit.stockCount === "number" ? kit.stockCount : 0,
      lowStockThreshold: typeof kit.lowStockThreshold === "number" ? kit.lowStockThreshold : 5,
      packingRequirements: kit.packingRequirements || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (kitId: string) => {
    if (!confirm("Delete this kit?")) return;
    try {
      await removeKit({ id: kitId as any });
      toast("Kit deleted");
    } catch (err) {
      toast("Failed to delete kit", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleClone = async (kitId: string) => {
    try {
      await cloneKit({ id: kitId as any });
      toast("Kit cloned");
    } catch (err) {
      toast("Failed to clone kit", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleAddMaterial = async (kit: any) => {
    const item = newMaterial.trim();
    if (!item) return;
    const existing = (kit.packingRequirements || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    const updated = [...existing, item].join(", ");
    try {
      await updateKit({ id: kit._id, packingRequirements: updated });
      toast("Material added");
      setNewMaterial("");
    } catch (err) {
      toast("Failed to add material", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };
  const handleRemoveMaterial = async (kit: any, index: number) => {
    const existing = (kit.packingRequirements || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    if (index < 0 || index >= existing.length) return;
    const updatedArr = existing.filter((_: string, i: number) => i !== index);
    const updated = updatedArr.join(", ");
    try {
      await updateKit({ id: kit._id, packingRequirements: updated });
      toast("Material removed");
    } catch (err) {
      toast("Failed to remove material", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedProgram !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProgram("all")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to All Programs
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kits</h1>
              <p className="text-muted-foreground mt-2">
                Manage kits, view BOMs, and open the Kit Sheet Maker
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/kit-sheet-maker")}>
              Open Kit Sheet Maker
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Kit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingKit ? "Edit Kit" : "Create New Kit"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Kit Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label>Program</Label>
                    <Select
                      value={formData.programId || ""}
                      onValueChange={(v) => setFormData((p) => ({ ...p, programId: v as Id<"programs"> }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p._id} value={p._id as unknown as string}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(() => {
                    const prog = programs.find((p) => p._id === formData.programId);
                    if (prog?.categories && prog.categories.length > 0) {
                      return (
                        <div>
                          <Label>Category</Label>
                          <Select
                            value={formData.category || ""}
                            onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {prog.categories.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Stock Count</Label>
                      <Input
                        type="number"
                        min={-999999}
                        value={formData.stockCount}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, stockCount: parseInt(e.target.value) || 0 }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Low Stock Alert</Label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.lowStockThreshold}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, lowStockThreshold: parseInt(e.target.value) || 0 }))
                        }
                        required
                      />
                    </div>
                  </div>

                  {!editingKit && (
                    <div>
                      <Label>Packing Requirements (CSV)</Label>
                      <Textarea
                        value={formData.packingRequirements}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, packingRequirements: e.target.value }))
                        }
                        rows={2}
                        placeholder="e.g., 5 sensors, 2 controllers, 1 manual"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingKit ? "Update" : "Create"} Kit</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <Package className="h-5 w-5" />
              Kits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Filter by Program</Label>
                <Select
                  value={selectedProgram}
                  onValueChange={(v) => setSelectedProgram(v as Id<"programs"> | "all")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p._id} value={p._id as unknown as string}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Search</Label>
                <Input
                  placeholder="Search by kit name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Serial #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Kit Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Program</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Stock</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKits.map((kit, index) => {
                    const prog = programLookup.get(String(kit.programId));
                    const isExpanded = expandedKitId === kit._id;
                    const statusLow = typeof kit.lowStockThreshold === "number"
                      ? kit.stockCount <= kit.lowStockThreshold
                      : false;

                    return (
                      <tbody key={kit._id}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(kit._id)}
                        >
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {kit.serialNumber || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                              {kit.name}
                              {statusLow && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="outline" className="text-xs">
                              {prog?.name || "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {kit.stockCount >= 0 ? (
                              <div>
                                <div className="font-medium text-green-600">{kit.stockCount}</div>
                                <div className="text-xs text-green-600">Available</div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium text-red-600">{Math.abs(kit.stockCount)}</div>
                                <div className="text-xs text-red-600">To be Made</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusLow ? "destructive" : "default"} className="text-xs">
                              {statusLow ? "Low stock" : "In stock"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => handleClone(kit._id)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(kit)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(kit._id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>

                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="space-y-3">
                                {kit.description && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground">Description:</span>
                                    <p className="text-sm mt-1">{kit.description}</p>
                                  </div>
                                )}

                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {kit.isStructured ? "Pouches & Packets" : "Materials Required"}
                                  </span>

                                  {kit.isStructured ? (
                                    (() => {
                                      const structure = parsePackingRequirements(kit.packingRequirements);
                                      const hasContent =
                                        (structure.pouches?.length ?? 0) > 0 ||
                                        (structure.packets?.length ?? 0) > 0;
                                      if (!hasContent) {
                                        return <div className="text-sm text-muted-foreground mt-2">No structured materials specified.</div>;
                                      }
                                      return (
                                        <div className="mt-2 space-y-4">
                                          {structure.pouches?.length > 0 && (
                                            <div>
                                              <div className="text-sm font-semibold mb-2 text-primary">Pouches</div>
                                              <div className="space-y-2">
                                                {structure.pouches.map((pouch, pIdx) => (
                                                  <div key={pIdx} className="border rounded p-3 bg-background">
                                                    <div className="font-medium text-sm text-center mb-3 pb-2 border-b">{pouch.name}</div>
                                                    <ul className="space-y-1 text-sm">
                                                      {pouch.materials.map((m, mIdx) => (
                                                        <li key={mIdx} className="flex justify-between gap-2">
                                                          <span className="flex-1 break-words">• {m.name}</span>
                                                          <span className="flex-shrink-0 font-medium whitespace-nowrap">
                                                            {m.quantity} {m.unit}
                                                          </span>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {structure.packets?.length > 0 && (
                                            <div>
                                              <div className="text-sm font-semibold mb-2 text-primary">Packets</div>
                                              <div className="space-y-2">
                                                {structure.packets.map((packet, pIdx) => (
                                                  <div key={pIdx} className="border rounded p-3 bg-background">
                                                    <div className="font-medium text-sm text-center mb-3 pb-2 border-b">{packet.name}</div>
                                                    <ul className="space-y-1 text-sm">
                                                      {packet.materials.map((m, mIdx) => (
                                                        <li key={mIdx} className="flex justify-between gap-2">
                                                          <span className="flex-1 break-words">• {m.name}</span>
                                                          <span className="flex-shrink-0 font-medium whitespace-nowrap">
                                                            {m.quantity} {m.unit}
                                                          </span>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <>
                                      {kit.packingRequirements && kit.packingRequirements.trim().length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
                                          {kit.packingRequirements
                                            .split(",")
                                            .map((s: string) => s.trim())
                                            .filter((s: string) => s.length > 0)
                                            .map((item: string, idx: number) => (
                                              <li key={idx} className="flex items-center justify-between gap-2">
                                                <span>{item}</span>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveMaterial(kit, idx);
                                                  }}
                                                >
                                                  Remove
                                                </Button>
                                              </li>
                                            ))}
                                        </ul>
                                      ) : (
                                        <div className="text-sm text-muted-foreground mt-2">No materials specified.</div>
                                      )}
                                      <div className="mt-3 flex items-center gap-2">
                                        <div className="flex-1">
                                          <Input
                                            placeholder="Search inventory items..."
                                            value={newMaterial}
                                            onChange={(e) => setNewMaterial(e.target.value)}
                                            list="inventory-items"
                                          />
                                          <datalist id="inventory-items">
                                            {[...(inventory ?? [])]
                                              .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                              .map((i: any) => (
                                                <option key={`${i._id}`} value={i.name}>
                                                  {i.name}
                                                </option>
                                              ))}
                                          </datalist>
                                        </div>
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddMaterial(kit);
                                          }}
                                        >
                                          Add
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredKits.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No kits match your filters</h3>
                <p className="text-muted-foreground">Try adjusting the filters above.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}