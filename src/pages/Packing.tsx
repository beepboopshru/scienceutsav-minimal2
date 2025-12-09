import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useAuth } from "@/hooks/use-auth";
import { Check, X, Pencil, FileText, MessageSquare, Truck } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery, useAction } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Download, Eye, Package, ChevronDown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ColumnVisibility } from "@/components/ui/column-visibility";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const inventory = useQuery(api.inventory.list, {});
  const checklistItems = useQuery(api.packingChecklist.list, {});

  const updatePackingStatus = useMutation(api.assignments.updatePackingStatus);
  const updatePackingNotes = useMutation(api.assignments.updatePackingNotes);
  const downloadKitSheet = useAction(api.kitPdf.generateKitSheet);
  const createPackingRequest = useMutation(api.packingRequests.create);
  const packingRequests = useQuery(api.packingRequests.list);

  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all");
  const [packingStatusFilter, setPackingStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [selectedAssignments, setSelectedAssignments] = useState<Set<Id<"assignments">>>(new Set());
  
  // Advanced filters
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleClearAllFilters = () => {
    setSelectedPrograms([]);
    setSelectedCategories([]);
    setSelectedKits([]);
    setSelectedClients([]);
    setSelectedDispatchMonths([]);
    setSelectedStatuses([]);
    setSelectedProductionMonths([]);
    setSelectedBatches([]);
  };
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);

  const [checklistDialog, setChecklistDialog] = useState<{
    open: boolean;
    assignmentId: Id<"assignments"> | null;
    checklist: Record<string, boolean>;
  }>({
    open: false,
    assignmentId: null,
    checklist: {},
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

  const [editingPackingNotes, setEditingPackingNotes] = useState<Record<string, { isEditing: boolean; value: string }>>({});

  // Notes dialog state
  const [notesDialog, setNotesDialog] = useState<{
    open: boolean;
    assignmentId: Id<"assignments"> | null;
    type: "assignment" | "packing" | "dispatch";
    value: string;
    canEdit: boolean;
  }>({
    open: false,
    assignmentId: null,
    type: "assignment",
    value: "",
    canEdit: false,
  });

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    program: true,
    kit: true,
    client: true,
    quantity: true,
    grade: true,
    status: true,
    dispatchDate: true,
    productionMonth: true,
    notes: true,
  });

  const toggleColumn = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId as keyof typeof prev]: !prev[columnId as keyof typeof prev],
    }));
  };

  const columns = [
    { id: "program", label: "Program", visible: columnVisibility.program },
    { id: "kit", label: "Kit", visible: columnVisibility.kit },
    { id: "client", label: "Client", visible: columnVisibility.client },
    { id: "quantity", label: "Quantity", visible: columnVisibility.quantity },
    { id: "grade", label: "Grade", visible: columnVisibility.grade },
    { id: "status", label: "Status", visible: columnVisibility.status },
    { id: "dispatchDate", label: "Dispatch Date", visible: columnVisibility.dispatchDate },
    { id: "productionMonth", label: "Production Month", visible: columnVisibility.productionMonth },
    { id: "notes", label: "Notes", visible: columnVisibility.notes },
  ];

  const handleSavePackingNotes = async (assignmentId: Id<"assignments">) => {
    const editState = editingPackingNotes[assignmentId];
    if (!editState) return;

    try {
      await updatePackingNotes({
        id: assignmentId,
        packingNotes: editState.value,
      });
      toast.success("Packing notes updated successfully");
      setEditingPackingNotes((prev) => {
        const newState = { ...prev };
        delete newState[assignmentId];
        return newState;
      });
    } catch (error) {
      toast.error("Failed to update packing notes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleOpenNotesDialog = (
    assignmentId: Id<"assignments">,
    type: "assignment" | "packing" | "dispatch",
    value: string,
    canEdit: boolean
  ) => {
    setNotesDialog({
      open: true,
      assignmentId,
      type,
      value: value || "",
      canEdit,
    });
  };

  const handleSaveNotesDialog = async () => {
    if (!notesDialog.assignmentId) return;

    // Verify user has edit permission before attempting to save
    if (!notesDialog.canEdit) {
      toast.error("You do not have permission to edit notes");
      return;
    }

    try {
      if (notesDialog.type === "packing") {
        await updatePackingNotes({
          id: notesDialog.assignmentId,
          packingNotes: notesDialog.value,
        });
        toast.success("Packing notes updated successfully");
      }
      // Assignment notes and dispatch notes are read-only in packing page
      setNotesDialog({ open: false, assignmentId: null, type: "assignment", value: "", canEdit: false });
    } catch (error) {
      toast.error("Failed to update notes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const { hasPermission } = usePermissions();
  const canView = hasPermission("packing", "view");
  const canEdit = hasPermission("packing", "edit");
  
  console.log("Packing permissions - canView:", canView, "canEdit:", canEdit);

  const toggleAssignmentSelection = (assignmentId: Id<"assignments">) => {
    setSelectedAssignments((prev) => {
      const newSet = new Set<Id<"assignments">>();
      if (prev.has(assignmentId)) {
        return newSet;
      } else {
        newSet.add(assignmentId);
        return newSet;
      }
    });
  };

  // Check if an assignment already has a packing request
  const hasPackingRequest = (assignmentId: Id<"assignments">) => {
    return packingRequests?.some(req => 
      req.assignmentIds.includes(assignmentId)
    ) || false;
  };

  const filteredAssignments = (assignments || []).filter((assignment) => {
    // Basic filters
    if (customerTypeFilter !== "all" && assignment.clientType !== customerTypeFilter) return false;
    if (packingStatusFilter !== "all" && (assignment.status || "assigned") !== packingStatusFilter) return false;
    
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
    assigned: filteredAssignments.filter((a) => (a.status || "assigned") === "assigned").reduce((sum, a) => sum + a.quantity, 0),
    inProgress: filteredAssignments.filter((a) => a.status === "in_progress").reduce((sum, a) => sum + a.quantity, 0),
    transferred: filteredAssignments.filter((a) => a.status === "transferred_to_dispatch").reduce((sum, a) => sum + a.quantity, 0),
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
      // Initialize checklist with all items unchecked
      const initialChecklist: Record<string, boolean> = {};
      checklistItems?.forEach(item => {
        initialChecklist[item.name] = false;
      });
      
      setChecklistDialog({
        open: true,
        assignmentId,
        checklist: initialChecklist,
      });
    } else {
      try {
        await updatePackingStatus({ assignmentId, packingStatus: newStatus as "assigned" | "in_progress" | "transferred_to_dispatch" | "processing" | "received_from_inventory" });
        toast.success("Packing status updated");
      } catch (error) {
        toast.error("Failed to update status", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  const handleChecklistSubmit = async () => {
    // Check if all checklist items are checked
    const allChecked = Object.values(checklistDialog.checklist).every(value => value === true);
    
    if (!allChecked) {
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
        checklist: {},
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

  if (!canView) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
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
          clients={clients || []}
          assignments={assignments || []}
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
          onClearAll={handleClearAllFilters}
        />
        <ColumnVisibility columns={columns} onToggle={toggleColumn} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Search by kit or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {selectedAssignments.size > 0 && canEdit && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20"
          >
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span className="font-medium">
                Assignment selected
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="default"
                onClick={async () => {
                  try {
                    // Filter out assignments that already have requests
                    const selectedArray = Array.from(selectedAssignments);
                    const assignmentsWithRequests = selectedArray.filter(id => hasPackingRequest(id));
                    const assignmentsWithoutRequests = selectedArray.filter(id => !hasPackingRequest(id));

                    if (assignmentsWithRequests.length > 0) {
                      toast.warning("Request already made", {
                        description: "This assignment already has a packing request.",
                      });
                    }

                    if (assignmentsWithoutRequests.length === 0) {
                      toast.error("Selected assignment already has a packing request");
                      return;
                    }

                    await createPackingRequest({
                      assignmentIds: assignmentsWithoutRequests,
                    });
                    toast.success("Packing request created");
                    setSelectedAssignments(new Set());
                  } catch (error) {
                    toast.error("Failed to create packing request", {
                      description: error instanceof Error ? error.message : "Unknown error",
                    });
                  }
                }}
              >
                Request Materials
              </Button>
              <Button variant="outline" onClick={() => setSelectedAssignments(new Set())}>
                Clear Selection
              </Button>
            </div>
          </motion.div>
        )}

        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <TableHeader>
                <TableRow>
                  {canEdit && <TableHead className="w-12"></TableHead>}
                  {columnVisibility.program && <TableHead>Program</TableHead>}
                  {columnVisibility.kit && <TableHead>Kit</TableHead>}
                  {columnVisibility.client && <TableHead>Client</TableHead>}
                  {columnVisibility.quantity && <TableHead>Quantity</TableHead>}
                  {columnVisibility.grade && <TableHead>Grade</TableHead>}
                  {columnVisibility.status && <TableHead>Status</TableHead>}
                  {columnVisibility.dispatchDate && <TableHead>Dispatch Date</TableHead>}
                  {columnVisibility.productionMonth && <TableHead>Production Month</TableHead>}
                  {columnVisibility.notes && <TableHead className="text-center">Notes</TableHead>}
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
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
                      
                      const clientName = assignmentClient
                        ? (assignment.clientType === "b2b"
                            ? ((assignmentClient as any)?.name || (assignmentClient as any)?.organization || "Unknown")
                            : ((assignmentClient as any)?.buyerName || "Unknown"))
                        : "Unknown";

                      return (
                        <TableRow key={assignment._id}>
                          {canEdit && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedAssignments.has(assignment._id)}
                                  onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                                />
                                {hasPackingRequest(assignment._id) && (
                                  <Badge variant="outline" className="text-xs">
                                    Requested
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.program && (
                            <TableCell>
                              <span className="text-sm">{program?.name || "—"}</span>
                            </TableCell>
                          )}
                          {columnVisibility.kit && (
                            <TableCell>
                              <span className="text-sm">{kits?.find((k) => k._id === assignment.kitId)?.name}</span>
                            </TableCell>
                          )}
                          {columnVisibility.client && (
                            <TableCell>
                              <span className="text-sm">
                                {assignment.clientType === "b2b"
                                  ? clients?.find((c) => c._id === assignment.clientId)?.organization ||
                                    clients?.find((c) => c._id === assignment.clientId)?.name
                                  : b2cClients?.find((c) => c._id === assignment.clientId)?.buyerName}
                              </span>
                            </TableCell>
                          )}
                          {columnVisibility.quantity && (
                            <TableCell>
                              <span className="text-sm">{assignment.quantity}</span>
                            </TableCell>
                          )}
                          {columnVisibility.grade && (
                            <TableCell>
                              <span className="text-sm">{assignment.grade}</span>
                            </TableCell>
                          )}
                          {columnVisibility.status && (
                            <TableCell>
                              {canEdit ? (
                                <Select
                                  value={assignment.status || "assigned"}
                                  onValueChange={async (value) => {
                                    if (value === "transferred_to_dispatch") {
                                      const initialChecklist: Record<string, boolean> = {};
                                      checklistItems?.forEach(item => {
                                        initialChecklist[item.name] = false;
                                      });
                                      
                                      setChecklistDialog({
                                        open: true,
                                        assignmentId: assignment._id,
                                        checklist: initialChecklist,
                                      });
                                    } else {
                                      try {
                                        await updatePackingStatus({
                                          assignmentId: assignment._id,
                                          packingStatus: value as "assigned" | "in_progress" | "transferred_to_dispatch" | "processing" | "received_from_inventory",
                                        });
                                        toast.success("Packing status updated successfully");
                                      } catch (error) {
                                        toast.error("Failed to update packing status: " + (error as Error).message);
                                      }
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="assigned">Assigned</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="received_from_inventory">Received from Inventory</SelectItem>
                                    <SelectItem value="transferred_to_dispatch">
                                      Transferred to Dispatch
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant={assignment.status === "dispatched" ? "default" : "secondary"}>
                                  {assignment.status}
                                </Badge>
                              )}
                            </TableCell>
                          )}
                          {columnVisibility.dispatchDate && (
                            <TableCell>
                              <span className="text-sm">
                                {assignment.dispatchedAt ? format(new Date(assignment.dispatchedAt), "MMM dd, yyyy") : "-"}
                              </span>
                            </TableCell>
                          )}
                          {columnVisibility.productionMonth && (
                            <TableCell>
                              <span className="text-sm">
                                {assignment.productionMonth
                                  ? format(new Date(assignment.productionMonth + "-01"), "MMM yyyy")
                                  : "-"}
                              </span>
                            </TableCell>
                          )}
                          {columnVisibility.notes && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenNotesDialog(assignment._id, "assignment", assignment.notes || "", false)}
                                  title="Assignment Notes"
                                  className="h-8 w-8 p-0"
                                >
                                  <FileText className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenNotesDialog(assignment._id, "packing", assignment.packingNotes || "", canEdit)}
                                  title="Packing Notes"
                                  className="h-8 w-8 p-0"
                                >
                                  <MessageSquare className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenNotesDialog(assignment._id, "dispatch", assignment.dispatchNotes || "", false)}
                                  title="Dispatch Notes"
                                  className="h-8 w-8 p-0"
                                >
                                  <Truck className="h-4 w-4 text-orange-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}

                          <TableCell>
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
                          </TableCell>
                        </TableRow>
                      );
                    });
                  }

                  // Render batch header row
                  return (
                    <>
                      <TableRow key={`batch-${batchKey}`} className="cursor-pointer hover:bg-muted/50 bg-muted/30" onClick={() => toggleBatch(batchKey)}>
                        {canEdit && <TableCell></TableCell>}
                        {columnVisibility.program && (
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.kit && (
                          <TableCell className="text-sm font-semibold">
                            {batch?.batchId || "Unknown Batch"}
                          </TableCell>
                        )}
                        {columnVisibility.client && (
                          <TableCell className="text-sm">
                            {firstAssignment.clientType === "b2b" 
                              ? (client as any)?.name || "Unknown"
                              : (client as any)?.buyerName || "Unknown"}
                          </TableCell>
                        )}
                        {columnVisibility.quantity && (
                          <TableCell className="text-sm">
                            Total: {batchAssignments.reduce((sum, a) => sum + a.quantity, 0)}
                          </TableCell>
                        )}
                        {columnVisibility.grade && <TableCell></TableCell>}
                        {columnVisibility.status && (
                          <TableCell className="text-sm">
                            {batchAssignments.length} assignment{batchAssignments.length !== 1 ? "s" : ""}
                          </TableCell>
                        )}
                        {columnVisibility.dispatchDate && <TableCell></TableCell>}
                        {columnVisibility.productionMonth && <TableCell></TableCell>}
                        {columnVisibility.notes && <TableCell></TableCell>}
                        {canEdit && <TableCell></TableCell>}
                      </TableRow>
                      {isExpanded && batchAssignments.map((assignment, index) => {
                        const kit = kits?.find((k) => k._id === assignment.kitId);
                        const program = kit ? programs?.find((p) => p._id === kit.programId) : null;
                        const assignmentClient = assignment.clientType === "b2b"
                          ? clients?.find((c) => c._id === assignment.clientId)
                          : b2cClients?.find((c) => c._id === assignment.clientId);
                        
                        const clientName = assignmentClient
                          ? (assignment.clientType === "b2b"
                              ? ((assignmentClient as any)?.name || (assignmentClient as any)?.organization || "Unknown")
                              : ((assignmentClient as any)?.buyerName || "Unknown"))
                          : "Unknown";

                        return (
                          <TableRow key={assignment._id} className="bg-background">
                            {canEdit && (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedAssignments.has(assignment._id)}
                                    onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                                  />
                                  {hasPackingRequest(assignment._id) && (
                                    <Badge variant="outline" className="text-xs">
                                      Requested
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {columnVisibility.program && (
                              <TableCell>
                                <span className="text-sm">{program?.name || "—"}</span>
                              </TableCell>
                            )}
                            {columnVisibility.kit && (
                              <TableCell>
                                <span className="text-sm">{kit?.name || "Unknown Kit"}</span>
                              </TableCell>
                            )}
                            {columnVisibility.client && (
                              <TableCell>
                                <span className="text-sm">{clientName}</span>
                              </TableCell>
                            )}
                            {columnVisibility.quantity && (
                              <TableCell>
                                <span className="text-sm">{assignment.quantity}</span>
                              </TableCell>
                            )}
                            {columnVisibility.grade && (
                              <TableCell>
                                <span className="text-sm">{assignment.grade || "—"}</span>
                              </TableCell>
                            )}
                            {columnVisibility.status && (
                              <TableCell>
                              {canEdit ? (
                                <Select
                                  value={assignment.status || "assigned"}
                                  onValueChange={async (value) => {
                                    if (value === "transferred_to_dispatch") {
                                      const initialChecklist: Record<string, boolean> = {};
                                      checklistItems?.forEach(item => {
                                        initialChecklist[item.name] = false;
                                      });
                                      
                                      setChecklistDialog({
                                        open: true,
                                        assignmentId: assignment._id,
                                        checklist: initialChecklist,
                                      });
                                    } else {
                                      try {
                                        await updatePackingStatus({
                                          assignmentId: assignment._id,
                                          packingStatus: value as "assigned" | "in_progress" | "transferred_to_dispatch" | "processing" | "received_from_inventory",
                                        });
                                        toast.success("Packing status updated successfully");
                                      } catch (error) {
                                        toast.error("Failed to update packing status: " + (error as Error).message);
                                      }
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="assigned">Assigned</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="received_from_inventory">Received from Inventory</SelectItem>
                                    <SelectItem value="transferred_to_dispatch">
                                      Transferred to Dispatch
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                ) : (
                                  <Badge variant={
                                    assignment.status === "dispatched" ? "default" :
                                    assignment.status === "in_progress" ? "secondary" : "outline"
                                  }>
                                    {assignment.status}
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                            {columnVisibility.dispatchDate && (
                              <TableCell>
                                <span className="text-sm">
                                  {assignment.dispatchedAt ? format(new Date(assignment.dispatchedAt), "MMM dd, yyyy") : "—"}
                                </span>
                              </TableCell>
                            )}
                            {columnVisibility.productionMonth && (
                              <TableCell>
                                <span className="text-sm">
                                  {assignment.productionMonth
                                    ? format(new Date(assignment.productionMonth + "-01"), "MMM yyyy")
                                    : "—"}
                                </span>
                              </TableCell>
                            )}
                            {columnVisibility.notes && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenNotesDialog(assignment._id, "assignment", assignment.notes || "", false)}
                                    title="Assignment Notes"
                                    className="h-8 w-8 p-0"
                                  >
                                    <FileText className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenNotesDialog(assignment._id, "packing", assignment.packingNotes || "", canEdit)}
                                    title="Packing Notes"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MessageSquare className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenNotesDialog(assignment._id, "dispatch", assignment.dispatchNotes || "", false)}
                                    title="Dispatch Notes"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Truck className="h-4 w-4 text-orange-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                            {canEdit && (
                              <TableCell>
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
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
              </TableBody>
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
            <DialogTitle>Packing Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please verify all packing items before transferring to dispatch:
            </p>
            <div className="space-y-3">
              {checklistItems?.map((item) => (
                <div key={item._id} className="flex items-center space-x-2">
                  <Checkbox
                    id={item.name}
                    checked={checklistDialog.checklist[item.name] || false}
                    onCheckedChange={(checked) =>
                      setChecklistDialog({
                        ...checklistDialog,
                        checklist: { ...checklistDialog.checklist, [item.name]: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor={item.name} className="cursor-pointer">{item.label}</Label>
                </div>
              ))}
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

      <Dialog open={notesDialog.open} onOpenChange={(open) => !open && setNotesDialog({ open: false, assignmentId: null, type: "assignment", value: "", canEdit: false })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {notesDialog.type === "assignment" && "Assignment Notes"}
              {notesDialog.type === "packing" && "Packing Notes"}
              {notesDialog.type === "dispatch" && "Dispatch Notes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {notesDialog.canEdit ? (
              <>
                <Textarea
                  value={notesDialog.value}
                  onChange={(e) => setNotesDialog({ ...notesDialog, value: e.target.value })}
                  placeholder={`Enter ${notesDialog.type} notes...`}
                  rows={8}
                  className="resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setNotesDialog({ open: false, assignmentId: null, type: "assignment", value: "", canEdit: false })}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveNotesDialog}>
                    Save Notes
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="border rounded-lg p-4 bg-muted/50 min-h-[200px]">
                  <p className="text-sm whitespace-pre-wrap">{notesDialog.value || "No notes available"}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setNotesDialog({ open: false, assignmentId: null, type: "assignment", value: "", canEdit: false })}
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
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