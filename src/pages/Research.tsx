import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Plus, Search, Package, Beaker, Edit, Copy, Archive, AlertCircle, DollarSign, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";

export default function Research() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const inventory = useQuery(api.inventory.list);

  const createProgram = useMutation(api.programs.create);
  const updateProgram = useMutation(api.programs.update);
  const createKit = useMutation(api.kits.create);
  const updateKit = useMutation(api.kits.update);
  const cloneKit = useMutation(api.kits.clone);

  const [selectedProgram, setSelectedProgram] = useState<Id<"programs"> | null>(null);
  const [selectedKit, setSelectedKit] = useState<Id<"kits"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");

  // Program dialog state
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Id<"programs"> | null>(null);
  const [programForm, setProgramForm] = useState({ name: "", description: "", tags: [] as string[] });

  // Kit dialog state
  const [kitDialogOpen, setKitDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Id<"kits"> | null>(null);
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
    lowStockThreshold: 10,
    isStructured: false,
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

  if (isLoading || !user || !programs || !kits || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const activePrograms = programs.filter((p) => p.status !== "archived");
  const activeKits = kits.filter((k) => k.status !== "archived");

  const filteredKits = activeKits.filter((kit) => {
    const matchesSearch = kit.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram = !selectedProgram || kit.programId === selectedProgram;
    const matchesTag = tagFilter === "all" || kit.tags?.includes(tagFilter);
    return matchesSearch && matchesProgram && matchesTag;
  });

  const allTags = Array.from(new Set(activeKits.flatMap((k) => k.tags || [])));

  const handleCreateProgram = async () => {
    try {
      await createProgram(programForm);
      toast.success("Program created successfully");
      setProgramDialogOpen(false);
      setProgramForm({ name: "", description: "", tags: [] });
    } catch (error) {
      toast.error("Failed to create program");
    }
  };

  const handleUpdateProgram = async () => {
    if (!editingProgram) return;
    try {
      await updateProgram({ id: editingProgram, ...programForm });
      toast.success("Program updated successfully");
      setProgramDialogOpen(false);
      setEditingProgram(null);
      setProgramForm({ name: "", description: "", tags: [] });
    } catch (error) {
      toast.error("Failed to update program");
    }
  };

  const handleArchiveProgram = async (id: Id<"programs">) => {
    try {
      await updateProgram({ id, status: "archived" });
      toast.success("Program archived");
    } catch (error) {
      toast.error("Failed to archive program");
    }
  };

  const handleCreateKit = async () => {
    try {
      await createKit(kitForm);
      toast.success("Kit created successfully");
      setKitDialogOpen(false);
      setKitForm({
        name: "",
        programId: "" as Id<"programs">,
        serialNumber: "",
        category: "",
        cstemVariant: undefined,
        description: "",
        remarks: "",
        tags: [],
        notes: "",
        stockCount: 0,
        lowStockThreshold: 10,
        isStructured: false,
        packingRequirements: "",
        spareKits: [],
        bulkMaterials: [],
        miscellaneous: [],
        components: [],
      });
    } catch (error) {
      toast.error("Failed to create kit");
    }
  };

  const handleUpdateKit = async () => {
    if (!editingKit) return;
    try {
      const { cstemVariant, ...rest } = kitForm;
      await updateKit({
        id: editingKit,
        ...rest,
        ...(cstemVariant ? { cstemVariant } : {}),
      });
      toast.success("Kit updated successfully");
      setKitDialogOpen(false);
      setEditingKit(null);
      setKitForm({
        name: "",
        programId: "" as Id<"programs">,
        serialNumber: "",
        category: "",
        cstemVariant: undefined,
        description: "",
        remarks: "",
        tags: [],
        notes: "",
        stockCount: 0,
        lowStockThreshold: 10,
        isStructured: false,
        packingRequirements: "",
        spareKits: [],
        bulkMaterials: [],
        miscellaneous: [],
        components: [],
      });
    } catch (error) {
      toast.error("Failed to update kit");
    }
  };

  const handleCloneKit = async (id: Id<"kits">) => {
    try {
      await cloneKit({ id });
      toast.success("Kit cloned successfully");
    } catch (error) {
      toast.error("Failed to clone kit");
    }
  };

  const handleArchiveKit = async (id: Id<"kits">) => {
    try {
      await updateKit({ id, status: "archived" });
      toast.success("Kit archived");
    } catch (error) {
      toast.error("Failed to archive kit");
    }
  };

  const openEditProgram = (program: typeof programs[0]) => {
    setEditingProgram(program._id);
    setProgramForm({
      name: program.name,
      description: program.description || "",
      tags: program.tags || [],
    });
    setProgramDialogOpen(true);
  };

  const openEditKit = (kit: typeof kits[0]) => {
    setEditingKit(kit._id);
    setKitForm({
      name: kit.name,
      programId: kit.programId,
      serialNumber: kit.serialNumber || "",
      category: kit.category || "",
      cstemVariant: kit.cstemVariant,
      description: kit.description || "",
      remarks: kit.remarks || "",
      tags: kit.tags || [],
      notes: kit.notes || "",
      stockCount: kit.stockCount || 0,
      lowStockThreshold: kit.lowStockThreshold || 10,
      isStructured: kit.isStructured || false,
      packingRequirements: kit.packingRequirements || "",
      spareKits: kit.spareKits || [],
      bulkMaterials: kit.bulkMaterials || [],
      miscellaneous: kit.miscellaneous || [],
      components: kit.components || [],
    });
    setKitDialogOpen(true);
  };

  const calculateKitCost = (components: typeof kitForm.components) => {
    let total = 0;
    for (const comp of components) {
      const item = inventory.find((i) => i._id === comp.inventoryItemId);
      if (item) {
        total += comp.quantityPerKit * 10; // Placeholder price
      }
    }
    return total;
  };

  const calculateBuildableUnits = (components: typeof kitForm.components) => {
    if (components.length === 0) return 0;
    let min = Infinity;
    for (const comp of components) {
      const item = inventory.find((i) => i._id === comp.inventoryItemId);
      if (item) {
        const buildable = Math.floor(item.quantity / comp.quantityPerKit);
        min = Math.min(min, buildable);
      }
    }
    return min === Infinity ? 0 : min;
  };

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

  return (
    <Layout>
      <div className="p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Research & Development</h1>
              <p className="text-muted-foreground mt-2">Manage programs, kits, and bill of materials</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingProgram(null); setProgramForm({ name: "", description: "", tags: [] }); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Program
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingProgram ? "Edit Program" : "Create Program"}</DialogTitle>
                    <DialogDescription>Define a thematic umbrella for grouping related kits</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} placeholder="e.g., Physics Experiments" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} placeholder="Brief overview of the program" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProgramDialogOpen(false)}>Cancel</Button>
                    <Button onClick={editingProgram ? handleUpdateProgram : handleCreateProgram}>
                      {editingProgram ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={kitDialogOpen} onOpenChange={setKitDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => { 
                    setEditingKit(null); 
                    setKitForm({ 
                      name: "", 
                      programId: "" as Id<"programs">, 
                      serialNumber: "",
                      category: "",
                      cstemVariant: undefined,
                      description: "", 
                      remarks: "",
                      tags: [], 
                      notes: "", 
                      stockCount: 0,
                      lowStockThreshold: 10,
                      isStructured: false,
                      packingRequirements: "",
                      spareKits: [],
                      bulkMaterials: [],
                      miscellaneous: [],
                      components: [] 
                    }); 
                  }}>
                    <Package className="mr-2 h-4 w-4" />
                    New Kit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingKit ? "Edit Kit" : "Create Kit"}</DialogTitle>
                    <DialogDescription>Define kit specifications and bill of materials</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Kit Name</Label>
                        <Input value={kitForm.name} onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })} placeholder="e.g., Electric Circuit Kit" />
                      </div>
                      <div>
                        <Label>Program</Label>
                        <Select value={kitForm.programId} onValueChange={(value) => setKitForm({ ...kitForm, programId: value as Id<"programs"> })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select program" />
                          </SelectTrigger>
                          <SelectContent>
                            {activePrograms.map((p) => (
                              <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea value={kitForm.description} onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })} placeholder="Kit overview" />
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea value={kitForm.notes} onChange={(e) => setKitForm({ ...kitForm, notes: e.target.value })} placeholder="Assembly notes, special instructions" />
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Label className="text-base">Bill of Materials (BOM)</Label>
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
                                  <Select value={comp.inventoryItemId} onValueChange={(value) => updateComponent(idx, "inventoryItemId", value)}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select item" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {inventory.map((item) => (
                                        <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input type="number" value={comp.quantityPerKit} onChange={(e) => updateComponent(idx, "quantityPerKit", parseFloat(e.target.value))} className="w-20" />
                                </TableCell>
                                <TableCell>
                                  <Input value={comp.unit} onChange={(e) => updateComponent(idx, "unit", e.target.value)} className="w-20" />
                                </TableCell>
                                <TableCell>
                                  <Input value={comp.wastageNotes || ""} onChange={(e) => updateComponent(idx, "wastageNotes", e.target.value)} placeholder="Optional" />
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => removeComponent(idx)}>Remove</Button>
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
                            <span className="text-sm">₹{calculateKitCost(kitForm.components).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Buildable Units:</span>
                            <span className="text-sm">{calculateBuildableUnits(kitForm.components)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setKitDialogOpen(false)}>Cancel</Button>
                    <Button onClick={editingKit ? handleUpdateKit : handleCreateKit}>
                      {editingKit ? "Update Kit" : "Create Kit"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Programs Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                Programs
              </CardTitle>
              <CardDescription>Thematic umbrellas for organizing kits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {activePrograms.map((program) => (
                  <Card key={program._id} className={`cursor-pointer transition-colors ${selectedProgram === program._id ? "border-foreground" : ""}`} onClick={() => setSelectedProgram(selectedProgram === program._id ? null : program._id)}>
                    <CardHeader>
                      <CardTitle className="text-base">{program.name}</CardTitle>
                      <CardDescription className="text-sm">{program.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditProgram(program); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleArchiveProgram(program._id); }}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Kits Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Kits
                  </CardTitle>
                  <CardDescription>Product specifications and bill of materials</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search kits..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-64" />
                  </div>
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {allTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredKits.map((kit) => {
                  const program = programs.find((p) => p._id === kit.programId);
                  const buildable = calculateBuildableUnits(kit.components || []);
                  const cost = calculateKitCost(kit.components || []);

                  return (
                    <Card key={kit._id}>
                      <CardHeader>
                        <CardTitle className="text-base">{kit.name}</CardTitle>
                        <CardDescription className="text-sm">{program?.name}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>₹{cost.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Box className="h-4 w-4 text-muted-foreground" />
                          <span>{buildable} buildable</span>
                          {buildable < 10 && <Badge variant="destructive" className="text-xs">Low</Badge>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditKit(kit)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleCloneKit(kit._id)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleArchiveKit(kit._id)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
