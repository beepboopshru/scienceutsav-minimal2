import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Box, ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQuery, useAction } from "convex/react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ResearchFileManager } from "@/components/research/ResearchFileManager";
import { parsePackingRequirements } from "@/lib/kitPacking";
import { Download, Upload, Edit, Trash2, Plus, Package, Loader2, FileText, Image as ImageIcon, Wrench, BookOpen, Copy } from "lucide-react";

// Helper to render structured materials (pouches/packets)
function StructuredMaterials({ packingRequirements, inventory }: { packingRequirements?: string; inventory?: any[] }) {
  const structure = parsePackingRequirements(packingRequirements);
  const hasContent =
    (structure.pouches?.length ?? 0) > 0 ||
    (structure.packets?.length ?? 0) > 0;

  if (!hasContent) {
    return <div className="text-center py-4 text-muted-foreground text-sm">No structured materials found for this kit</div>;
  }

  const renderMaterial = (material: any, mIdx: number) => {
    const inventoryItem = inventory?.find((i) => i.name === material.name);
    return (
      <li key={mIdx}>
        <div className="flex justify-between gap-2">
          <div className="flex-1">
            <div className="break-words">• {material.name}</div>
            {inventoryItem?.description && (
              <div className="text-xs text-muted-foreground ml-3 mt-0.5">
                {inventoryItem.description}
              </div>
            )}
          </div>
          <span className="flex-shrink-0 font-medium whitespace-nowrap">
            {material.quantity} {material.unit}
          </span>
        </div>
        {material.notes && (
          <div className="text-muted-foreground ml-3 mt-0.5 italic text-xs">
            {material.notes}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {structure.pouches?.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2 text-primary">Pouches</div>
          <div className="space-y-3">
            {structure.pouches.map((pouch, pIdx) => (
              <div key={pIdx} className="border rounded p-3 bg-background">
                <div className="font-medium text-sm text-center mb-3 pb-2 border-b">{pouch.name}</div>
                {pouch.materials && pouch.materials.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {pouch.materials.map((material, mIdx) => renderMaterial(material, mIdx))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground text-center">
                    No components defined
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {structure.packets?.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2 text-primary">Packets</div>
          <div className="space-y-3">
            {structure.packets.map((packet, pIdx) => (
              <div key={pIdx} className="border rounded p-3 bg-background">
                <div className="font-medium text-sm text-center mb-3 pb-2 border-b">{packet.name}</div>
                {packet.materials && packet.materials.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {packet.materials.map((material, mIdx) => renderMaterial(material, mIdx))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground text-center">
                    No components defined
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Research() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  const kits = useQuery(api.kits.list);
  const programs = useQuery(api.programs.list);
  const inventory = useQuery(api.inventory.list);
  const { hasPermission } = usePermissions();

  const createKit = useMutation(api.kits.create);
  const updateKit = useMutation(api.kits.update);
  const deleteKit = useMutation(api.kits.remove);
  const cloneKit = useMutation(api.kits.clone);

  const createProgram = useMutation(api.programs.create);
  const updateProgram = useMutation(api.programs.update);
  const deleteProgram = useMutation(api.programs.remove);

  const downloadKitSheet = useAction(api.kitPdf.generateKitSheet);

  // File manager state
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [fileType, setFileType] = useState<"kitImage" | "laser" | "component" | "workbook">("kitImage");
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);

  // Permission checks using centralized hook
  const canViewPrograms = hasPermission("programs", "view");
  const canCreatePrograms = hasPermission("programs", "create");
  const canEditPrograms = hasPermission("programs", "edit");
  const canDeletePrograms = hasPermission("programs", "delete");
  const canViewKits = hasPermission("kits", "view");
  const canCreateKits = hasPermission("kits", "create");
  const canEditKits = hasPermission("kits", "edit");
  const canDeleteKits = hasPermission("kits", "delete");
  const canCloneKits = hasPermission("kits", "clone");
  const canUploadImages = hasPermission("kits", "uploadImages");

  // View state
  const [selectedProgramId, setSelectedProgramId] = useState<Id<"programs"> | null>(null);

  // Program dialogs
  const [isCreateProgramOpen, setIsCreateProgramOpen] = useState(false);
  const [isEditProgramOpen, setIsEditProgramOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [newProgramData, setNewProgramData] = useState({ name: "", description: "", categories: "" });
  const [editProgramData, setEditProgramData] = useState({ name: "", description: "", categories: "" });

  // Simple kit dialog
  const [isCreateSimpleKitOpen, setIsCreateSimpleKitOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<any>(null);
  const [simpleKitFormData, setSimpleKitFormData] = useState<{
    name: string;
    serialNumber: string;
    category?: string;
    conceptName?: string;
    subject?: string;
    grade?: number;
    description: string;
  }>({ name: "", serialNumber: "", category: undefined, conceptName: "", subject: "", grade: undefined, description: "" });

  // Clone kit dialog state
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [cloneKitData, setCloneKitData] = useState<{
    kitId: Id<"kits"> | null;
    kitName: string;
    newName: string;
    targetProgramId: string;
  }>({
    kitId: null,
    kitName: "",
    newName: "",
    targetProgramId: "",
  });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [kitSearchQuery, setKitSearchQuery] = useState<string>("");

  // File manager
  const [fileManager, setFileManager] = useState<{
    kitId: Id<"kits">;
    fileType: "kitImage" | "laser" | "component" | "workbook";
  } | null>(null);

  // Row expand
  const [expandedKitId, setExpandedKitId] = useState<string | null>(null);

  const selectedProgram = useMemo(
    () => (programs ?? []).find((p) => p._id === selectedProgramId) || null,
    [programs, selectedProgramId]
  );

  const uniqueSubjects = useMemo(() => {
    if (!kits || !selectedProgramId) return [];
    const subjects = new Set<string>();
    kits.forEach((k) => {
      if (k.programId === selectedProgramId && k.subject) {
        subjects.add(k.subject);
      }
    });
    return Array.from(subjects).sort();
  }, [kits, selectedProgramId]);

  const uniqueGrades = useMemo(() => {
    if (!kits || !selectedProgramId) return [];
    const grades = new Set<number>();
    kits.forEach((k) => {
      if (k.programId === selectedProgramId && k.grade !== undefined) {
        grades.add(k.grade);
      }
    });
    return Array.from(grades).sort((a, b) => a - b);
  }, [kits, selectedProgramId]);

  const programStats = useMemo(() => {
    const result: Record<string, number> = {};
    if (!programs || !kits) return result;
    for (const p of programs) {
      const count = kits.filter((k) => k.programId === p._id).length;
      result[String(p._id)] = count;
    }
    return result;
  }, [programs, kits]);

  const filteredKits = useMemo(() => {
    if (!kits) return [];
    return kits.filter((k) => {
      if (selectedProgramId && k.programId !== selectedProgramId) return false;

      let categoryOk = true;
      if (categoryFilter !== "all") categoryOk = k.category === categoryFilter;

      let subjectOk = true;
      if (subjectFilter !== "all") subjectOk = k.subject === subjectFilter;

      let gradeOk = true;
      if (gradeFilter !== "all") gradeOk = k.grade?.toString() === gradeFilter;

      let searchOk = true;
      if (kitSearchQuery.trim()) {
        searchOk = k.name.toLowerCase().includes(kitSearchQuery.toLowerCase());
      }
      return categoryOk && searchOk && subjectOk && gradeOk;
    });
  }, [kits, selectedProgramId, categoryFilter, subjectFilter, gradeFilter, kitSearchQuery]);

  // Program handlers
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgramData.name.trim()) {
      toast("Please enter a program name");
      return;
    }
    try {
      const categories = newProgramData.categories
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      await createProgram({
        name: newProgramData.name,
        description: newProgramData.description || undefined,
        categories: categories.length > 0 ? categories : undefined,
      });

      toast("Program created successfully");
      setIsCreateProgramOpen(false);
      setNewProgramData({ name: "", description: "", categories: "" });
    } catch (error) {
      toast("Error creating program", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleEditProgram = (program: any) => {
    setEditingProgram(program);
    setEditProgramData({
      name: program.name,
      description: program.description || "",
      categories: program.categories ? program.categories.join(", ") : "",
    });
    setIsEditProgramOpen(true);
  };

  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram || !editProgramData.name.trim()) {
      toast("Please enter a program name");
      return;
    }
    try {
      const categories = editProgramData.categories
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      await updateProgram({
        id: editingProgram._id,
        name: editProgramData.name,
        description: editProgramData.description || undefined,
        categories: categories.length > 0 ? categories : undefined,
      });

      toast("Program updated successfully");
      setIsEditProgramOpen(false);
      setEditingProgram(null);
      setEditProgramData({ name: "", description: "", categories: "" });
    } catch (error) {
      toast("Error updating program", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDeleteProgram = async (programId: Id<"programs">, programName: string) => {
    if (confirm(`Delete "${programName}" program? This will fail if any kits are associated.`)) {
      try {
        await deleteProgram({ id: programId });
        toast("Program deleted successfully");
      } catch (error) {
        toast("Error deleting program", {
          description: error instanceof Error ? error.message : "Cannot delete program with associated kits",
        });
      }
    }
  };

  // Kit handlers
  const handleCreateSimpleKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgramId) {
      toast("Please select a program");
      return;
    }
    try {
      if (editingKit) {
        await updateKit({
          id: editingKit._id,
          name: simpleKitFormData.name,
          serialNumber: simpleKitFormData.serialNumber || undefined,
          category: simpleKitFormData.category,
          conceptName: simpleKitFormData.conceptName || undefined,
          subject: simpleKitFormData.subject || undefined,
          grade: simpleKitFormData.grade,
          description: simpleKitFormData.description || undefined,
        });
        toast("Kit updated successfully");
      } else {
        await createKit({
          name: simpleKitFormData.name,
          programId: selectedProgramId,
          serialNumber: simpleKitFormData.serialNumber || undefined,
          category: simpleKitFormData.category,
          conceptName: simpleKitFormData.conceptName || undefined,
          subject: simpleKitFormData.subject || undefined,
          grade: simpleKitFormData.grade,
          description: simpleKitFormData.description || undefined,
          stockCount: 0,
          lowStockThreshold: 5,
          isStructured: false,
        });
        toast("Kit created successfully");
      }

      setIsCreateSimpleKitOpen(false);
      setEditingKit(null);
      setSimpleKitFormData({ name: "", serialNumber: "", category: undefined, conceptName: "", subject: "", description: "" });
    } catch (error) {
      toast("Error saving kit", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleEditKit = (kit: any) => {
    if (kit.isStructured) {
      // Navigate to Kit Builder for structured kits
      navigate(`/kit-builder?edit=${kit._id}`);
    } else {
      // Open simple kit dialog for unstructured kits
      setEditingKit(kit);
      setSimpleKitFormData({
        name: kit.name || "",
        serialNumber: kit.serialNumber || "",
        category: kit.category,
        conceptName: kit.conceptName || "",
        subject: kit.subject || "",
        grade: kit.grade,
        description: kit.description || "",
      });
      setIsCreateSimpleKitOpen(true);
    }
  };

  const handleDeleteKit = async (kitId: Id<"kits">) => {
    if (confirm("Are you sure you want to delete this kit blueprint?")) {
      try {
        await deleteKit({ id: kitId });
        toast("Kit deleted successfully");
      } catch (error) {
        toast("Error deleting kit", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  const handleCloneKit = (kit: any) => {
    setCloneKitData({
      kitId: kit._id,
      kitName: kit.name,
      newName: `${kit.name} (Copy)`,
      targetProgramId: "",
    });
    setIsCloneDialogOpen(true);
  };

  const handleSubmitClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneKitData.kitId || !cloneKitData.targetProgramId) {
      toast.error("Please select a target program");
      return;
    }

    try {
      await cloneKit({
        id: cloneKitData.kitId,
        targetProgramId: cloneKitData.targetProgramId as Id<"programs">,
        newName: cloneKitData.newName || undefined,
      });
      toast.success("Kit cloned successfully");
      setIsCloneDialogOpen(false);
      setCloneKitData({
        kitId: null,
        kitName: "",
        newName: "",
        targetProgramId: "",
      });
    } catch (error) {
      toast.error("Error cloning kit", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleOpenKitSheet = (kitId: Id<"kits">) => {
    navigate(`/kit-sheet-maker?edit=${kitId}`);
  };

  const handleDownloadKitSheet = async (kitId: Id<"kits">) => {
    try {
      toast.info("Generating kit sheet...");
      const result = await downloadKitSheet({ kitId });
      
      // Create a blob from the HTML and trigger download
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.kitName.replace(/\s+/g, "-")}-sheet.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Kit sheet downloaded successfully");
    } catch (error) {
      console.error("Failed to download kit sheet:", error);
      toast.error("Failed to generate kit sheet", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const [importedComponents, setImportedComponents] = useState<any[]>([]);
  const [importedPacking, setImportedPacking] = useState<string>("");

  if (isLoading || !kits || !programs) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  // Check view permission
  if (!canViewPrograms && !canViewKits) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Program Management view
  if (selectedProgramId === null) {
    return (
      <Layout>
        {/* Add horizontal padding so cards don't touch the sidebar or screen edge */}
        <div className="px-4 sm:px-6 lg:px-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Research & Development</h1>
              <p className="text-muted-foreground mt-2">Program Management and Kit Design Hub</p>
            </div>
            {canCreatePrograms && (
              <Dialog open={isCreateProgramOpen} onOpenChange={setIsCreateProgramOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Program
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Program</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateProgram} className="space-y-4">
                    <div>
                      <Label htmlFor="programName">Program Name</Label>
                      <Input
                        id="programName"
                        value={newProgramData.name}
                        onChange={(e) => setNewProgramData({ ...newProgramData, name: e.target.value })}
                        placeholder="e.g., Electronics, Mechanics"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="programDescription">Description (optional)</Label>
                      <Textarea
                        id="programDescription"
                        value={newProgramData.description}
                        onChange={(e) => setNewProgramData({ ...newProgramData, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="programCategories">Categories (optional)</Label>
                      <Input
                        id="programCategories"
                        value={newProgramData.categories}
                        onChange={(e) => setNewProgramData({ ...newProgramData, categories: e.target.value })}
                        placeholder="e.g., Explorer, Discoverer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Comma-separated list of categories for this program</p>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsCreateProgramOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Create Program</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 xl:gap-10">
            {(programs ?? []).map((program, index) => {
              const stats = { total: programStats[String(program._id)] ?? 0 };
              return (
                <motion.div
                  key={program._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
                    onClick={() => {
                      setSelectedProgramId(program._id as Id<"programs">);
                      setCategoryFilter("all");
                      setSubjectFilter("all");
                      setKitSearchQuery("");
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="flex items-center gap-2">
                          <Box className="h-6 w-6" />
                          {program.name}
                        </CardTitle>
                        {(canEditPrograms || canDeletePrograms) && (
                          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {canEditPrograms && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProgram(program);
                                }}
                                title="Edit Program"
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeletePrograms && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProgram(program._id as Id<"programs">, program.name);
                                }}
                                title="Delete Program"
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {program.description && <p className="text-xs text-muted-foreground mt-1">{program.description}</p>}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Kits</p>
                          <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Dialog open={isEditProgramOpen} onOpenChange={setIsEditProgramOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Program</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateProgram} className="space-y-4">
                <div>
                  <Label htmlFor="editProgramName">Program Name</Label>
                  <Input
                    id="editProgramName"
                    value={editProgramData.name}
                    onChange={(e) => setEditProgramData({ ...editProgramData, name: e.target.value })}
                    placeholder="e.g., Electronics, Mechanics"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editProgramDescription">Description (optional)</Label>
                  <Textarea
                    id="editProgramDescription"
                    value={editProgramData.description}
                    onChange={(e) => setEditProgramData({ ...editProgramData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="editProgramCategories">Categories (optional)</Label>
                  <Input
                    id="editProgramCategories"
                    value={editProgramData.categories}
                    onChange={(e) => setEditProgramData({ ...editProgramData, categories: e.target.value })}
                    placeholder="e.g., Explorer, Discoverer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Comma-separated list of categories for this program
                  </p>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditProgramOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Update Program</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  // Kit Design view
  return (
    <Layout>
      {/* Add horizontal padding consistently in kit design view too */}
      <div className="px-4 sm:px-6 lg:px-10 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProgramId(null);
                setCategoryFilter("all");
                setSubjectFilter("all");
                setKitSearchQuery("");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Programs
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {selectedProgram?.name || "Program"} - Kit Design
              </h1>
              <p className="text-muted-foreground mt-2">Manage kit blueprints and design assets</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selectedProgram?.categories && selectedProgram.categories.length > 0 && (
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={categoryFilter} onValueChange={(v: string) => setCategoryFilter(v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {selectedProgram.categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {uniqueSubjects.length > 0 && (
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Select value={subjectFilter} onValueChange={(v: string) => setSubjectFilter(v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All subjects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {uniqueSubjects.map((subj) => (
                          <SelectItem key={subj} value={subj}>
                            {subj}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Search Kits</Label>
                  <Input
                    placeholder="Search by kit name..."
                    value={kitSearchQuery}
                    onChange={(e) => setKitSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {canCreateKits && (
              <>
                <Button onClick={() => navigate(`/kit-builder?program=${selectedProgramId}`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Kit Builder
                </Button>

                <Dialog
                  open={isCreateSimpleKitOpen}
                  onOpenChange={(open) => {
                    setIsCreateSimpleKitOpen(open);
                    if (!open) {
                      setEditingKit(null);
                      setSimpleKitFormData({ name: "", serialNumber: "", category: undefined, conceptName: "", subject: "", description: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Simple Kit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingKit ? "Edit Kit" : "Create Simple Kit"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateSimpleKit} className="space-y-4">
                      <div>
                        <Label htmlFor="kitName">Kit Name</Label>
                        <Input
                          id="kitName"
                          value={simpleKitFormData.name}
                          onChange={(e) => setSimpleKitFormData({ ...simpleKitFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="serialNumber">Kit Number</Label>
                          <Input
                            id="serialNumber"
                            value={simpleKitFormData.serialNumber}
                            onChange={(e) => setSimpleKitFormData({ ...simpleKitFormData, serialNumber: e.target.value })}
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Label htmlFor="conceptName">Concept Name</Label>
                          <Input
                            id="conceptName"
                            value={simpleKitFormData.conceptName}
                            onChange={(e) => setSimpleKitFormData({ ...simpleKitFormData, conceptName: e.target.value })}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedProgram?.categories && selectedProgram.categories.length > 0 && (
                          <div>
                            <Label htmlFor="category">Category</Label>
                            <Select
                              value={simpleKitFormData.category || ""}
                              onValueChange={(value: string) =>
                                setSimpleKitFormData({ ...simpleKitFormData, category: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedProgram.categories.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div>
                          <Label htmlFor="subject">Subject</Label>
                          <Input
                            id="subject"
                            value={simpleKitFormData.subject}
                            onChange={(e) => setSimpleKitFormData({ ...simpleKitFormData, subject: e.target.value })}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={simpleKitFormData.description}
                          onChange={(e) => setSimpleKitFormData({ ...simpleKitFormData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsCreateSimpleKitOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">{editingKit ? "Update" : "Create"} Kit</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Table View */}
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kit No.</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Concept Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kit Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Subject</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKits.map((kit, index) => {
                  const isExpanded = expandedKitId === kit._id;
                  return (
                    <React.Fragment key={kit._id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedKitId(isExpanded ? null : kit._id)}
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground">{kit.serialNumber || "-"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{kit.conceptName || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            {kit.name}
                            {typeof kit.lowStockThreshold === "number" && kit.stockCount <= kit.lowStockThreshold && (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {kit.category ? kit.category.toUpperCase() : "UNCATEGORIZED"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{kit.subject || "-"}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex space-x-1">
                            {canUploadImages && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" title="Upload Files">
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-sm">
                                  <DialogHeader>
                                    <DialogTitle>Upload Files for '{kit.name}'</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-2">
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() => setFileManager({ kitId: kit._id, fileType: "kitImage" })}
                                    >
                                      <ImageIcon className="h-4 w-4 mr-2" />
                                      Kit Image
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() => setFileManager({ kitId: kit._id, fileType: "laser" })}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Laser Files
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() => setFileManager({ kitId: kit._id, fileType: "component" })}
                                    >
                                      <ImageIcon className="h-4 w-4 mr-2" />
                                      Component Pictures
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() => setFileManager({ kitId: kit._id, fileType: "workbook" })}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Workbooks & Misc
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}

                            {canCloneKits && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCloneKit(kit)}
                                title="Clone Kit"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}

                            {canEditKits && (
                              <Button variant="ghost" size="sm" onClick={() => handleEditKit(kit)} title="Edit Kit">
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}

                            {canDeleteKits && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteKit(kit._id)}
                                title="Delete Kit"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadKitSheet(kit._id)}
                              title="Download Kit Sheet"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>

                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="space-y-4">
                              {kit.description && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Description:</span>
                                  <p className="text-sm mt-1">{kit.description}</p>
                                </div>
                              )}

                              <div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {kit.isStructured ? "Pouches & Packets" : "Materials (unstructured)"}
                                </span>
                                {kit.isStructured ? (
                                  <StructuredMaterials packingRequirements={kit.packingRequirements} inventory={inventory} />
                                ) : kit.packingRequirements && kit.packingRequirements.trim().length > 0 ? (
                                  <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
                                    {kit.packingRequirements
                                      .split(",")
                                      .map((s: string) => s.trim())
                                      .filter((s: string) => s.length > 0)
                                      .map((item: string, idx: number) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                  </ul>
                                ) : (
                                  <div className="text-sm text-muted-foreground mt-2">No materials specified.</div>
                                )}
                              </div>

                              {kit.spareKits && kit.spareKits.filter((s: any) => s.name && s.name.trim()).length > 0 && (
                                <div>
                                  <div className="text-sm font-semibold mb-2 text-primary">Spare Kits</div>
                                  <div className="space-y-2">
                                    {kit.spareKits.filter((s: any) => s.name && s.name.trim()).map((spare: any, idx: number) => (
                                      <div key={idx} className="border rounded p-3 bg-background">
                                        <div className="font-medium text-sm">{spare.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">Quantity: {spare.quantity}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {kit.bulkMaterials && kit.bulkMaterials.filter((b: any) => b.name && b.name.trim()).length > 0 && (
                                <div>
                                  <div className="text-sm font-semibold mb-2 text-primary">Bulk Materials</div>
                                  <div className="space-y-2">
                                    {kit.bulkMaterials.filter((b: any) => b.name && b.name.trim()).map((bulk: any, idx: number) => (
                                      <div key={idx} className="border rounded p-3 bg-background">
                                        <div className="font-medium text-sm">{bulk.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Quantity: {bulk.quantity} {bulk.unit}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {kit.miscellaneous && kit.miscellaneous.length > 0 && (
                                <div>
                                  <div className="text-sm font-semibold mb-2 text-primary">Miscellaneous Items</div>
                                  <div className="space-y-2">
                                    {kit.miscellaneous.map((misc: any, idx: number) => (
                                      <div key={idx} className="border rounded p-3 bg-background">
                                        <div className="font-medium text-sm">{misc.name}</div>
                                        {misc.notes && (
                                          <div className="text-xs text-muted-foreground mt-1 italic">{misc.notes}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredKits.length === 0 && (
          <div className="text-center py-12">
            <Box className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No kits found</h3>
            <p className="text-muted-foreground">Create your first kit blueprint to get started.</p>
          </div>
        )}
      </div>

      {/* Clone Kit Dialog */}
      <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Kit: {cloneKitData.kitName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitClone} className="space-y-4">
            <div>
              <Label htmlFor="cloneNewName">New Kit Name</Label>
              <Input
                id="cloneNewName"
                value={cloneKitData.newName}
                onChange={(e) => setCloneKitData({ ...cloneKitData, newName: e.target.value })}
                placeholder="Enter new kit name"
                required
              />
            </div>
            <div>
              <Label htmlFor="cloneTargetProgram">Target Program</Label>
              <Select
                value={cloneKitData.targetProgramId}
                onValueChange={(value) => setCloneKitData({ ...cloneKitData, targetProgramId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target program" />
                </SelectTrigger>
                <SelectContent>
                  {(programs ?? []).map((program) => (
                    <SelectItem key={program._id} value={program._id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCloneDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Clone Kit</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {fileManager && (() => {
        const kit = kits?.find((k) => k._id === fileManager.kitId);
        if (!kit) return null;
        
        const fieldMap = {
          kitImage: kit.kitImageFiles || [],
          laser: kit.laserFiles || [],
          component: kit.componentFiles || [],
          workbook: kit.workbookFiles || []
        };
        
        return (
          <ResearchFileManager
            kitId={fileManager.kitId}
            fileType={fileManager.fileType}
            open={true}
            onOpenChange={(open) => {
              if (!open) setFileManager(null);
            }}
            currentFiles={fieldMap[fileManager.fileType]}
          />
        );
      })()}
    </Layout>
  );
}