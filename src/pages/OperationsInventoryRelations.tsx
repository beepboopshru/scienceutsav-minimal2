import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
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
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function OperationsInventoryRelations() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const procurementJobs = useQuery(api.procurementJobs.list);
  const assignments = useQuery(api.assignments.listAll);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);
  
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
    pending: procurementJobs.filter((j) => j.status === "pending").length,
    inProgress: procurementJobs.filter((j) => j.status === "in_progress").length,
    completed: procurementJobs.filter((j) => j.status === "completed").length,
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Operations-Inventory Relations</h1>
            <p className="text-muted-foreground mt-2">
              Manage procurement requests and material shortages
            </p>
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
                      <TableCell className="font-medium">{job.jobId}</TableCell>
                      <TableCell>{job.creatorName}</TableCell>
                      <TableCell>
                        {new Date(job._creationTime).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{job.assignmentIds.length}</TableCell>
                      <TableCell>{job.materialShortages.length}</TableCell>
                      <TableCell>
                        <Select
                          value={job.status}
                          onValueChange={(value) => {
                            handleStatusChange(job._id, value);
                          }}
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
                      <TableCell>
                        <Select
                          value={job.priority}
                          onValueChange={(value) => {
                            handlePriorityChange(job._id, value);
                          }}
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
