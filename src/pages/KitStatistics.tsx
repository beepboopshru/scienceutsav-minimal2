import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useAction } from "convex/react";
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
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements } from "@/lib/kitPacking";

export default function KitStatistics() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const programs = useQuery(api.programs.list);
  const allKits = useQuery(api.kits.list);
  const inventory = useQuery(api.inventory.list);

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

  const downloadKitSheet = useAction(api.kitPdf.generateKitSheet);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

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
                {programKits.length} kits in this program
              </p>
            </div>
          </div>

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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programKits.map((kit, index) => {
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
                              </div>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/50">
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