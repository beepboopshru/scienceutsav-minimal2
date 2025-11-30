import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Package, Download, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialRequestsTab } from "@/components/inventory/MaterialRequestsTab";

export default function OperationsInventoryRelations() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  
  const canViewPacking = hasPermission("procurementJobs", "view");
  const canEditPacking = hasPermission("procurementJobs", "edit");
  const canViewMaterialRequests = hasPermission("materialRequests", "view");
  
  const procurementJobs = useQuery(api.procurementJobs.list, canViewPacking ? undefined : "skip");
  const assignments = useQuery(api.assignments.listAll, canViewPacking ? undefined : "skip");
  const kits = useQuery(api.kits.list, canViewPacking ? undefined : "skip");
  const clients = useQuery(api.clients.list, canViewPacking ? undefined : "skip");
  const b2cClients = useQuery(api.b2cClients.list, canViewPacking ? undefined : "skip");
  
  const updateStatus = useMutation(api.procurementJobs.updateStatus);
  const updatePriority = useMutation(api.procurementJobs.updatePriority);
  const updateNotes = useMutation(api.procurementJobs.updateNotes);
  const removeJob = useMutation(api.procurementJobs.remove);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesDialog, setNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<Set<Id<"procurementJobs">>>(new Set());

  const inventory = useQuery(api.inventory.list, canViewPacking ? undefined : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (!canViewPacking && !canViewMaterialRequests) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  const isPackingLoading = canViewPacking && (!procurementJobs || !assignments || !kits || !inventory);

  if (isLoading || isPackingLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const getExplodedShortages = (job: any) => {
    if (!inventory) return job.materialShortages;

    const inventoryMap = new Map(inventory.map(item => [item._id, item]));
    const inventoryByName = new Map(inventory.map(item => [item.name, item]));
    const requirementsMap = new Map<string, any>();

    const processShortage = (itemName: string, qtyNeeded: number) => {
      const item = inventoryByName.get(itemName);
      
      if (item && item.components && item.components.length > 0) {
        item.components.forEach(comp => {
          const rawItem = inventoryMap.get(comp.rawMaterialId);
          if (rawItem) {
            processShortage(rawItem.name, qtyNeeded * comp.quantityRequired);
          }
        });
      } else {
        const key = itemName;
        if (!requirementsMap.has(key)) {
          requirementsMap.set(key, {
            name: itemName,
            subcategory: item?.subcategory || "Uncategorized",
            description: item?.description || "N/A",
            inventoryType: item?.type || "N/A",
            unit: item?.unit || "units",
            requiredQty: 0,
            currentStock: item?.quantity || 0,
          });
        }
        const req = requirementsMap.get(key)!;
        req.requiredQty += qtyNeeded;
      }
    };

    job.materialShortages.forEach((mat: any) => {
      if (mat.required > 0) {
        processShortage(mat.name, mat.required);
      }
    });

    return Array.from(requirementsMap.values()).map(req => ({
      ...req,
      shortage: Math.max(0, req.requiredQty - req.currentStock),
      category: req.subcategory 
    })).sort((a, b) => a.subcategory.localeCompare(b.subcategory) || a.name.localeCompare(b.name));
  };

  const filteredJobs = procurementJobs ? procurementJobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    if (priorityFilter !== "all" && job.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      const jobIdMatch = job.jobId.toLowerCase().includes(searchLower);
      const creatorMatch = job.creatorName?.toLowerCase().includes(searchLower);
      if (!jobIdMatch && !creatorMatch) return false;
    }
    return true;
  }) : [];

  const handleStatusChange = (jobId: Id<"procurementJobs">, newStatus: string) => {
    updateStatus({ id: jobId, status: newStatus as any })
      .then(() => {
        toast.success("Status updated successfully");
      })
      .catch((error) => {
        toast.error("Failed to update status", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      });
  };

  const handlePriorityChange = (jobId: Id<"procurementJobs">, newPriority: string) => {
    updatePriority({ id: jobId, priority: newPriority as any })
      .then(() => {
        toast.success("Priority updated successfully");
      })
      .catch((error) => {
        toast.error("Failed to update priority", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      });
  };

  const handleNotesUpdate = async () => {
    if (!selectedJob) return;
    try {
      await updateNotes({ id: selectedJob._id, notes: editingNotes });
      toast.success("Notes updated successfully");
      setNotesDialog(false);
      setSelectedJob(null);
    } catch (error) {
      toast.error("Failed to update notes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDeleteJob = async (jobId: Id<"procurementJobs">) => {
    if (!confirm("Are you sure you want to delete this procurement job?")) return;
    try {
      await removeJob({ id: jobId });
      toast.success("Procurement job deleted");
    } catch (error) {
      toast.error("Failed to delete job", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const exportJobToPDF = (job: any) => {
    const doc = new jsPDF();
    const explodedMaterials = getExplodedShortages(job);
    
    doc.setFontSize(18);
    doc.text("Procurement Job Details", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Job ID: ${job.jobId}`, 14, 30);
    doc.text(`Created By: ${job.creatorName}`, 14, 37);
    doc.text(`Created On: ${new Date(job._creationTime).toLocaleDateString()}`, 14, 44);
    doc.text(`Status: ${job.status.toUpperCase()}`, 14, 51);
    doc.text(`Priority: ${job.priority.toUpperCase()}`, 14, 58);
    
    if (job.notes) {
      doc.text(`Notes: ${job.notes}`, 14, 65);
    }
    
    doc.setFontSize(14);
    doc.text("Material Shortages (BOM Exploded)", 14, 75);
    
    const materialData = explodedMaterials.map((mat: any) => [
      mat.subcategory,
      mat.name,
      mat.description,
      mat.inventoryType,
      `${mat.currentStock} ${mat.unit}`,
      `${mat.requiredQty.toFixed(2)} ${mat.unit}`,
      `${mat.shortage.toFixed(2)} ${mat.unit}`,
    ]);
    
    autoTable(doc, {
      head: [["Subcategory", "Item Name", "Description", "Type", "Stock", "Required", "Shortage"]],
      body: materialData,
      startY: 80,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    });
    
    const fileName = `procurement-job-${job.jobId}.pdf`;
    doc.save(fileName);
    toast.success("Procurement job exported as PDF");
  };

  const openDetailsSheet = (job: any) => {
    setSelectedJob(job);
    setDetailsOpen(true);
  };

  const openNotesDialog = (job: any) => {
    setSelectedJob(job);
    setEditingNotes(job.notes || "0");
    setNotesDialog(true);
  };

  const toggleJobSelection = (jobId: Id<"procurementJobs">) => {
    setSelectedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleDownloadComponentsReport = (scope: "all" | "selected") => {
    if (!inventory) {
      toast.error("Inventory data not loaded");
      return;
    }

    const jobsToProcess = scope === "all" 
      ? filteredJobs 
      : filteredJobs.filter((job) => selectedJobs.has(job._id));

    if (jobsToProcess.length === 0) {
      toast.error(scope === "all" ? "No jobs to process" : "No jobs selected");
      return;
    }

    // Create inventory lookups
    const inventoryMap = new Map(inventory.map(item => [item._id, item]));
    const inventoryByName = new Map(inventory.map(item => [item.name, item]));

    // Map to store aggregated requirements
    const requirementsMap = new Map<string, {
      name: string;
      subcategory: string;
      description: string;
      inventoryType: string;
      unit: string;
      requiredQty: number;
      sourceJobs: Set<string>;
    }>();

    // Recursive function to process shortages and explode BOMs
    const processShortage = (itemName: string, qtyNeeded: number, jobId: string) => {
      const item = inventoryByName.get(itemName);
      
      // If item has components (BOM) and is pre-processed/finished, explode it
      if (item && item.components && item.components.length > 0) {
        item.components.forEach(comp => {
          const rawItem = inventoryMap.get(comp.rawMaterialId);
          if (rawItem) {
            processShortage(rawItem.name, qtyNeeded * comp.quantityRequired, jobId);
          }
        });
      } else {
        // Base material or item without BOM
        const key = itemName;
        if (!requirementsMap.has(key)) {
          requirementsMap.set(key, {
            name: itemName,
            subcategory: item?.subcategory || "Uncategorized",
            description: item?.description || "N/A",
            inventoryType: item?.type || "N/A",
            unit: item?.unit || "units",
            requiredQty: 0,
            sourceJobs: new Set()
          });
        }
        const req = requirementsMap.get(key)!;
        req.requiredQty += qtyNeeded;
        req.sourceJobs.add(jobId);
      }
    };

    // Process all jobs
    jobsToProcess.forEach((job) => {
      job.materialShortages.forEach((mat: any) => {
        if (mat.shortage > 0) {
          processShortage(mat.name, mat.shortage, job.jobId);
        }
      });
    });

    // Build final material map with net shortages
    const materialMap = new Map<string, {
      name: string;
      subcategory: string;
      description: string;
      inventoryType: string;
      category: string;
      unit: string;
      required: number;
      currentStock: number;
      shortage: number;
      sourceJobs: string[];
    }>();

    requirementsMap.forEach((req, key) => {
      const item = inventoryByName.get(req.name);
      const currentStock = item?.quantity || 0;
      const netShortage = Math.max(0, req.requiredQty - currentStock);

      materialMap.set(key, {
        name: req.name,
        subcategory: req.subcategory,
        description: req.description,
        inventoryType: req.inventoryType,
        category: req.subcategory, // Using subcategory as category
        unit: req.unit,
        required: req.requiredQty,
        currentStock: currentStock,
        shortage: netShortage,
        sourceJobs: Array.from(req.sourceJobs),
      });
    });

    // Group by subcategory
    const categorizedMaterials = new Map<string, typeof materialMap>();
    materialMap.forEach((material, key) => {
      const subcategoryKey = material.subcategory || "Uncategorized";
      if (!categorizedMaterials.has(subcategoryKey)) {
        categorizedMaterials.set(subcategoryKey, new Map());
      }
      categorizedMaterials.get(subcategoryKey)!.set(key, material);
    });

    // Generate HTML
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procurement Components Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          h2 { color: #555; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .shortage { color: #dc2626; font-weight: bold; }
          .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Procurement Components Report</h1>
        <div class="meta">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Scope:</strong> ${scope === "all" ? "All Filtered Jobs" : "Selected Jobs"}</p>
          <p><strong>Total Jobs:</strong> ${jobsToProcess.length}</p>
          <p><strong>Total Unique Materials:</strong> ${materialMap.size}</p>
          <p><em>Note: Pre-processed items with BOMs have been exploded into raw materials. Shortages are net values against current global stock.</em></p>
        </div>
    `;

    // Sort subcategories alphabetically
    const sortedSubcategories = Array.from(categorizedMaterials.keys()).sort();

    sortedSubcategories.forEach((subcategory) => {
      const materials = categorizedMaterials.get(subcategory)!;
      html += `
        <h2>${subcategory}</h2>
        <table>
          <thead>
            <tr>
              <th>Subcategory</th>
              <th>Item Name</th>
              <th>Description</th>
              <th>Category (Type)</th>
              <th>Current Stock</th>
              <th>Required</th>
              <th>Shortage</th>
              <th>Unit</th>
              <th>Source Jobs</th>
            </tr>
          </thead>
          <tbody>
      `;

      // Sort materials by name
      const sortedMaterials = Array.from(materials.values()).sort((a, b) => a.name.localeCompare(b.name));

      sortedMaterials.forEach((material) => {
        html += `
          <tr>
            <td>${material.subcategory}</td>
            <td>${material.name}</td>
            <td>${material.description}</td>
            <td>${material.inventoryType}</td>
            <td>${material.currentStock}</td>
            <td>${material.required}</td>
            <td class="shortage">${material.shortage}</td>
            <td>${material.unit}</td>
            <td>${material.sourceJobs.join(", ")}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    });

    html += `
      </body>
      </html>
    `;

    // Download
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `procurement-components-report-${scope}-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Components report downloaded");
  };

  const stats = {
    pending: procurementJobs?.filter((j) => j.status === "pending").length || 0,
    inProgress: procurementJobs?.filter((j) => j.status === "in_progress").length || 0,
    completed: procurementJobs?.filter((j) => j.status === "completed").length || 0,
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Requests</h1>
            <p className="text-muted-foreground mt-2">
              Manage packing requests and material shortages
            </p>
          </div>

          <Tabs defaultValue={canViewPacking ? "packing" : "requests"} className="mt-6">
            <TabsList>
              {canViewPacking && <TabsTrigger value="packing">Packing Requests</TabsTrigger>}
              {canViewMaterialRequests && <TabsTrigger value="requests">Material Requests</TabsTrigger>}
            </TabsList>

            {canViewPacking && (
            <TabsContent value="packing" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.inProgress}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.completed}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div>
                  <Label className="text-xs">Status Filter</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Priority Filter</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Search</Label>
                  <Input
                    placeholder="Search by Job ID or Creator..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {canEditPacking && (
                <div className="flex gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadComponentsReport("all")}
                    disabled={filteredJobs.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All Components Report
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadComponentsReport("selected")}
                    disabled={selectedJobs.size === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Selected Components Report ({selectedJobs.size})
                  </Button>
                </div>
              )}

              <Card className="mt-6">
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canEditPacking && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedJobs(new Set(filteredJobs.map((j) => j._id)));
                                } else {
                                  setSelectedJobs(new Set());
                                }
                              }}
                            />
                          </TableHead>
                        )}
                        <TableHead>Job ID</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Created On</TableHead>
                        <TableHead>Assignments</TableHead>
                        <TableHead>Materials</TableHead>
                        {canEditPacking && <TableHead>Status</TableHead>}
                        {canEditPacking && <TableHead>Priority</TableHead>}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job, idx) => (
                        <motion.tr
                          key={job._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className="border-b"
                        >
                          {canEditPacking && (
                            <TableCell>
                              <Checkbox
                                checked={selectedJobs.has(job._id)}
                                onCheckedChange={() => toggleJobSelection(job._id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{job.jobId}</TableCell>
                          <TableCell>{job.creatorName}</TableCell>
                          <TableCell>
                            {new Date(job._creationTime).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{job.assignmentIds.length}</TableCell>
                          <TableCell>{job.materialShortages.length}</TableCell>
                          {canEditPacking && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={job.status}
                                onValueChange={(value) => handleStatusChange(job._id, value)}
                              >
                                <SelectTrigger className="h-8 w-[140px]" onClick={(e) => e.stopPropagation()}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          {canEditPacking && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={job.priority}
                                onValueChange={(value) => handlePriorityChange(job._id, value)}
                              >
                                <SelectTrigger className="h-8 w-[120px]" onClick={(e) => e.stopPropagation()}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetailsSheet(job)}
                                title="View Details"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => exportJobToPDF(job)}
                                title="Export PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {canEditPacking && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openNotesDialog(job)}
                                  title="Edit Notes"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                              {canEditPacking && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteJob(job._id)}
                                  title="Delete Job"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredJobs.length === 0 && (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No packing requests found</h3>
                      <p className="text-muted-foreground">Try adjusting your filters</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            )}

            {canViewMaterialRequests && (
            <TabsContent value="requests">
              <MaterialRequestsTab />
            </TabsContent>
            )}
          </Tabs>
        </motion.div>
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="min-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Packing Request Details</SheetTitle>
            <SheetDescription>
              {selectedJob?.jobId} - Created by {selectedJob?.creatorName}
            </SheetDescription>
          </SheetHeader>
          {selectedJob && (
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={
                      selectedJob.status === "completed" ? "bg-green-100 text-green-800 border-green-200" :
                      selectedJob.status === "in_progress" ? "bg-blue-100 text-blue-800 border-blue-200" :
                      "bg-yellow-100 text-yellow-800 border-yellow-200"
                    }>
                      {selectedJob.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={
                      selectedJob.priority === "high" ? "bg-red-100 text-red-800 border-red-200" :
                      selectedJob.priority === "medium" ? "bg-orange-100 text-orange-800 border-orange-200" :
                      "bg-slate-100 text-slate-800 border-slate-200"
                    }>
                      {selectedJob.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {selectedJob.notes && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedJob.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">Material Requirements (BOM Exploded)</Label>
                <div className="mt-2 border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Shortage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getExplodedShortages(selectedJob).map((mat: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{mat.name}</span>
                              <span className="text-xs text-muted-foreground">{mat.subcategory}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {mat.currentStock} {mat.unit}
                          </TableCell>
                          <TableCell>
                            {mat.requiredQty.toFixed(2)} {mat.unit}
                          </TableCell>
                          <TableCell>
                            {mat.shortage > 0 ? (
                              <Badge variant="destructive">
                                {mat.shortage.toFixed(2)} {mat.unit}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={notesDialog} onOpenChange={setNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
            <DialogDescription>
              Update notes for {selectedJob?.jobId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Add notes about this procurement job..."
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleNotesUpdate}>Save Notes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}