import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Download,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  File,
  Eye,
  Calculator,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements } from "@/lib/kitPacking";

export default function KitStatistics() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const canView = hasPermission("programs", "view");
  const canViewCapacityPricing = hasPermission("kitStatistics", "viewCapacityPricing");
  const canViewFiles = hasPermission("kitStatistics", "viewFiles");

  const programs = useQuery(api.programs.list);
  const allKits = useQuery(api.kits.list);
  const inventory = useQuery(api.inventory.list);
  const updateKit = useMutation(api.kits.update);

  const [selectedProgramId, setSelectedProgramId] = useState<Id<"programs"> | null>(null);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [fileViewerDialog, setFileViewerDialog] = useState<{
    open: boolean;
    kitId: Id<"kits"> | null;
    kitName: string;
  }>({
    open: false,
    kitId: null,
    kitName: "",
  });
  const [capacityDialog, setCapacityDialog] = useState<{
    open: boolean;
    kitId: Id<"kits"> | null;
    kitName: string;
  }>({
    open: false,
    kitId: null,
    kitName: "",
  });
  const [editStockDialog, setEditStockDialog] = useState<{
    open: boolean;
    kitId: Id<"kits"> | null;
    kitName: string;
  }>({
    open: false,
    kitId: null,
    kitName: "",
  });
  const [newStockCount, setNewStockCount] = useState<number>(0);

  // Filter states
  const [kitNameFilter, setKitNameFilter] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [fileStatusFilters, setFileStatusFilters] = useState({
    kitImages: false,
    laserFiles: false,
    componentPictures: false,
    workbooks: false,
  });

  const downloadKitSheet = useAction(api.kitPdf.generateKitSheet);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (!canView) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const toggleKitExpansion = (kitId: string) => {
    const newExpanded = new Set(expandedKits);
    if (newExpanded.has(kitId)) {
      newExpanded.delete(kitId);
    } else {
      newExpanded.add(kitId);
    }
    setExpandedKits(newExpanded);
  };

  const handleDownloadKitSheet = async (kitId: Id<"kits">, kitName: string) => {
    try {
      toast.info("Generating kit sheet...");
      const result = await downloadKitSheet({ kitId });
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kitName.replace(/\s+/g, "-")}-sheet.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Kit sheet downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate kit sheet");
    }
  };

  const handleEditStock = (kit: any) => {
    setEditStockDialog({
      open: true,
      kitId: kit._id,
      kitName: kit.name,
    });
    setNewStockCount(kit.stockCount || 0);
  };

  const handleUpdateStock = async () => {
    if (!editStockDialog.kitId) return;
    
    try {
      await updateKit({
        id: editStockDialog.kitId,
        stockCount: newStockCount,
      });
      toast.success("Stock count updated successfully");
      setEditStockDialog({ open: false, kitId: null, kitName: "" });
    } catch (error) {
      toast.error("Failed to update stock count");
    }
  };

  const clearFilters = () => {
    setKitNameFilter("");
    setSelectedCategories([]);
    setFileStatusFilters({
      kitImages: false,
      laserFiles: false,
      componentPictures: false,
      workbooks: false,
    });
  };

  const hasActiveFilters = 
    kitNameFilter !== "" || 
    selectedCategories.length > 0 || 
    fileStatusFilters.kitImages || 
    fileStatusFilters.laserFiles || 
    fileStatusFilters.componentPictures || 
    fileStatusFilters.workbooks;

  // Program Selection View
  if (!selectedProgramId) {
    return (
      <Layout>
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kit Statistics</h1>
              <p className="text-muted-foreground mt-2">
                View detailed kit information, components, and download files
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs?.map((program) => {
                const programKits = allKits?.filter((k) => k.programId === program._id) || [];
                return (
                  <motion.div
                    key={program._id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setSelectedProgramId(program._id)}
                    >
                      <CardHeader>
                        <CardTitle>{program.name}</CardTitle>
                        <CardDescription>
                          {program.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{programKits.length} kits</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const selectedProgram = programs?.find((p) => p._id === selectedProgramId);
  const programKits = allKits?.filter((k) => k.programId === selectedProgramId) || [];

  // Get unique categories for the filter
  const uniqueCategories = Array.from(
    new Set(programKits.map((k) => k.category).filter(Boolean))
  ) as string[];

  // Apply filters
  const filteredKits = programKits.filter((kit) => {
    // Kit name filter
    if (kitNameFilter && !kit.name.toLowerCase().includes(kitNameFilter.toLowerCase())) {
      return false;
    }

    // Category filter
    if (selectedCategories.length > 0 && !selectedCategories.includes(kit.category || "")) {
      return false;
    }

    // File status filters (AND logic)
    if (fileStatusFilters.kitImages) {
      if (!kit.kitImageFiles || kit.kitImageFiles.length === 0) {
        return false;
      }
    }

    if (fileStatusFilters.laserFiles) {
      if (!kit.laserFiles || kit.laserFiles.length === 0) {
        return false;
      }
    }

    if (fileStatusFilters.componentPictures) {
      if (!kit.componentFiles || kit.componentFiles.length === 0) {
        return false;
      }
    }

    if (fileStatusFilters.workbooks) {
      if (!kit.workbookFiles || kit.workbookFiles.length === 0) {
        return false;
      }
    }

    return true;
  });

  // Kit Statistics View
  return (
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedProgramId(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {selectedProgram?.name} - Kit Statistics
              </h1>
              <p className="text-muted-foreground mt-2">
                {filteredKits.length} of {programKits.length} kits
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filters</CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Kit Name Filter */}
                <div className="space-y-2">
                  <Label htmlFor="kit-name-filter">Kit Name</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="kit-name-filter"
                      placeholder="Search kit name..."
                      value={kitNameFilter}
                      onChange={(e) => setKitNameFilter(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryPopoverOpen}
                        className="w-full justify-between"
                      >
                        {selectedCategories.length > 0
                          ? `${selectedCategories.length} selected`
                          : "Select categories..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                      <Command>
                        <CommandInput placeholder="Search category..." />
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {uniqueCategories.map((category) => (
                            <CommandItem
                              key={category}
                              onSelect={() => {
                                setSelectedCategories((prev) =>
                                  prev.includes(category)
                                    ? prev.filter((c) => c !== category)
                                    : [...prev, category]
                                );
                              }}
                            >
                              <Checkbox
                                checked={selectedCategories.includes(category)}
                                className="mr-2"
                              />
                              {category}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* File Status Filters */}
                <div className="space-y-2 lg:col-span-2">
                  <Label>File Status (Show kits with)</Label>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-kit-images"
                        checked={fileStatusFilters.kitImages}
                        onCheckedChange={(checked) =>
                          setFileStatusFilters((prev) => ({
                            ...prev,
                            kitImages: checked as boolean,
                          }))
                        }
                      />
                      <label
                        htmlFor="filter-kit-images"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Kit Images
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-laser-files"
                        checked={fileStatusFilters.laserFiles}
                        onCheckedChange={(checked) =>
                          setFileStatusFilters((prev) => ({
                            ...prev,
                            laserFiles: checked as boolean,
                          }))
                        }
                      />
                      <label
                        htmlFor="filter-laser-files"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Laser Files
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-component-pictures"
                        checked={fileStatusFilters.componentPictures}
                        onCheckedChange={(checked) =>
                          setFileStatusFilters((prev) => ({
                            ...prev,
                            componentPictures: checked as boolean,
                          }))
                        }
                      />
                      <label
                        htmlFor="filter-component-pictures"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Component Pictures
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-workbooks"
                        checked={fileStatusFilters.workbooks}
                        onCheckedChange={(checked) =>
                          setFileStatusFilters((prev) => ({
                            ...prev,
                            workbooks: checked as boolean,
                          }))
                        }
                      />
                      <label
                        htmlFor="filter-workbooks"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Workbooks
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kits Table */}
          <Card>
            <CardHeader>
              <CardTitle>Kits Overview</CardTitle>
              <CardDescription>
                View kit details, components, and download files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Kit No.</TableHead>
                    <TableHead>Kit Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>File Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKits.map((kit, index) => {
                    const isExpanded = expandedKits.has(kit._id);
                    const structure = kit.isStructured && kit.packingRequirements
                      ? parsePackingRequirements(kit.packingRequirements)
                      : { pouches: [], packets: [] };

                    return (
                      <Collapsible
                        key={kit._id}
                        open={isExpanded}
                        onOpenChange={() => toggleKitExpansion(kit._id)}
                        asChild
                      >
                        <>
                          <TableRow>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">
                              {kit.serialNumber || index + 1}
                            </TableCell>
                            <TableCell>{kit.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{kit.category || "-"}</Badge>
                            </TableCell>
                            <TableCell>{selectedProgram?.name}</TableCell>
                            <TableCell>
                              <Badge variant={kit.stockCount > 0 ? "default" : "secondary"}>
                                {kit.stockCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Badge 
                                  variant={kit.kitImageFiles && kit.kitImageFiles.length > 0 ? "default" : "outline"}
                                  className="text-xs"
                                  title="Kit Images"
                                >
                                  <ImageIcon className="h-3 w-3" />
                                </Badge>
                                <Badge 
                                  variant={kit.laserFiles && kit.laserFiles.length > 0 ? "default" : "outline"}
                                  className="text-xs"
                                  title="Laser Files"
                                >
                                  <FileText className="h-3 w-3" />
                                </Badge>
                                <Badge 
                                  variant={kit.componentFiles && kit.componentFiles.length > 0 ? "default" : "outline"}
                                  className="text-xs"
                                  title="Component Pictures"
                                >
                                  <File className="h-3 w-3" />
                                </Badge>
                                <Badge 
                                  variant={kit.workbookFiles && kit.workbookFiles.length > 0 ? "default" : "outline"}
                                  className="text-xs"
                                  title="Workbooks"
                                >
                                  <FileText className="h-3 w-3" />
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadKitSheet(kit._id, kit.name)}
                                  title="Download Kit Sheet"
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  Sheet
                                </Button>
                                {canViewFiles && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setFileViewerDialog({
                                        open: true,
                                        kitId: kit._id,
                                        kitName: kit.name,
                                      });
                                    }}
                                    title="View Kit Files"
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Files
                                  </Button>
                                )}
                                {canViewCapacityPricing && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setCapacityDialog({
                                        open: true,
                                        kitId: kit._id,
                                        kitName: kit.name,
                                      });
                                    }}
                                    title="Capacity & Pricing"
                                  >
                                    <Calculator className="h-4 w-4 mr-1" />
                                    Capacity
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/50">
                                <div className="p-4 space-y-4">
                                  <h4 className="font-semibold text-sm">Bill of Materials (BOM)</h4>
                                  
                                  {/* Main Pouches */}
                                  {structure.pouches.length > 0 && (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-muted-foreground">Main Pouches</h5>
                                      {structure.pouches.map((pouch, idx) => (
                                        <div key={idx} className="ml-4 space-y-1">
                                          <p className="text-sm font-medium">{pouch.name}</p>
                                          <div className="ml-4 space-y-1">
                                            {pouch.materials.map((mat, matIdx) => (
                                              <p key={matIdx} className="text-xs text-muted-foreground">
                                                • {mat.name}: {mat.quantity} {mat.unit}
                                                {mat.notes && ` (${mat.notes})`}
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Sealed Packets */}
                                  {structure.packets.length > 0 && (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-muted-foreground">Sealed Packets</h5>
                                      {structure.packets.map((packet, idx) => (
                                        <div key={idx} className="ml-4 space-y-1">
                                          <p className="text-sm font-medium">{packet.name}</p>
                                          <div className="ml-4 space-y-1">
                                            {packet.materials.map((mat, matIdx) => (
                                              <p key={matIdx} className="text-xs text-muted-foreground">
                                                • {mat.name}: {mat.quantity} {mat.unit}
                                                {mat.notes && ` (${mat.notes})`}
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Spare Kits */}
                                  {kit.spareKits && kit.spareKits.length > 0 && (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-muted-foreground">Spare Kits</h5>
                                      <div className="ml-4 space-y-1">
                                        {kit.spareKits.map((spare, idx) => (
                                          <p key={idx} className="text-xs text-muted-foreground">
                                            • {spare.name}: {spare.quantity} {spare.unit}
                                            {spare.notes && ` (${spare.notes})`}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bulk Materials */}
                                  {kit.bulkMaterials && kit.bulkMaterials.length > 0 && (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-muted-foreground">Bulk Materials</h5>
                                      <div className="ml-4 space-y-1">
                                        {kit.bulkMaterials.map((bulk, idx) => (
                                          <p key={idx} className="text-xs text-muted-foreground">
                                            • {bulk.name}: {bulk.quantity} {bulk.unit}
                                            {bulk.notes && ` (${bulk.notes})`}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Miscellaneous */}
                                  {kit.miscellaneous && kit.miscellaneous.length > 0 && (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-muted-foreground">Miscellaneous</h5>
                                      <div className="ml-4 space-y-1">
                                        {kit.miscellaneous.map((misc, idx) => (
                                          <p key={idx} className="text-xs text-muted-foreground">
                                            • {misc.name}: {misc.quantity} {misc.unit}
                                            {misc.notes && ` (${misc.notes})`}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Show message if no BOM data */}
                                  {structure.pouches.length === 0 &&
                                    structure.packets.length === 0 &&
                                    (!kit.spareKits || kit.spareKits.length === 0) &&
                                    (!kit.bulkMaterials || kit.bulkMaterials.length === 0) &&
                                    (!kit.miscellaneous || kit.miscellaneous.length === 0) && (
                                      <p className="text-sm text-muted-foreground">
                                        No BOM data available for this kit
                                      </p>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* File Viewer Dialog */}
      <Dialog open={fileViewerDialog.open} onOpenChange={(open) => !open && setFileViewerDialog({ open: false, kitId: null, kitName: "" })}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Kit Files: {fileViewerDialog.kitName}</DialogTitle>
          </DialogHeader>
          {fileViewerDialog.kitId && <KitFileViewer kitId={fileViewerDialog.kitId} />}
        </DialogContent>
      </Dialog>

      {/* Capacity & Pricing Dialog */}
      <Dialog
        open={capacityDialog.open}
        onOpenChange={(open) =>
          !open && setCapacityDialog({ open: false, kitId: null, kitName: "" })
        }
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Capacity & Pricing: {capacityDialog.kitName}</DialogTitle>
          </DialogHeader>
          {capacityDialog.kitId && (
            <CapacityPricingDialog
              kit={programKits.find((k) => k._id === capacityDialog.kitId)}
              inventory={inventory || []}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function KitFileViewer({ kitId }: { kitId: Id<"kits"> }) {
  const kit = useQuery(api.kits.get, { id: kitId });

  if (!kit) return <div className="text-center py-8">Loading...</div>;

  const fileCategories = [
    { label: "Kit Images", files: kit.kitImageFiles || [] },
    { label: "Laser Files", files: kit.laserFiles || [] },
    { label: "Component Pictures", files: kit.componentFiles || [] },
    { label: "Workbooks & Misc", files: kit.workbookFiles || [] },
  ];

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      {fileCategories.map((category) => (
        <div key={category.label}>
          <h3 className="text-sm font-semibold mb-3">{category.label}</h3>
          {category.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files uploaded</p>
          ) : (
            <div className="space-y-2">
              {category.files.map((file: any, idx: number) => (
                <FileItem key={idx} file={file} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FileItem({ file }: { file: any }) {
  const getFileUrl = useQuery(api.kits.getFileUrl, 
    file.type === "storage" && file.storageId ? { storageId: file.storageId } : "skip"
  );

  if (file.type === "link") {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <span className="text-sm truncate flex-1">{file.name}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(file.url, "_blank")}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </div>
    );
  }

  if (file.type === "storage" && getFileUrl) {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <span className="text-sm truncate flex-1">File {file.storageId}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(getFileUrl, "_blank")}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    );
  }

  return null;
}

function CapacityPricingDialog({
  kit,
  inventory,
}: {
  kit: any;
  inventory: Array<any>;
}) {
  const vendorImports = useQuery(api.vendorImports.list);
  const vendors = useQuery(api.vendors.list);

  if (!kit || !vendorImports || !vendors) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-foreground" />
      </div>
    );
  }

  // Build a normalized BOM aggregated by name
  const buildAggregatedBOM = () => {
    const agg = new Map<string, { name: string; quantity: number; unit: string }>();

    const addLine = (name: string, qty: number, unit: string) => {
      const key = name.trim().toLowerCase();
      const existing = agg.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        agg.set(key, { name, quantity: qty, unit });
      }
    };

    // From structured packing requirements
    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      for (const pouch of structure.pouches || []) {
        for (const m of pouch.materials || []) {
          addLine(m.name, m.quantity, m.unit);
        }
      }
      for (const packet of structure.packets || []) {
        for (const m of packet.materials || []) {
          addLine(m.name, m.quantity, m.unit);
        }
      }
    }

    // From spareKits, bulkMaterials, miscellaneous
    const extraSets = [kit.spareKits || [], kit.bulkMaterials || [], kit.miscellaneous || []];
    for (const arr of extraSets) {
      for (const m of arr) {
        addLine(m.name, m.quantity, m.unit);
      }
    }

    return Array.from(agg.values());
  };

  const bom = buildAggregatedBOM();

  // Precompute price candidates by inventoryId
  const importPricesByItem: Record<string, Array<number>> = {};
  for (const imp of vendorImports) {
    for (const it of imp.items) {
      const key = it.inventoryId;
      if (!importPricesByItem[key]) importPricesByItem[key] = [];
      importPricesByItem[key].push(it.unitPrice);
    }
  }

  const vendorAvgPricesByItem: Record<string, Array<number>> = {};
  for (const v of vendors) {
    const prices = v.itemPrices || [];
    for (const p of prices) {
      const key = p.itemId;
      if (!vendorAvgPricesByItem[key]) vendorAvgPricesByItem[key] = [];
      vendorAvgPricesByItem[key].push(p.averagePrice);
    }
  }

  // Helpers
  const findInventoryMatches = (name: string) => {
    const key = name.trim().toLowerCase();
    return (inventory || []).filter((i) => (i.name || "").trim().toLowerCase() === key);
  };

  const chooseForCapacity = (matches: Array<any>) => {
    if (matches.length === 0) return null;
    const sealed = matches.filter((m) => m.type === "sealed_packet");
    const pool = sealed.length > 0 ? sealed : matches;
    return pool.reduce((a, b) => (a.quantity >= b.quantity ? a : b));
  };

  const collectPriceCandidates = (matches: Array<any>): Array<number> => {
    const prices: Array<number> = [];
    for (const m of matches) {
      const id = m._id;
      const ip = importPricesByItem[String(id)] || [];
      const vp = vendorAvgPricesByItem[String(id)] || [];
      for (const v of ip) prices.push(v);
      for (const v of vp) prices.push(v);
    }
    return prices;
  };

  // Compute capacity and costs
  type LineResult = {
    name: string;
    unit: string;
    perKitQty: number;
    available: number;
    kitsPossibleForLine: number;
    hasMatch: boolean;
    minUnitPrice?: number;
    maxUnitPrice?: number;
    minLineCost?: number;
    maxLineCost?: number;
  };

  const lineResults: Array<LineResult> = bom.map((line) => {
    const matches = findInventoryMatches(line.name);
    const capItem = chooseForCapacity(matches);
    const available = capItem ? Number(capItem.quantity || 0) : 0;
    const kitsPossibleForLine = line.quantity > 0 ? Math.floor(available / line.quantity) : Infinity;

    const priceCandidates = collectPriceCandidates(matches);
    const minUnitPrice = priceCandidates.length > 0 ? Math.min(...priceCandidates) : undefined;
    const maxUnitPrice = priceCandidates.length > 0 ? Math.max(...priceCandidates) : undefined;

    const minLineCost =
      minUnitPrice !== undefined ? Number((line.quantity * minUnitPrice).toFixed(2)) : undefined;
    const maxLineCost =
      maxUnitPrice !== undefined ? Number((line.quantity * maxUnitPrice).toFixed(2)) : undefined;

    return {
      name: line.name,
      unit: line.unit,
      perKitQty: line.quantity,
      available,
      kitsPossibleForLine: Number.isFinite(kitsPossibleForLine) ? kitsPossibleForLine : 0,
      hasMatch: matches.length > 0,
      minUnitPrice,
      maxUnitPrice,
      minLineCost,
      maxLineCost,
    };
  });

  const anyShort = lineResults.some((r) => r.available < r.perKitQty);
  const maxKits = lineResults.length > 0 ? Math.min(...lineResults.map((r) => r.kitsPossibleForLine)) : 0;
  const minKits = anyShort ? 0 : maxKits;

  const totalMinCost = lineResults
    .filter((r) => r.minLineCost !== undefined)
    .reduce((sum, r) => sum + (r.minLineCost as number), 0);
  const totalMaxCost = lineResults
    .filter((r) => r.maxLineCost !== undefined)
    .reduce((sum, r) => sum + (r.maxLineCost as number), 0);
  const missingCostCount = lineResults.filter((r) => r.minUnitPrice === undefined || r.maxUnitPrice === undefined).length;

  const shortages = lineResults
    .filter((r) => r.available < r.perKitQty)
    .map((r) => ({
      name: r.name,
      required: r.perKitQty,
      available: r.available,
      unit: r.unit,
      shortage: Number((r.perKitQty - r.available).toFixed(2)),
    }));

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <p className="text-xs text-muted-foreground">Max Kits (strict)</p>
          <p className="text-2xl font-bold">{isFinite(maxKits) ? maxKits : 0}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-xs text-muted-foreground">Min Kits (strict)</p>
          <p className="text-2xl font-bold">{isFinite(minKits) ? minKits : 0}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-xs text-muted-foreground">Cost Range per Kit (INR)</p>
          <p className="text-lg font-semibold">
            {missingCostCount > 0 ? (
              <span>
                ₹{totalMinCost.toFixed(2)} - ₹{totalMaxCost.toFixed(2)}{" "}
                <span className="text-xs text-muted-foreground">(incomplete)</span>
              </span>
            ) : (
              <>₹{totalMinCost.toFixed(2)} - ₹{totalMaxCost.toFixed(2)}</>
            )}
          </p>
        </div>
      </div>

      {/* Shortages */}
      {shortages.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Shortages</h3>
          <div className="space-y-1">
            {shortages.map((s, idx) => (
              <div key={idx} className="text-sm text-muted-foreground">
                • {s.name}: need {s.required} {s.unit}, have {s.available} {s.unit} (short {s.shortage} {s.unit})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Per-line Breakdown</h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Per Kit</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Kits by Item</TableHead>
                <TableHead>Min Unit</TableHead>
                <TableHead>Max Unit</TableHead>
                <TableHead>Min Line</TableHead>
                <TableHead>Max Line</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineResults.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    {r.perKitQty} {r.unit}
                  </TableCell>
                  <TableCell>
                    {r.available} {r.unit}
                  </TableCell>
                  <TableCell>{r.kitsPossibleForLine}</TableCell>
                  <TableCell>
                    {r.minUnitPrice !== undefined ? `₹${r.minUnitPrice.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {r.maxUnitPrice !== undefined ? `₹${r.maxUnitPrice.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {r.minLineCost !== undefined ? `₹${r.minLineCost.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {r.maxLineCost !== undefined ? `₹${r.maxLineCost.toFixed(2)}` : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {missingCostCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Note: {missingCostCount} line(s) missing cost data. Totals computed from known costs only.
          </p>
        )}
      </div>
    </div>
  );
}