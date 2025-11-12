import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery, useAction } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Download, Eye, Package, ChevronDown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Packing() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  const assignments = useQuery(api.assignments.listAll, {});
  const kits = useQuery(api.kits.list, {});
  const clients = useQuery(api.clients.list, {});
  const b2cClients = useQuery(api.b2cClients.list, {});
  const batches = useQuery(api.batches.list, {});
  const programs = useQuery(api.programs.list, {});

  const updatePackingStatus = useMutation(api.assignments.updatePackingStatus);
  const downloadKitSheet = useAction(api.kitPdf.generateKitSheet);

  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all");
  const [packingStatusFilter, setPackingStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  
  // Advanced filters
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);

  const [checklistDialog, setChecklistDialog] = useState<{
    open: boolean;
    assignmentId: Id<"assignments"> | null;
    checklist: {
      kitComponents: boolean;
      totalCount: boolean;
      workbook: boolean;
      worksheet: boolean;
    };
  }>({
    open: false,
    assignmentId: null,
    checklist: {
      kitComponents: false,
      totalCount: false,
      workbook: false,
      worksheet: false,
    },
  });

  const [fileViewerDialog, setFileViewerDialog] = useState<{
    open: boolean;
    kitId: Id<"kits"> | null;
    kitName: string;
  }>({
    open: false,
    kitId: null,
    kitName: "",
  });

  const hasAccess = user?.role === "admin" || user?.role === "operations";

  const filteredAssignments = (assignments || []).filter((assignment) => {
    // Basic filters
    if (customerTypeFilter !== "all" && assignment.clientType !== customerTypeFilter) return false;
    if (packingStatusFilter !== "all" && (assignment.packingStatus || "assigned") !== packingStatusFilter) return false;
    
    // Advanced filters
    const kit = kits?.find((k) => k._id === assignment.kitId);
    const program = kit ? programs?.find((p) => p._id === kit.programId) : null;
    
    if (selectedPrograms.length > 0 && (!program || !selectedPrograms.includes(program._id))) return false;
    if (selectedCategories.length > 0 && (!kit?.category || !selectedCategories.includes(kit.category))) return false;
    if (selectedKits.length > 0 && !selectedKits.includes(assignment.kitId)) return false;
    if (selectedClients.length > 0 && !selectedClients.includes(assignment.clientId)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(assignment.status)) return false;
    if (selectedBatches.length > 0 && (!assignment.batchId || !selectedBatches.includes(assignment.batchId))) return false;
    if (selectedProductionMonths.length > 0 && (!assignment.productionMonth || !selectedProductionMonths.includes(assignment.productionMonth))) return false;
    if (selectedDispatchMonths.length > 0) {
      const dispatchMonth = format(new Date(assignment.dispatchedAt || assignment._creationTime), "yyyy-MM");
      if (!selectedDispatchMonths.includes(dispatchMonth)) return false;
    }
    
    // Search query
    if (searchQuery.trim()) {
      const client = assignment.clientType === "b2b" 
        ? clients?.find((c) => c._id === assignment.clientId)
        : b2cClients?.find((c) => c._id === assignment.clientId);
      
      const searchLower = searchQuery.toLowerCase();
      const kitMatch = kit?.name.toLowerCase().includes(searchLower);
      const clientName = assignment.clientType === "b2b" 
        ? (client as any)?.name 
        : (client as any)?.buyerName;
      const clientMatch = clientName?.toLowerCase().includes(searchLower);
      
      if (!kitMatch && !clientMatch) return false;
    }
    
    return true;
  });

  // Group assignments by batch
  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    const batchKey = assignment.batchId ? assignment.batchId : "standalone";
    if (!acc[batchKey]) {
      acc[batchKey] = [];
    }
    acc[batchKey].push(assignment);
    return acc;
  }, {} as Record<string, typeof filteredAssignments>);

  const stats = {
    assigned: filteredAssignments.filter((a) => (a.packingStatus || "assigned") === "assigned").reduce((sum, a) => sum + a.quantity, 0),
    inProgress: filteredAssignments.filter((a) => a.packingStatus === "in_progress").reduce((sum, a) => sum + a.quantity, 0),
    transferred: filteredAssignments.filter((a) => a.packingStatus === "transferred_to_dispatch").reduce((sum, a) => sum + a.quantity, 0),
  };

  const toggleBatch = (batchKey: string) => {
    setExpandedBatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(batchKey)) {
        newSet.delete(batchKey);
      } else {
        newSet.add(batchKey);
      }
      return newSet;
    });
  };

  const handleStatusChange = async (assignmentId: Id<"assignments">, newStatus: string) => {
    if (newStatus === "transferred_to_dispatch") {
      setChecklistDialog({
        open: true,
        assignmentId,
        checklist: {
          kitComponents: false,
          totalCount: false,
          workbook: false,
          worksheet: false,
        },
      });
    } else {
      try {
        await updatePackingStatus({ assignmentId, packingStatus: newStatus as any });
        toast.success("Packing status updated");
      } catch (error) {
        toast.error("Failed to update status", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  const handleChecklistSubmit = async () => {
    const { kitComponents, totalCount, workbook, worksheet } = checklistDialog.checklist;
    
    if (!kitComponents || !totalCount || !workbook || !worksheet) {
      toast.error("Please complete all checklist items");
      return;
    }

    if (!checklistDialog.assignmentId) return;

    try {
      await updatePackingStatus({
        assignmentId: checklistDialog.assignmentId,
        packingStatus: "transferred_to_dispatch",
      });
      toast.success("Assignment transferred to dispatch");
      setChecklistDialog({
        open: false,
        assignmentId: null,
        checklist: {
          kitComponents: false,
          totalCount: false,
          workbook: false,
          worksheet: false,
        },
      });
    } catch (error) {
      toast.error("Failed to transfer to dispatch", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDownloadKitSheet = async (kitId: Id<"kits">) => {
    try {
      toast.info("Generating kit sheet...");
      const result = await downloadKitSheet({ kitId });
      
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.kitName.replace(/\s+/g, "-")}-sheet.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Kit sheet downloaded");
    } catch (error) {
      toast.error("Failed to generate kit sheet", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  if (isLoading || !assignments || !kits) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">Loading...</div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have access to this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packing Operations</h1>
          <p className="text-muted-foreground mt-2">Manage kit packing and dispatch preparation</p>
        </div>

        <AssignmentFilters
          programs={programs || []}
          kits={kits || []}
          clients={[...(clients || []), ...(b2cClients || [])]}
          assignments={filteredAssignments}
          selectedPrograms={selectedPrograms}
          selectedCategories={selectedCategories}
          selectedKits={selectedKits}
          selectedClients={selectedClients}
          selectedDispatchMonths={selectedDispatchMonths}
          selectedStatuses={selectedStatuses}
          selectedProductionMonths={selectedProductionMonths}
          onProgramsChange={setSelectedPrograms}
          onCategoriesChange={setSelectedCategories}
          onKitsChange={setSelectedKits}
          onClientsChange={setSelectedClients}
          onDispatchMonthsChange={setSelectedDispatchMonths}
          onStatusesChange={setSelectedStatuses}
          onProductionMonthsChange={setSelectedProductionMonths}
          onClearAll={() => {
            setSelectedPrograms([]);
            setSelectedCategories([]);
            setSelectedKits([]);
            setSelectedClients([]);
            setSelectedStatuses([]);
            setSelectedBatches([]);
            setSelectedDispatchMonths([]);
            setSelectedProductionMonths([]);
            setCustomerTypeFilter("all");
            setPackingStatusFilter("all");
            setSearchQuery("");
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">Customer Type</Label>
            <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="b2b">B2B</SelectItem>
                <SelectItem value="b2c">B2C</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Packing Status</Label>
            <Select value={packingStatusFilter} onValueChange={setPackingStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="transferred_to_dispatch">Transferred to Dispatch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Search by kit or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium w-10"></th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Customer Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Batch</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Program</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kit Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Dispatch Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Production Month</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Created On</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Packing Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedAssignments).map(([batchKey, batchAssignments]) => {
                  const batch = batchKey !== "standalone" ? batches?.find((b) => b._id === batchKey) : null;
                  const isExpanded = expandedBatches.has(batchKey);
                  const firstAssignment = batchAssignments[0];
                  const client = firstAssignment.clientType === "b2b"
                    ? clients?.find((c) => c._id === firstAssignment.clientId)
                    : b2cClients?.find((c) => c._id === firstAssignment.clientId);

                  if (batchKey === "standalone") {
                    // Render standalone assignments without batch grouping
                    return batchAssignments.map((assignment, index) => {
                      const kit = kits?.find((k) => k._id === assignment.kitId);
                      const program = kit ? programs?.find((p) => p._id === kit.programId) : null;
                      const assignmentClient = assignment.clientType === "b2b"
                        ? clients?.find((c) => c._id === assignment.clientId)
                        : b2cClients?.find((c) => c._id === assignment.clientId);

                      return (
                        <motion.tr
                          key={assignment._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3">
                            <Badge variant={assignment.clientType === "b2b" ? "default" : "secondary"}>
                              {assignment.clientType?.toUpperCase() || "N/A"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">—</td>
                          <td className="px-4 py-3 text-sm">
                            {assignment.clientType === "b2b" 
                              ? (assignmentClient as any)?.name || "Unknown"
                              : (assignmentClient as any)?.buyerName || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-sm">{program?.name || "—"}</td>
                          <td className="px-4 py-3 text-sm">{kit?.name || "Unknown Kit"}</td>
                          <td className="px-4 py-3 text-sm">{kit?.category || "—"}</td>
                          <td className="px-4 py-3 text-sm">{assignment.quantity}</td>
                          <td className="px-4 py-3 text-sm">{assignment.grade || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={
                              assignment.status === "dispatched" ? "default" :
                              assignment.status === "packed" ? "secondary" : "outline"
                            }>
                              {assignment.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {assignment.dispatchedAt 
                              ? new Date(assignment.dispatchedAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">{assignment.productionMonth || "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            {new Date(assignment._creationTime).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={assignment.notes}>
                            {assignment.notes || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={assignment.packingStatus || "assigned"}
                              onValueChange={(value) => handleStatusChange(assignment._id, value)}
                            >
                              <SelectTrigger className="h-8 w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="transferred_to_dispatch">Transferred to Dispatch</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (kit) {
                                    setFileViewerDialog({
                                      open: true,
                                      kitId: kit._id,
                                      kitName: kit.name,
                                    });
                                  }
                                }}
                                title="View Kit Files"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => kit && handleDownloadKitSheet(kit._id)}
                                title="Download Kit Sheet"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    });
                  }

                  // Render batch header row
                  return (
                    <>
                      <motion.tr
                        key={`batch-${batchKey}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b bg-muted/20 hover:bg-muted/40 cursor-pointer"
                        onClick={() => toggleBatch(batchKey)}
                      >
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={firstAssignment.clientType === "b2b" ? "default" : "secondary"}>
                            {firstAssignment.clientType?.toUpperCase() || "N/A"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold" colSpan={2}>
                          {batch?.batchId || "Unknown Batch"} - {firstAssignment.clientType === "b2b" 
                            ? (client as any)?.name || "Unknown"
                            : (client as any)?.buyerName || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm" colSpan={2}>
                          {batchAssignments.length} assignment{batchAssignments.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          Total: {batchAssignments.reduce((sum, a) => sum + a.quantity, 0)}
                        </td>
                        <td colSpan={9}></td>
                      </motion.tr>
                      {isExpanded && batchAssignments.map((assignment, index) => {
                        const kit = kits?.find((k) => k._id === assignment.kitId);
                        const program = kit ? programs?.find((p) => p._id === kit.programId) : null;
                        const assignmentClient = assignment.clientType === "b2b"
                          ? clients?.find((c) => c._id === assignment.clientId)
                          : b2cClients?.find((c) => c._id === assignment.clientId);

                        return (
                          <motion.tr
                            key={assignment._id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className="border-b hover:bg-muted/30 bg-background"
                          >
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3">
                              <Badge variant={assignment.clientType === "b2b" ? "default" : "secondary"}>
                                {assignment.clientType?.toUpperCase() || "N/A"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">{batch?.batchId || "—"}</td>
                            <td className="px-4 py-3 text-sm">
                              {assignment.clientType === "b2b" 
                                ? (assignmentClient as any)?.name || "Unknown"
                                : (assignmentClient as any)?.buyerName || "Unknown"}
                            </td>
                            <td className="px-4 py-3 text-sm">{program?.name || "—"}</td>
                            <td className="px-4 py-3 text-sm">{kit?.name || "Unknown Kit"}</td>
                            <td className="px-4 py-3 text-sm">{kit?.category || "—"}</td>
                            <td className="px-4 py-3 text-sm">{assignment.quantity}</td>
                            <td className="px-4 py-3 text-sm">{assignment.grade || "—"}</td>
                            <td className="px-4 py-3">
                              <Badge variant={
                                assignment.status === "dispatched" ? "default" :
                                assignment.status === "packed" ? "secondary" : "outline"
                              }>
                                {assignment.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {assignment.dispatchedAt 
                                ? new Date(assignment.dispatchedAt).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">{assignment.productionMonth || "—"}</td>
                            <td className="px-4 py-3 text-sm">
                              {new Date(assignment._creationTime).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={assignment.notes}>
                              {assignment.notes || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={assignment.packingStatus || "assigned"}
                                onValueChange={(value) => handleStatusChange(assignment._id, value)}
                              >
                                <SelectTrigger className="h-8 w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="assigned">Assigned</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="transferred_to_dispatch">Transferred to Dispatch</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (kit) {
                                      setFileViewerDialog({
                                        open: true,
                                        kitId: kit._id,
                                        kitName: kit.name,
                                      });
                                    }
                                  }}
                                  title="View Kit Files"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => kit && handleDownloadKitSheet(kit._id)}
                                  title="Download Kit Sheet"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredAssignments.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No assignments found</h3>
            <p className="text-muted-foreground">Try adjusting your filters</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold">{stats.assigned}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold">{stats.inProgress}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Transferred to Dispatch</p>
            <p className="text-2xl font-bold">{stats.transferred}</p>
          </div>
        </div>
      </div>

      <Dialog open={checklistDialog.open} onOpenChange={(open) => !open && setChecklistDialog({ ...checklistDialog, open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please verify all items before transferring to dispatch:
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kitComponents"
                  checked={checklistDialog.checklist.kitComponents}
                  onCheckedChange={(checked) =>
                    setChecklistDialog({
                      ...checklistDialog,
                      checklist: { ...checklistDialog.checklist, kitComponents: checked as boolean },
                    })
                  }
                />
                <Label htmlFor="kitComponents" className="cursor-pointer">Kit Components</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="totalCount"
                  checked={checklistDialog.checklist.totalCount}
                  onCheckedChange={(checked) =>
                    setChecklistDialog({
                      ...checklistDialog,
                      checklist: { ...checklistDialog.checklist, totalCount: checked as boolean },
                    })
                  }
                />
                <Label htmlFor="totalCount" className="cursor-pointer">Total Count</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="workbook"
                  checked={checklistDialog.checklist.workbook}
                  onCheckedChange={(checked) =>
                    setChecklistDialog({
                      ...checklistDialog,
                      checklist: { ...checklistDialog.checklist, workbook: checked as boolean },
                    })
                  }
                />
                <Label htmlFor="workbook" className="cursor-pointer">Workbook</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="worksheet"
                  checked={checklistDialog.checklist.worksheet}
                  onCheckedChange={(checked) =>
                    setChecklistDialog({
                      ...checklistDialog,
                      checklist: { ...checklistDialog.checklist, worksheet: checked as boolean },
                    })
                  }
                />
                <Label htmlFor="worksheet" className="cursor-pointer">Worksheet</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setChecklistDialog({ ...checklistDialog, open: false })}>
                Cancel
              </Button>
              <Button onClick={handleChecklistSubmit}>Confirm Transfer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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