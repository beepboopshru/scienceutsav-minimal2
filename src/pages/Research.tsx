import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Plus, Search, Package, Beaker, Edit, Copy, Archive, DollarSign, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { KitBuilderForm } from "@/components/research/KitBuilderForm";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "kit-builder">("list");

  // Program dialog state
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Id<"programs"> | null>(null);
  const [programForm, setProgramForm] = useState({ 
    name: "", 
    description: "", 
    tags: [] as string[], 
    categories: [] as string[],
    usesVariants: false 
  });
  const [categoryInput, setCategoryInput] = useState("");

  // Kit builder state
  const [editingKit, setEditingKit] = useState<Id<"kits"> | null>(null);
  const [kitForm, setKitForm] = useState({
    name: "",
    programId: "" as Id<"programs">,
    serialNumber: "",
    category: "",
    cstemVariant: undefined,
    description: "",
    remarks: "",
    tags: [] as string[],
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
    const matchesCategory = categoryFilter === "all" || kit.category === categoryFilter;
    return matchesSearch && matchesProgram && matchesTag && matchesCategory;
  });

  const allTags = Array.from(new Set(activeKits.flatMap((k) => k.tags || [])));
  
  const selectedProgramData = selectedProgram ? programs.find((p) => p._id === selectedProgram) : null;
  const availableCategories = selectedProgramData?.categories || [];

  const handleCreateProgram = async () => {
    try {
      await createProgram(programForm);
      toast.success("Program created successfully");
      setProgramDialogOpen(false);
      setProgramForm({ name: "", description: "", tags: [], categories: [], usesVariants: false });
      setCategoryInput("");
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
      setProgramForm({ name: "", description: "", tags: [], categories: [], usesVariants: false });
      setCategoryInput("");
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

  const handleSaveKit = async (kitData: any) => {
    try {
      const { cstemVariant, ...rest } = kitData;
      if (editingKit) {
        await updateKit({
          id: editingKit,
          ...rest,
          ...(cstemVariant ? { cstemVariant } : {}),
        });
        toast.success("Kit updated successfully");
      } else {
        await createKit(kitData);
        toast.success("Kit created successfully");
      }
      setView("list");
      setEditingKit(null);
    } catch (error) {
      toast.error(editingKit ? "Failed to update kit" : "Failed to create kit");
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
    const cats = program.categories || [];
    setProgramForm({
      name: program.name,
      description: program.description || "",
      tags: program.tags || [],
      categories: cats,
      usesVariants: program.usesVariants || false,
    });
    setCategoryInput(cats.join(", "));
    setProgramDialogOpen(true);
  };

  const openEditKit = (kit: typeof kits[0]) => {
    setEditingKit(kit._id);
    setView("kit-builder");
  };

  const openNewKit = () => {
    setEditingKit(null);
    setView("kit-builder");
  };

  const calculateKitCost = (components: Array<{ inventoryItemId: Id<"inventory">; quantityPerKit: number }>) => {
    let total = 0;
    for (const comp of components) {
      const item = inventory.find((i) => i._id === comp.inventoryItemId);
      if (item) {
        total += comp.quantityPerKit * 10; // Placeholder price
      }
    }
    return total;
  };

  const calculateBuildableUnits = (components: Array<{ inventoryItemId: Id<"inventory">; quantityPerKit: number }>) => {
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

  // Show Kit Builder view
  if (view === "kit-builder") {
    const editingKitData = editingKit ? kits.find((k) => k._id === editingKit) : null;
    
    return (
      <Layout>
        <div className="p-8">
          <KitBuilderForm
            programs={programs}
            inventory={inventory}
            editingKit={editingKitData}
            onSave={handleSaveKit}
            onCancel={() => {
              setView("list");
              setEditingKit(null);
            }}
          />
        </div>
      </Layout>
    );
  }

  // Show List view
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
                  <Button onClick={() => { 
                    setEditingProgram(null); 
                    setProgramForm({ name: "", description: "", tags: [], categories: [], usesVariants: false }); 
                    setCategoryInput("");
                  }}>
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
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="usesVariants"
                        checked={programForm.usesVariants}
                        onChange={(e) => setProgramForm({ ...programForm, usesVariants: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="usesVariants">Uses CSTEM Variants (Explorer/Discoverer)</Label>
                    </div>
                    <div>
                      <Label>Categories (comma-separated)</Label>
                      <Input 
                        value={categoryInput} 
                        onChange={(e) => setCategoryInput(e.target.value)} 
                        onBlur={(e) => setProgramForm({
                          ...programForm,
                          categories: e.target.value.split(",").map(c => c.trim()).filter(c => c.length > 0)
                        })}
                        placeholder="e.g., Beginner, Intermediate, Advanced" 
                      />
                      <p className="text-xs text-muted-foreground mt-1">Define category options for kits in this program</p>
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

              <Button variant="outline" onClick={openNewKit}>
                <Package className="mr-2 h-4 w-4" />
                New Kit
              </Button>
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
                  {availableCategories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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