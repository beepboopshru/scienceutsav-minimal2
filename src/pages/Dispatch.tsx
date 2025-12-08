import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Eye,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
  Truck,
  Printer,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { ColumnVisibility } from "@/components/ui/column-visibility";

export default function Dispatch() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  const canView = hasPermission("dispatch.view");
  const canEdit = hasPermission("dispatch.edit");
  const canEditAssignments = hasPermission("assignments.edit");
  const canEditPacking = hasPermission("packing.edit");

  // Fetch dispatch checklist configuration from Admin Zone
  const dispatchChecklistConfig = useQuery(api.dispatchChecklist.list);

  const assignments = useQuery(api.assignments.list);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);
  const batches = useQuery(api.batches.list);
  const programs = useQuery(api.programs.list);
  const customDispatches = useQuery(api.customDispatches.list);

  const updateStatus = useMutation(api.assignments.updateStatus);
  const updateNotes = useMutation(api.assignments.updateNotes);
  const updatePackingNotes = useMutation(api.assignments.updatePackingNotes);
  const updateDispatchNotes = useMutation(api.assignments.updateDispatchNotes);
  const createCustomDispatch = useMutation(api.customDispatches.create);
  const updateCustomDispatchStatus = useMutation(api.customDispatches.updateStatus);
  const deleteCustomDispatch = useMutation(api.customDispatches.deleteCustomDispatch);
  const getStorageUrl = useMutation(api.storage.getUrl);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all");
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [viewClientDialog, setViewClientDialog] = useState(false);
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [proofPhotoDialog, setProofPhotoDialog] = useState(false);
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});
  const [eWayDocument, setEWayDocument] = useState<File | null>(null);
  const [dispatchDocument, setDispatchDocument] = useState<File | null>(null);
  const [eWayNumber, setEWayNumber] = useState("");
  const [dispatchNumber, setDispatchNumber] = useState("");
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"assignments" | "custom">("assignments");

  // Initialize checklist items when dialog opens
  useEffect(() => {
    if (checklistDialog && dispatchChecklistConfig) {
      const initialChecklist: Record<string, boolean> = {};
      dispatchChecklistConfig.forEach(item => {
        initialChecklist[item._id] = false;
      });
      setChecklistItems(initialChecklist);
    }
  }, [checklistDialog, dispatchChecklistConfig]);

  // Filter assignments: show transferred_to_dispatch, ready_for_dispatch, and dispatched
  // Only delivered assignments are moved to order history
  let filteredAssignments = assignments?.filter(
    (a) => a.status === "transferred_to_dispatch" || a.status === "ready_for_dispatch" || a.status === "dispatched"
  ) || [];

  // Apply customer type filter
  if (customerTypeFilter !== "all") {
    filteredAssignments = filteredAssignments.filter(
      (a) => a.clientType === customerTypeFilter
    );
  }

  // Apply advanced filters
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedKitCategories, setSelectedKitCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  
  // Custom Dispatches state
  const [customDispatchDescription, setCustomDispatchDescription] = useState("");
  const [customDispatchStatus, setCustomDispatchStatus] = useState<"pending" | "dispatched" | "delivered">("pending");
  const [customDispatchTrackingNumber, setCustomDispatchTrackingNumber] = useState("");
  const [customDispatchRecipientName, setCustomDispatchRecipientName] = useState("");
  const [customDispatchRemarks, setCustomDispatchRemarks] = useState("");
  const [customDispatchSearchQuery, setCustomDispatchSearchQuery] = useState("");
  const [customDispatchStatusFilter, setCustomDispatchStatusFilter] = useState<string>("all");

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

  const toggleColumn = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId as keyof typeof prev]: !prev[columnId as keyof typeof prev],
    }));
  };

  // Handler for opening notes dialog
  const handleOpenNotesDialog = (
    assignmentId: Id<"assignments">,
    type: "assignment" | "packing" | "dispatch",
    value: string
  ) => {
    const editPermission = type === "assignment" 
      ? hasPermission("assignments", "edit")
      : type === "packing"
      ? hasPermission("packing", "edit")
      : hasPermission("dispatch", "edit");

    setNotesDialog({
      open: true,
      assignmentId,
      type,
      value,
      canEdit: editPermission,
    });
  };

  // Handler for saving notes
  const handleSaveNotesDialog = async () => {
    if (!notesDialog.assignmentId) return;

    try {
      if (notesDialog.type === "assignment") {
        await updateNotes({
          id: notesDialog.assignmentId,
          notes: notesDialog.value,
        });
        toast.success("Assignment notes updated");
      } else if (notesDialog.type === "packing") {
        await updatePackingNotes({
          id: notesDialog.assignmentId,
          packingNotes: notesDialog.value,
        });
        toast.success("Packing notes updated");
      } else if (notesDialog.type === "dispatch") {
        await updateDispatchNotes({
          id: notesDialog.assignmentId,
          dispatchNotes: notesDialog.value,
        });
        toast.success("Dispatch notes updated");
      }
      setNotesDialog({ open: false, assignmentId: null, type: "assignment", value: "", canEdit: false });
    } catch (error) {
      toast.error("Failed to update notes");
      console.error(error);
    }
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Apply advanced filters
  if (selectedPrograms.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) =>
      a.program ? selectedPrograms.includes(a.program._id) : false
    );
  }

  if (selectedKitCategories.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) =>
      a.kit?.category ? selectedKitCategories.includes(a.kit.category) : false
    );
  }

  if (selectedKits.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) =>
      selectedKits.includes(a.kitId)
    );
  }

  if (selectedClients.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) =>
      selectedClients.includes(a.clientId)
    );
  }

  if (selectedStatuses.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) =>
      selectedStatuses.includes(a.status)
    );
  }

  if (selectedProductionMonths.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) =>
      a.productionMonth ? selectedProductionMonths.includes(a.productionMonth) : false
    );
  }

  if (selectedDispatchMonths.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) => {
      if (!a.dispatchedAt) return false;
      const dispatchDate = new Date(a.dispatchedAt);
      const monthKey = `${dispatchDate.getFullYear()}-${String(dispatchDate.getMonth() + 1).padStart(2, "0")}`;
      return selectedDispatchMonths.includes(monthKey);
    });
  }

  // Apply search query
  if (searchTerm.trim()) {
    const query = searchTerm.toLowerCase();
    filteredAssignments = filteredAssignments.filter((a) => {
      const kitName = a.kit?.name?.toLowerCase() || "";
      const clientName = a.clientType === "b2b"
        ? (a.client as any)?.organization?.toLowerCase() || (a.client as any)?.name?.toLowerCase() || ""
        : (a.client as any)?.buyerName?.toLowerCase() || "";
      return kitName.includes(query) || clientName.includes(query);
    });
  }

  // Group by batch
  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    const batchKey = assignment.batchId || "standalone";
    if (!acc[batchKey]) {
      acc[batchKey] = [];
    }
    acc[batchKey].push(assignment);
    return acc;
  }, {} as Record<string, typeof filteredAssignments>);

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

  const handleViewClient = (assignment: any) => {
    // Merge client data with dispatch information from the assignment
    const clientWithDispatchInfo = {
      ...assignment.client,
      ewayNumber: assignment.ewayNumber,
      ewayDocumentId: assignment.ewayDocumentId,
      dispatchNumber: assignment.dispatchNumber,
      dispatchDocumentId: assignment.dispatchDocumentId,
      trackingLink: assignment.trackingLink,
      proofPhotoId: assignment.proofPhotoId,
      assignmentId: assignment._id,
    };
    setSelectedClientForView(clientWithDispatchInfo);
    setViewClientDialog(true);
  };

  const handleMarkAsDispatched = async (assignmentId: Id<"assignments">) => {
    try {
      await updateStatus({ id: assignmentId, status: "dispatched" });
      toast.success("Assignment marked as dispatched");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleClearAllFilters = () => {
    setCustomerTypeFilter("all");
    setSearchTerm("");
    setSelectedPrograms([]);
    setSelectedKitCategories([]);
    setSelectedKits([]);
    setSelectedClients([]);
    setSelectedStatuses([]);
    setSelectedProductionMonths([]);
    setSelectedDispatchMonths([]);
  };

  const handleStatusChange = async (assignmentId: Id<"assignments">, newStatus: string) => {
    if (newStatus === "ready_for_dispatch") {
      // Open checklist dialog only for ready_for_dispatch
      setSelectedAssignmentForDispatch(assignmentId);
      setChecklistItems({
        kitCount: false,
        bulkMaterials: false,
        workbookWorksheetConceptMap: false,
        spareKitsTools: false,
      });
      setChecklistDialog(true);
    } else if (newStatus === "dispatched") {
      // Open proof photo dialog for dispatched status
      setSelectedAssignmentForProof(assignmentId);
      setProofPhoto(null);
      setProofPhotoDialog(true);
    } else if (newStatus === "delivered") {
      // Show confirmation dialog for delivered status
      if (window.confirm("Are you sure this order has been delivered? This will move it to order history.")) {
        try {
          await updateStatus({ id: assignmentId, status: "delivered" });
          toast.success("Order marked as delivered and moved to order history");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to update status");
        }
      }
    } else {
      // Directly update status for other statuses
      try {
        await updateStatus({ id: assignmentId, status: newStatus as any });
        toast.success(`Status updated to ${newStatus.replace(/_/g, " ")}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update status");
      }
    }
  };

  const handleConfirmProofPhoto = async () => {
    if (!proofPhoto) {
      toast.error("Please upload a proof photo");
      return;
    }

    if (!selectedAssignmentForProof) return;

    try {
      setIsUploadingProof(true);

      // Convert proof photo to WebP
      const webpBlob = await convertToWebP(proofPhoto);
      const proofPhotoUploadUrl = await generateUploadUrl();
      const proofPhotoResponse = await fetch(proofPhotoUploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: webpBlob,
      });
      const { storageId: proofStorageId } = await proofPhotoResponse.json();

      await updateStatus({
        id: selectedAssignmentForProof,
        status: "dispatched",
        proofPhotoId: proofStorageId,
      });

      toast.success("Assignment marked as dispatched with proof photo");
      setProofPhotoDialog(false);
      setSelectedAssignmentForProof(null);
      setProofPhoto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleConfirmDispatch = async () => {
    const allChecked = Object.values(checklistItems).every((checked) => checked);
    
    if (!allChecked) {
      toast.error("Please verify all checklist items before marking as ready for dispatch");
      return;
    }

    if (!eWayNumber.trim()) {
      toast.error("Please enter the e-way number");
      return;
    }

    if (!eWayDocument) {
      toast.error("Please upload the e-way document");
      return;
    }

    if (!dispatchNumber.trim()) {
      toast.error("Please enter the dispatch number");
      return;
    }

    if (!dispatchDocument) {
      toast.error("Please upload the dispatch document");
      return;
    }

    if (!selectedAssignmentForDispatch) return;

    try {
      setIsUploadingDocument(true);

      // Convert documents to WebP
      const ewayWebpBlob = await convertToWebP(ewayDocument);
      const dispatchWebpBlob = await convertToWebP(dispatchDocument);

      // Upload e-way document
      const ewayUploadUrl = await generateUploadUrl();
      const ewayUploadResponse = await fetch(ewayUploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: ewayWebpBlob,
      });
      const { storageId: ewayStorageId } = await ewayUploadResponse.json();

      // Upload dispatch document
      const dispatchUploadUrl = await generateUploadUrl();
      const dispatchUploadResponse = await fetch(dispatchUploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: dispatchWebpBlob,
      });
      const { storageId: dispatchStorageId } = await dispatchUploadResponse.json();

      // Update assignment status with all information
      await updateStatus({
        id: selectedAssignmentForDispatch,
        status: "ready_for_dispatch",
        ewayNumber: eWayNumber.trim(),
        ewayDocumentId: ewayStorageId,
        dispatchNumber: dispatchNumber.trim(),
        dispatchDocumentId: dispatchStorageId,
        trackingLink: trackingLink.trim() || undefined,
      });

      toast.success("Assignment marked as ready for dispatch");
      setChecklistDialog(false);
      setSelectedAssignmentForDispatch(null);
      setChecklistItems({
        kitCount: false,
        bulkMaterials: false,
        workbookWorksheetConceptMap: false,
        spareKitsTools: false,
      });
      setEWayNumber("");
      setEWayDocument(null);
      setDispatchNumber("");
      setDispatchDocument(null);
      setTrackingLink("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const totalQuantity = filteredAssignments.reduce((sum, a) => sum + a.quantity, 0);

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dispatch Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage assignments ready for dispatch
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBoxContentDialogOpen(true)}
            >
              <Package className="h-4 w-4 mr-2" />
              Box Content
            </Button>
            <Button
              variant="outline"
              onClick={() => setClientDetailsDialogOpen(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Client Details
            </Button>
          </div>
        </div>

        <Tabs defaultValue="assignments" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="custom">Custom Dispatches</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 border rounded-lg bg-card">
                <div className="text-sm text-muted-foreground mb-1">Total Assignments</div>
                <div className="text-2xl font-bold">{filteredAssignments.length}</div>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <div className="text-sm text-muted-foreground mb-1">Total Quantity</div>
                <div className="text-2xl font-bold">{totalQuantity}</div>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <div className="text-sm text-muted-foreground mb-1">Selected</div>
                <div className="text-2xl font-bold">{selectedAssignments.size}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by kit name or client name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={customerTypeFilter} onValueChange={(v: any) => setCustomerTypeFilter(v)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Customer Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="b2b">B2B</SelectItem>
                    <SelectItem value="b2c">B2C</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <AssignmentFilters
                programs={programs || []}
                kits={kits || []}
                clients={clients || []}
                assignments={assignments || []}
                selectedPrograms={selectedPrograms}
                selectedCategories={selectedKitCategories}
                selectedKits={selectedKits}
                selectedClients={selectedClients}
                selectedDispatchMonths={selectedDispatchMonths}
                selectedStatuses={selectedStatuses}
                selectedProductionMonths={selectedProductionMonths}
                onProgramsChange={setSelectedPrograms}
                onCategoriesChange={setSelectedKitCategories}
                onKitsChange={setSelectedKits}
                onClientsChange={setSelectedClients}
                onDispatchMonthsChange={setSelectedDispatchMonths}
                onStatusesChange={setSelectedStatuses}
                onProductionMonthsChange={setSelectedProductionMonths}
                onClearAll={handleClearAllFilters}
              />
              <ColumnVisibility columns={columns} onToggle={toggleColumn} />
            </div>

            {/* Assignments Table */}
            <div className="border rounded-lg overflow-x-auto">
              {!filteredAssignments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No assignments ready for dispatch.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
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
                      const isExpanded = expandedBatches.has(batchKey);
                      const batch = batchKey !== "standalone" ? batches?.find((b) => b._id === batchKey) : null;
                      const totalQty = batchAssignments.reduce((sum, a) => sum + a.quantity, 0);

                      if (batchKey === "standalone") {
                        return batchAssignments.map((assignment) => (
                          <TableRow key={assignment._id} className="border-b hover:bg-muted/30">
                            {canEdit && (
                              <TableCell className="p-4">
                                <Checkbox
                                  checked={selectedAssignments.has(assignment._id)}
                                  onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="p-4">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {assignment.clientType === "b2b"
                                    ? (assignment.client as any)?.organization || (assignment.client as any)?.name
                                    : (assignment.client as any)?.buyerName}
                                </span>
                                <Badge variant="outline" className="w-fit mt-1">
                                  {assignment.clientType?.toUpperCase() || "N/A"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="p-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{assignment.kit?.name}</span>
                                {assignment.kit?.category && (
                                  <span className="text-xs text-muted-foreground">{assignment.kit.category}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-4">{assignment.quantity}</TableCell>
                            <TableCell className="p-4">
                              {assignment.grade ? (
                                <Badge variant="outline">Grade {assignment.grade}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            {columnVisibility.status && (
                              <TableCell className="p-4">
                                {canEdit ? (
                                  <Select
                                    value={assignment.status}
                                    onValueChange={(value) => handleStatusChange(assignment._id, value as any)}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="transferred_to_dispatch">Transferred to Dispatch</SelectItem>
                                      <SelectItem value="ready_for_dispatch">Ready for Dispatch</SelectItem>
                                      <SelectItem value="dispatched">Dispatched</SelectItem>
                                      <SelectItem value="delivered">Delivered</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant={
                                    assignment.status === "dispatched" ? "default" : 
                                    assignment.status === "delivered" ? "default" : 
                                    "secondary"
                                  }>
                                    {assignment.status}
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="p-4">
                              {assignment.dispatchedAt
                                ? new Date(assignment.dispatchedAt).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            <TableCell className="p-4">
                              {assignment.productionMonth
                                ? new Date(assignment.productionMonth).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            {columnVisibility.notes && (
                              <TableCell className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() =>
                                            handleOpenNotesDialog(
                                              assignment._id,
                                              "assignment",
                                              assignment.notes || ""
                                            )
                                          }
                                          className="h-8 w-8"
                                        >
                                          <FileText className="h-4 w-4 text-blue-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Assignment Notes</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() =>
                                            handleOpenNotesDialog(
                                              assignment._id,
                                              "packing",
                                              assignment.packingNotes || ""
                                            )
                                          }
                                          className="h-8 w-8"
                                        >
                                          <MessageSquare className="h-4 w-4 text-green-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Packing Notes</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() =>
                                            handleOpenNotesDialog(
                                              assignment._id,
                                              "dispatch",
                                              assignment.remarks || ""
                                            )
                                          }
                                          className="h-8 w-8"
                                        >
                                          <Truck className="h-4 w-4 text-orange-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Dispatch Notes</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            )}
                            {canEdit && (
                              <TableCell className="p-4">
                                <div className="flex items-center justify-end gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleViewClient(assignment)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Client Details</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ));
                      }

                      return (
                        <>
                          <TableRow
                            key={`batch-${batchKey}`}
                            className="bg-muted/20 border-b cursor-pointer hover:bg-muted/40"
                            onClick={() => toggleBatch(batchKey)}
                          >
                            {canEdit && (
                              <TableCell className="p-4">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5" />
                                )}
                              </TableCell>
                            )}
                            <TableCell colSpan={canEdit ? 11 : 12} className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div>
                                    <span className="font-semibold">Batch: {batch?.batchId || batchKey}</span>
                                    <span className="text-sm text-muted-foreground ml-4">
                                      {batchAssignments.length} assignments • {totalQty} total quantity
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded &&
                            batchAssignments.map((assignment) => (
                              <TableRow key={assignment._id} className="border-b hover:bg-muted/30">
                                {canEdit && (
                                  <TableCell className="p-4">
                                    <Checkbox
                                      checked={selectedAssignments.has(assignment._id)}
                                      onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="p-4 pl-12">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {assignment.clientType === "b2b"
                                        ? (assignment.client as any)?.organization || (assignment.client as any)?.name
                                        : (assignment.client as any)?.buyerName}
                                    </span>
                                    <Badge variant="outline" className="w-fit mt-1">
                                      {assignment.clientType?.toUpperCase() || "N/A"}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="p-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{assignment.kit?.name}</span>
                                    {assignment.kit?.category && (
                                      <span className="text-xs text-muted-foreground">{assignment.kit.category}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="p-4">{assignment.quantity}</TableCell>
                                <TableCell className="p-4">
                                  {assignment.grade ? (
                                    <Badge variant="outline">Grade {assignment.grade}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="p-4">
                                  <Badge variant={
                                    assignment.status === "dispatched" ? "default" : 
                                    assignment.status === "delivered" ? "default" : 
                                    "secondary"
                                  }>
                                    {assignment.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="p-4">
                                  {assignment.dispatchedAt
                                    ? new Date(assignment.dispatchedAt).toLocaleDateString()
                                    : "-"}
                                </TableCell>
                                <TableCell className="p-4">
                                  {assignment.productionMonth
                                    ? new Date(assignment.productionMonth).toLocaleDateString()
                                    : "-"}
                                </TableCell>
                                <TableCell className="p-4">
                                  {assignment.remarks || <span className="text-muted-foreground italic">No remarks</span>}
                                </TableCell>
                                <TableCell className="p-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleViewClient(assignment)}
                                      title="View Client Details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {canEdit && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="outline" size="sm">
                                            Change Status
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => handleStatusChange(assignment._id, "transferred_to_dispatch")}
                                            disabled={assignment.status === "transferred_to_dispatch"}
                                          >
                                            Transferred to Dispatch
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleStatusChange(assignment._id, "ready_for_dispatch")}
                                            disabled={assignment.status === "ready_for_dispatch"}
                                          >
                                            Ready for Dispatch
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleStatusChange(assignment._id, "dispatched")}
                                            disabled={assignment.status === "dispatched"}
                                          >
                                            Dispatched
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleStatusChange(assignment._id, "delivered")}
                                            disabled={assignment.status === "delivered"}
                                          >
                                            Delivered
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom">
            {/* Create Custom Dispatch Form */}
            <div className="border rounded-lg p-6 mb-6 bg-card">
              <h2 className="text-xl font-semibold mb-4">Create Custom Dispatch</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="custom-description">Description *</Label>
                  <Input
                    id="custom-description"
                    placeholder="Enter dispatch description..."
                    value={customDispatchDescription}
                    onChange={(e) => setCustomDispatchDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-recipient">Recipient Name</Label>
                  <Input
                    id="custom-recipient"
                    placeholder="Enter recipient name..."
                    value={customDispatchRecipientName}
                    onChange={(e) => setCustomDispatchRecipientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-tracking">Tracking Number</Label>
                  <Input
                    id="custom-tracking"
                    placeholder="Enter tracking number..."
                    value={customDispatchTrackingNumber}
                    onChange={(e) => setCustomDispatchTrackingNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-status">Status</Label>
                  <Select value={customDispatchStatus} onValueChange={(v: any) => setCustomDispatchStatus(v)}>
                    <SelectTrigger id="custom-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="dispatched">Dispatched</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-remarks">Remarks</Label>
                  <Input
                    id="custom-remarks"
                    placeholder="Enter remarks..."
                    value={customDispatchRemarks}
                    onChange={(e) => setCustomDispatchRemarks(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={() => createCustomDispatch({
                description: customDispatchDescription,
                status: customDispatchStatus,
                recipientName: customDispatchRecipientName || undefined,
                trackingNumber: customDispatchTrackingNumber || undefined,
                remarks: customDispatchRemarks || undefined,
              })} className="mt-4" disabled={!canEdit}>
                Create Custom Dispatch
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by description, recipient, or tracking number..."
                    value={customDispatchSearchQuery}
                    onChange={(e) => setCustomDispatchSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={customDispatchStatusFilter} onValueChange={setCustomDispatchStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Dispatches Table */}
            <div className="border rounded-lg overflow-x-auto">
              {!customDispatches ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : customDispatches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No custom dispatches found.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Date</th>
                      <th className="text-left p-4 font-semibold">Description</th>
                      <th className="text-left p-4 font-semibold">Recipient</th>
                      <th className="text-left p-4 font-semibold">Tracking Number</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Created By</th>
                      <th className="text-left p-4 font-semibold">Remarks</th>
                      {canEdit && <th className="text-right p-4 font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {customDispatches.map((dispatch: any) => (
                      <tr key={dispatch._id} className="border-b hover:bg-muted/30">
                        <td className="p-4">
                          {new Date(dispatch._creationTime).toLocaleDateString()}
                        </td>
                        <td className="p-4">{dispatch.description}</td>
                        <td className="p-4">{dispatch.recipientName || "-"}</td>
                        <td className="p-4">{dispatch.trackingNumber || "-"}</td>
                        <td className="p-4">
                          {canEdit ? (
                            <Select
                              value={dispatch.status}
                              onValueChange={(v: any) => updateCustomDispatchStatus({
                                id: dispatch._id,
                                status: v as "pending" | "dispatched" | "delivered"
                              })}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="dispatched">Dispatched</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant={
                                dispatch.status === "delivered"
                                  ? "default"
                                  : dispatch.status === "dispatched"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {dispatch.status}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">{dispatch.createdByName}</td>
                        <td className="p-4">{dispatch.remarks || "-"}</td>
                        {canEdit && (
                          <td className="p-4 text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteCustomDispatch({ id: dispatch._id })}
                              disabled={!canEdit}
                            >
                              Delete
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* View Client Dialog */}
        <Dialog open={viewClientDialog} onOpenChange={setViewClientDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dispatch & Client Details</DialogTitle>
              <DialogDescription>
                {selectedClientForView?.organization || selectedClientForView?.buyerName || selectedClientForView?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Dispatch Information Section */}
              {selectedClientForView && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Dispatch Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(selectedClientForView as any).ewayNumber && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">E-Way Number</span>
                          <div className="text-base">{(selectedClientForView as any).ewayNumber}</div>
                        </div>
                      )}
                      {(selectedClientForView as any).dispatchNumber && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Dispatch Number</span>
                          <div className="text-base">{(selectedClientForView as any).dispatchNumber}</div>
                        </div>
                      )}
                      {(selectedClientForView as any).ewayDocumentId && ewayDocUrl && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">E-Way Document</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(ewayDocUrl, '_blank')}
                            className="mt-1"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </Button>
                        </div>
                      )}
                      {(selectedClientForView as any).dispatchDocumentId && dispatchDocUrl && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Dispatch Document</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(dispatchDocUrl, '_blank')}
                            className="mt-1"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </Button>
                        </div>
                      )}
                      {(selectedClientForView as any).trackingLink && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Tracking Link</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open((selectedClientForView as any).trackingLink, '_blank')}
                            className="mt-1"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Track Shipment
                          </Button>
                        </div>
                      )}
                      {(selectedClientForView as any).proofPhotoId && proofPhotoUrl && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Proof Photo</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(proofPhotoUrl, '_blank')}
                            className="mt-1"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Photo
                          </Button>
                        </div>
                      )}
                    </div>
                    {!(selectedClientForView as any).ewayNumber && 
                     !(selectedClientForView as any).dispatchNumber && 
                     !(selectedClientForView as any).ewayDocumentId && 
                     !(selectedClientForView as any).dispatchDocumentId && (
                      <p className="text-sm text-muted-foreground italic">No dispatch information available yet</p>
                    )}
                  </div>
              )}

              {/* Client Information Section */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Client Information
                </h3>
                <div className="space-y-3">
                  {selectedClientForView?.organization && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Organization:</span>
                      <span>{selectedClientForView.organization}</span>
                    </div>
                  )}
                  {selectedClientForView?.contact && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Phone:</span>
                      <span>{selectedClientForView.contact}</span>
                    </div>
                  )}
                  {selectedClientForView?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Phone:</span>
                      <span>{selectedClientForView.phone}</span>
                    </div>
                  )}
                  {selectedClientForView?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Email:</span>
                      <span>{selectedClientForView.email}</span>
                    </div>
                  )}
                  {selectedClientForView?.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="font-medium">Address:</span>
                        <div className="text-sm mt-1">
                          <div>{selectedClientForView.address.line1}</div>
                          {selectedClientForView.address.line2 && <div>{selectedClientForView.address.line2}</div>}
                          {selectedClientForView.address.line3 && <div>{selectedClientForView.address.line3}</div>}
                          <div>{selectedClientForView.address.state} - {selectedClientForView.address.pincode}</div>
                          <div>{selectedClientForView.address.country}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedClientForView?.salesPerson && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Sales Person:</span>
                      <span>{selectedClientForView.salesPerson}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewClientDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispatch Checklist Dialog */}
        <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ready for Dispatch Checklist</DialogTitle>
              <DialogDescription>
                Please verify all items before marking as ready for dispatch
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {dispatchChecklistConfig && dispatchChecklistConfig.length > 0 ? (
                dispatchChecklistConfig.map((item) => (
                  <div key={item._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={item._id}
                      checked={checklistItems[item._id] || false}
                      onCheckedChange={(checked) =>
                        setChecklistItems((prev) => ({ ...prev, [item._id]: checked as boolean }))
                      }
                    />
                    <Label htmlFor={item._id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {item.label}
                    </Label>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No checklist items configured. Please configure them in Admin Zone.
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="ewayNumber">E-Way Number *</Label>
                <Input
                  id="ewayNumber"
                  placeholder="Enter e-way number..."
                  value={eWayNumber}
                  onChange={(e) => setEWayNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ewayDocument">E-Way Document (PNG/JPEG/WEBP) *</Label>
                <Input
                  id="ewayDocument"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        toast.error('Please upload a PNG, JPEG, or WEBP file');
                        e.target.value = '';
                        return;
                      }
                      setEWayDocument(file);
                    }
                  }}
                />
                {eWayDocument && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {eWayDocument.name} (will be converted to WebP)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dispatchNumber">Dispatch Number *</Label>
                <Input
                  id="dispatchNumber"
                  placeholder="Enter dispatch number..."
                  value={dispatchNumber}
                  onChange={(e) => setDispatchNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dispatchDocument">Dispatch Document (PNG/JPEG/WEBP) *</Label>
                <Input
                  id="dispatchDocument"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        toast.error('Please upload a PNG, JPEG, or WEBP file');
                        e.target.value = '';
                        return;
                      }
                      setDispatchDocument(file);
                    }
                  }}
                />
                {dispatchDocument && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {dispatchDocument.name} (will be converted to WebP)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="trackingLink">Tracking Link (Optional)</Label>
                <Input
                  id="trackingLink"
                  type="url"
                  placeholder="Enter tracking URL..."
                  value={trackingLink}
                  onChange={(e) => setTrackingLink(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setChecklistDialog(false);
                setEWayNumber("");
                setEWayDocument(null);
                setDispatchNumber("");
                setDispatchDocument(null);
                setTrackingLink("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleConfirmDispatch} disabled={isUploadingDocument}>
                {isUploadingDocument ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Confirm Ready for Dispatch"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proof Photo Dialog */}
        <Dialog open={proofPhotoDialog} onOpenChange={setProofPhotoDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Proof Photo</DialogTitle>
              <DialogDescription>
                Please upload a proof photo before marking as dispatched
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="proofPhoto">Proof Photo (PNG/JPEG/WEBP) *</Label>
                <Input
                  id="proofPhoto"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        toast.error('Please upload a PNG, JPEG, or WEBP file');
                        e.target.value = '';
                        return;
                      }
                      setProofPhoto(file);
                    }
                  }}
                />
                {proofPhoto && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {proofPhoto.name} (will be converted to WebP)
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setProofPhotoDialog(false);
                setProofPhoto(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleConfirmProofPhoto} disabled={isUploadingProof}>
                {isUploadingProof ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Confirm Dispatched"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Client Details Generator Dialog */}
        <Dialog open={clientDetailsDialogOpen} onOpenChange={setClientDetailsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Client Address Label</DialogTitle>
              <DialogDescription>
                Select a client and point of contact to generate an A5 address label
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="client-select">Select Client</Label>
                <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientComboboxOpen}
                      className="w-full justify-between"
                    >
                      {selectedClientForLabel ? (() => {
                        const allClients = [...(clients || []), ...(b2cClients || [])];
                        const client = allClients.find((c) => c._id === selectedClientForLabel);
                        if (!client) return "Select client...";
                        const clientName = (client as any).organization || (client as any).buyerName || (client as any).name || "";
                        const clientType = clients?.some((c) => c._id === selectedClientForLabel) ? "B2B" : "B2C";
                        return `${clientName} (${clientType})`;
                      })() : "Select client..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {[...(clients || []), ...(b2cClients || [])].map((client) => {
                            const clientName = (client as any).organization || (client as any).buyerName || (client as any).name || "";
                            const clientType = clients?.some((c) => c._id === client._id) ? "B2B" : "B2C";
                            return (
                              <CommandItem
                                key={client._id}
                                value={`${clientName} ${clientType}`}
                                onSelect={() => {
                                  setSelectedClientForLabel(client._id);
                                  setSelectedPOC("");
                                  setClientComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedClientForLabel === client._id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{clientName}</span>
                                  <span className="text-xs text-muted-foreground">{clientType}</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedClientForLabel && (() => {
                const allClients = [...(clients || []), ...(b2cClients || [])];
                const client = allClients.find((c) => c._id === selectedClientForLabel);
                const pocs = client?.pointsOfContact || [];
                
                return pocs.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="poc-select">Select Point of Contact</Label>
                    <Select value={selectedPOC} onValueChange={setSelectedPOC}>
                      <SelectTrigger id="poc-select">
                        <SelectValue placeholder="Choose a POC..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pocs.map((poc: any, index: number) => (
                          <SelectItem key={index} value={poc.name}>
                            {poc.name}{poc.designation ? ` - ${poc.designation}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
                    This client has no points of contact configured.
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label htmlFor="customer-id">Customer ID (Optional)</Label>
                <Input
                  id="customer-id"
                  placeholder="Enter customer ID..."
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setClientDetailsDialogOpen(false);
                setSelectedClientForLabel("");
                setSelectedPOC("");
                setCustomerId("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleGenerateClientLabel}>
                Generate Label
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Notes Dialog */}
        <Dialog open={notesDialog.open} onOpenChange={(open) => setNotesDialog({ ...notesDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {notesDialog.type === "assignment" && "Assignment Notes"}
                {notesDialog.type === "packing" && "Packing Notes"}
                {notesDialog.type === "dispatch" && "Dispatch Notes"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={notesDialog.value}
                onChange={(e) => setNotesDialog({ ...notesDialog, value: e.target.value })}
                placeholder="Enter notes..."
                rows={6}
                disabled={!notesDialog.canEdit}
              />
            </div>
            <DialogFooter>
              {notesDialog.canEdit && (
                <Button onClick={handleSaveNotesDialog}>Save Notes</Button>
              )}
              <Button
                variant="outline"
                onClick={() => setNotesDialog({ open: false, assignmentId: null, type: "assignment", value: "", canEdit: false })}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}