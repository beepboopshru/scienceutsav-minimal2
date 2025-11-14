import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Package, Download, Trash2, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

export default function OperationsInventoryRelations() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const procurementJobs = useQuery(api.procurementJobs.list);
  const assignments = useQuery(api.assignments.listAll);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);
  const inventory = useQuery(api.inventory.list, {});
  
  const updateStatus = useMutation(api.procurementJobs.updateStatus);
  const updatePriority = useMutation(api.procurementJobs.updatePriority);
  const updateNotes = useMutation(api.procurementJobs.updateNotes);
  const removeJob = useMutation(api.procurementJobs.remove);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [notesDialog, setNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
    if (!isLoading && isAuthenticated && user && user.role && !["admin", "manager", "operations", "inventory"].includes(user.role)) {
      toast.error("Access denied: This page requires admin, manager, operations, or inventory role");
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !procurementJobs || !assignments || !kits) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const filteredJobs = procurementJobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    if (priorityFilter !== "all" && job.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      const jobIdMatch = job.jobId.toLowerCase().includes(searchLower);
      const creatorMatch = job.creatorName?.toLowerCase().includes(searchLower);
      if (!jobIdMatch && !creatorMatch) return false;
    }
    return true;
  });

  const toggleJobSelection = (jobId: string) => {
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

  const handleDownloadComponentsReport = (useSelected: boolean) => {
    console.log("Download button clicked, useSelected:", useSelected);
    console.log("Procurement jobs:", procurementJobs);
    console.log("Inventory:", inventory);
    
    if (!procurementJobs) {
      toast.error("Procurement jobs data not loaded");
      return;
    }
    
    const pendingJobs = procurementJobs.filter((j) => j.status === "pending");
    console.log("Pending jobs:", pendingJobs);
    
    const jobsToProcess = useSelected 
      ? pendingJobs.filter((j) => selectedJobs.has(j._id))
      : pendingJobs;
    
    console.log("Jobs to process:", jobsToProcess);
    console.log("Selected jobs:", Array.from(selectedJobs));

    if (jobsToProcess.length === 0) {
      toast.error(useSelected ? "No pending jobs selected" : "No pending procurement jobs");
      return;
    }

    if (!inventory) {
      toast.error("Inventory data not loaded");
      return;
    }

    // Aggregate materials from all selected jobs
    const materialMap = new Map<string, any>();

    jobsToProcess.forEach((job) => {
      job.materialShortages.forEach((material: any) => {
        const key = material.name.toLowerCase();
        
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.required += material.required;
          existing.shortage += material.shortage;
          if (material.sourceKits) {
            existing.sourceKits = [...new Set([...existing.sourceKits, ...material.sourceKits])];
          }
          if (material.traceability) {
            existing.traceability = [...new Set([...existing.traceability, material.traceability])];
          }
        } else {
          const invItem = inventory.find((i) => i.name.toLowerCase() === material.name.toLowerCase());
          materialMap.set(key, {
            name: material.name,
            currentStock: invItem?.quantity || material.currentStock || 0,
            required: material.required,
            shortage: material.shortage,
            unit: material.unit,
            category: material.category || "Uncategorized",
            sourceKits: material.sourceKits || [],
            traceability: material.traceability ? [material.traceability] : [],
          });
        }
      });
    });

    const allMaterials = Array.from(materialMap.values());
    const byCategory = allMaterials.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof allMaterials>);

    type MaterialItem = {
      name: string;
      currentStock: number;
      required: number;
      shortage: number;
      unit: string;
      sourceKits: string[];
      traceability: string[];
    };
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Procurement Components Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #1e40af;
      margin-top: 30px;
      border-bottom: 2px solid #93c5fd;
      padding-bottom: 5px;
    }
    .meta-info {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .meta-info p {
      margin: 5px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background-color: #2563eb;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background-color: #f9fafb;
    }
    .shortage {
      color: #dc2626;
      font-weight: bold;
    }
    .sufficient {
      color: #16a34a;
    }
    .category-summary {
      background: #eff6ff;
      padding: 10px;
      margin-bottom: 10px;
      border-left: 4px solid #2563eb;
    }
    @media print {
      body { margin: 0; }
      h2 { page-break-before: always; }
      h2:first-of-type { page-break-before: avoid; }
    }
  </style>
</head>
<body>
  <h1>Procurement Components Report</h1>
  
  <div class="meta-info">
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Report Type:</strong> ${useSelected ? "Selected Pending Jobs" : "All Pending Jobs"}</p>
    <p><strong>Total Jobs:</strong> ${jobsToProcess.length}</p>
    <p><strong>Total Unique Materials:</strong> ${allMaterials.length}</p>
  </div>

  ${Object.entries(byCategory).map(([category, materials]) => {
    const materialsList = materials as MaterialItem[];
    return `
    <h2>${category}</h2>
    <div class="category-summary">
      <strong>${materialsList.length}</strong> unique material(s) in this category
    </div>
    <table>
      <thead>
        <tr>
          <th>Material Name</th>
          <th>Current Stock</th>
          <th>Required</th>
          <th>Shortage</th>
          <th>Unit</th>
          <th>Source Kits</th>
          <th>Component Location</th>
        </tr>
      </thead>
      <tbody>
        ${materialsList.map((material) => `
          <tr>
            <td><strong>${material.name}</strong></td>
            <td class="${material.shortage > 0 ? 'shortage' : 'sufficient'}">${material.currentStock}</td>
            <td>${material.required}</td>
            <td class="${material.shortage > 0 ? 'shortage' : ''}">${material.shortage > 0 ? material.shortage : '—'}</td>
            <td>${material.unit}</td>
            <td>${material.sourceKits.join(", ")}</td>
            <td style="font-size: 0.9em;">${[...new Set(material.traceability)].join("; ")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  }).join("")}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 0.9em;">
    <p>This report shows the aggregate components needed for pending procurement jobs.</p>
    <p>Materials with shortages are highlighted in red.</p>
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `procurement-components-report-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Procurement components report downloaded");
  };

  const handleStatusChange = async (jobId: Id<"procurementJobs">, newStatus: string) => {
    try {
      await updateStatus({ id: jobId, status: newStatus as any });
      toast.success("Status updated successfully");
    } catch (error) {
      toast.error("Failed to update status", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handlePriorityChange = async (jobId: Id<"procurementJobs">, newPriority: string) => {
    try {
      await updatePriority({ id: jobId, priority: newPriority as any });
      toast.success("Priority updated successfully");
    } catch (error) {
      toast.error("Failed to update priority", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
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
    doc.text("Material Shortages", 14, 75);
    
    const materialData = job.materialShortages.map((mat: any) => [
      mat.name,
      mat.category || "—",
      `${mat.currentStock} ${mat.unit}`,
      `${mat.required} ${mat.unit}`,
      `${mat.shortage} ${mat.unit}`,
    ]);
    
    autoTable(doc, {
      head: [["Material", "Category", "Current Stock", "Required", "Shortage"]],
      body: materialData,
      startY: 80,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    });
    
    const fileName = `procurement-job-${job.jobId}.pdf`;
    doc.save(fileName);
    toast.success("Procurement job exported as PDF");
  };

  const openDetailsDialog = (job: any) => {
    setSelectedJob(job);
    setDetailsDialog(true);
  };

  const openNotesDialog = (job: any) => {
    setSelectedJob(job);
    setEditingNotes(job.notes || "");
    setNotesDialog(true);
  };

  const stats = {
    pending: procurementJobs?.filter((j) => j.status === "pending").length || 0,
    inProgress: procurementJobs?.filter((j) => j.status === "in_progress").length || 0,
    completed: procurementJobs?.filter((j) => j.status === "completed").length || 0,
  };

  const pendingJobsCount = stats.pending;

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Operations-Inventory Relations</h1>
              <p className="text-muted-foreground mt-2">
                Manage procurement requests and material shortages
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Components Shortage
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    console.log("All Pending Jobs clicked");
                    handleDownloadComponentsReport(false);
                  }}
                >
                  All Pending Jobs ({pendingJobsCount})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    console.log("Selected Pending Jobs clicked");
                    handleDownloadComponentsReport(true);
                  }}
                  disabled={selectedJobs.size === 0}
                >
                  Selected Pending Jobs ({selectedJobs.size})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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

          <Card className="mt-6">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedJobs.size === filteredJobs.filter(j => j.status === "pending").length && filteredJobs.filter(j => j.status === "pending").length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedJobs(new Set(filteredJobs.filter(j => j.status === "pending").map((j) => j._id)));
                          } else {
                            setSelectedJobs(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
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
                      <TableCell>
                        <Checkbox
                          checked={selectedJobs.has(job._id)}
                          onCheckedChange={() => toggleJobSelection(job._id)}
                          disabled={job.status !== "pending"}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{job.jobId}</TableCell>
                      <TableCell>{job.creatorName}</TableCell>
                      <TableCell>
                        {new Date(job._creationTime).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{job.assignmentIds.length}</TableCell>
                      <TableCell>{job.materialShortages.length}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={job.status}
                          onValueChange={(value) => handleStatusChange(job._id, value)}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={job.priority}
                          onValueChange={(value) => handlePriorityChange(job._id, value)}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailsDialog(job)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openNotesDialog(job)}
                            title="Edit Notes"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJob(job._id)}
                            title="Delete Job"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
              {filteredJobs.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No procurement jobs found</h3>
                  <p className="text-muted-foreground">Try adjusting your filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Procurement Job Details</DialogTitle>
            <DialogDescription>
              {selectedJob?.jobId} - Created by {selectedJob?.creatorName}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant="outline" className="mt-1">
                    {selectedJob.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Badge variant="outline" className="mt-1">
                    {selectedJob.priority}
                  </Badge>
                </div>
              </div>
              
              {selectedJob.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedJob.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">Material Shortages</Label>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedJob.materialShortages.map((mat: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{mat.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mat.category || "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          {mat.currentStock} {mat.unit}
                        </TableCell>
                        <TableCell>
                          {mat.required} {mat.unit}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {mat.shortage} {mat.unit}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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