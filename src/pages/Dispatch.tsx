import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Search, ChevronDown, ChevronRight, Eye, Building2, User, Mail, Phone, MapPin, CheckCircle2, MoreVertical, FileText, Check, ChevronsUpDown, Plus, Package, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Helper function to convert image to WebP
async function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert image"));
        },
        "image/webp",
        0.9
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export default function Dispatch() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const assignments = useQuery(api.assignments.list, {});
  const kits = useQuery(api.kits.list, {});
  const clients = useQuery(api.clients.list, {});
  const b2cClients = useQuery(api.b2cClients.list, {});
  const batches = useQuery(api.batches.list, {});
  const programs = useQuery(api.programs.list);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const updateRemarks = useMutation(api.assignments.updateRemarks);
  const createCustomDispatch = useMutation(api.orderHistory.createCustomDispatch);

  const canView = hasPermission("dispatch", "view");
  const canEdit = hasPermission("dispatch", "edit");

  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "b2b" | "b2c">("all");
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [viewClientDialogOpen, setViewClientDialogOpen] = useState(false);
  const [selectedAssignmentForView, setSelectedAssignmentForView] = useState<any>(null);
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());

  // Ready for dispatch dialog
  const [readyForDispatchDialogOpen, setReadyForDispatchDialogOpen] = useState(false);
  const [selectedAssignmentForReady, setSelectedAssignmentForReady] = useState<any>(null);
  const [readyChecklist, setReadyChecklist] = useState({
    check1: false,
    check2: false,
    check3: false,
    check4: false,
  });
  const [ewayNumber, setEwayNumber] = useState("");
  const [ewayDocFile, setEwayDocFile] = useState<File | null>(null);
  const [dispatchNumber, setDispatchNumber] = useState("");
  const [dispatchDocFile, setDispatchDocFile] = useState<File | null>(null);
  const [trackingLink, setTrackingLink] = useState("");

  // Proof photo dialog
  const [proofPhotoDialogOpen, setProofPhotoDialogOpen] = useState(false);
  const [selectedAssignmentForProof, setSelectedAssignmentForProof] = useState<any>(null);
  const [proofPhotoFile, setProofPhotoFile] = useState<File | null>(null);

  // Remarks editing state
  const [editingRemarks, setEditingRemarks] = useState<string | null>(null);
  const [remarksValue, setRemarksValue] = useState<Record<string, string>>({});
  const [originalRemarks, setOriginalRemarks] = useState<Record<string, string>>({});

  // Create Dispatch dialog state
  const [showCreateDispatchDialog, setShowCreateDispatchDialog] = useState(false);
  const [createDispatchData, setCreateDispatchData] = useState({
    clientType: "b2b" as "b2b" | "b2c",
    clientId: "",
    customName: "",
    remarks: "",
    dispatchNumber: "",
    ewayNumber: "",
    trackingLink: "",
  });
  const [createDispatchDocFile, setCreateDispatchDocFile] = useState<File | null>(null);
  const [createDispatchEwayFile, setCreateDispatchEwayFile] = useState<File | null>(null);

  // Storage URLs for the selected assignment
  const ewayDocUrl = useQuery(api.storage.getUrl, selectedAssignmentForView?.ewayDocumentId ? { storageId: selectedAssignmentForView.ewayDocumentId } : "skip");
  const dispatchDocUrl = useQuery(api.storage.getUrl, selectedAssignmentForView?.dispatchDocumentId ? { storageId: selectedAssignmentForView.dispatchDocumentId } : "skip");
  const proofPhotoUrl = useQuery(api.storage.getUrl, selectedAssignmentForView?.proofPhotoId ? { storageId: selectedAssignmentForView.proofPhotoId } : "skip");

  // Advanced filters
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedKitCategories, setSelectedKitCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
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

  // Filter assignments for dispatch view
  let filteredAssignments = assignments?.filter((a) =>
    ["transferred_to_dispatch", "ready_for_dispatch", "dispatched"].includes(a.status)
  ) || [];

  // Apply customer type filter
  if (customerTypeFilter !== "all") {
    filteredAssignments = filteredAssignments.filter((a) => a.clientType === customerTypeFilter);
  }

  // Apply advanced filters
  if (selectedPrograms.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) => {
      const kit = kits?.find((k) => k._id === a.kitId);
      return kit && selectedPrograms.includes(kit.programId);
    });
  }

  if (selectedKitCategories.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) => {
      const kit = kits?.find((k) => k._id === a.kitId);
      return kit?.category && selectedKitCategories.includes(kit.category);
    });
  }

  if (selectedKits.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) => selectedKits.includes(a.kitId));
  }

  if (selectedClients.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) => selectedClients.includes(a.clientId));
  }

  if (selectedStatuses.length > 0) {
    filteredAssignments = filteredAssignments.filter((a) => selectedStatuses.includes(a.status));
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
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredAssignments = filteredAssignments.filter((a) => {
      const kit = kits?.find((k) => k._id === a.kitId);
      const kitName = kit?.name?.toLowerCase() || "";
      const client = a.clientType === "b2b"
        ? clients?.find((c) => c._id === a.clientId)
        : b2cClients?.find((c) => c._id === a.clientId);
      const clientName = a.clientType === "b2b"
        ? ((client as any)?.organization?.toLowerCase() || (client as any)?.name?.toLowerCase() || "")
        : ((client as any)?.buyerName?.toLowerCase() || "");
      return kitName.includes(query) || clientName.includes(query);
    });
  }

  // Group assignments by batch
  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    const batchKey = assignment.batchId || "no-batch";
    if (!acc[batchKey]) {
      acc[batchKey] = [];
    }
    acc[batchKey].push(assignment);
    return acc;
  }, {} as Record<string, typeof filteredAssignments>);

  const toggleBatch = (batchKey: string) => {
    setOpenBatches((prev) => {
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
    setSelectedAssignmentForView(assignment);
    setViewClientDialogOpen(true);
  };

  const handleStatusChange = async (assignmentId: Id<"assignments">, newStatus: string) => {
    if (newStatus === "ready_for_dispatch") {
      const assignment = filteredAssignments.find((a) => a._id === assignmentId);
      setSelectedAssignmentForReady(assignment);
      setReadyForDispatchDialogOpen(true);
      return;
    }

    if (newStatus === "dispatched") {
      const assignment = filteredAssignments.find((a) => a._id === assignmentId);
      setSelectedAssignmentForProof(assignment);
      setProofPhotoDialogOpen(true);
      return;
    }

    if (newStatus === "delivered") {
      if (confirm("Mark this assignment as delivered? It will be moved to order history.")) {
        try {
          await updateStatus({ id: assignmentId, status: newStatus as any });
          toast.success("Assignment marked as delivered and moved to order history");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to update status");
        }
      }
      return;
    }

    try {
      await updateStatus({ id: assignmentId, status: newStatus as any });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleReadyForDispatch = async () => {
    if (!selectedAssignmentForReady) return;
    if (!readyChecklist.check1 || !readyChecklist.check2 || !readyChecklist.check3 || !readyChecklist.check4) {
      toast.error("Please complete all checklist items");
      return;
    }
    if (!ewayNumber || !dispatchNumber) {
      toast.error("Please enter E-Way Number and Dispatch Number");
      return;
    }

    try {
      let ewayDocId: Id<"_storage"> | undefined;
      let dispatchDocId: Id<"_storage"> | undefined;

      if (ewayDocFile) {
        const webpBlob = await convertToWebP(ewayDocFile);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: webpBlob,
        });
        const { storageId } = await response.json();
        ewayDocId = storageId;
      }

      if (dispatchDocFile) {
        const webpBlob = await convertToWebP(dispatchDocFile);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: webpBlob,
        });
        const { storageId } = await response.json();
        dispatchDocId = storageId;
      }

      await updateStatus({
        id: selectedAssignmentForReady._id,
        status: "ready_for_dispatch",
        ewayNumber,
        ewayDocumentId: ewayDocId,
        dispatchNumber,
        dispatchDocumentId: dispatchDocId,
        trackingLink: trackingLink || undefined,
      });

      toast.success("Assignment marked as ready for dispatch");
      setReadyForDispatchDialogOpen(false);
      setReadyChecklist({ check1: false, check2: false, check3: false, check4: false });
      setEwayNumber("");
      setEwayDocFile(null);
      setDispatchNumber("");
      setDispatchDocFile(null);
      setTrackingLink("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleProofPhotoUpload = async () => {
    if (!selectedAssignmentForProof || !proofPhotoFile) {
      toast.error("Please select a proof photo");
      return;
    }

    try {
      const webpBlob = await convertToWebP(proofPhotoFile);
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: webpBlob,
      });
      const { storageId } = await response.json();

      await updateStatus({
        id: selectedAssignmentForProof._id,
        status: "dispatched",
        proofPhotoId: storageId,
      });

      toast.success("Assignment marked as dispatched with proof photo");
      setProofPhotoDialogOpen(false);
      setProofPhotoFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload proof photo");
    }
  };

  const handleStartEditingRemarks = (assignmentId: string, currentRemarks: string) => {
    if (!canEdit) {
      toast.error("You don't have permission to edit remarks");
      return;
    }
    setEditingRemarks(assignmentId);
    setRemarksValue({ ...remarksValue, [assignmentId]: currentRemarks || "" });
    setOriginalRemarks({ ...originalRemarks, [assignmentId]: currentRemarks || "" });
  };

  const handleCancelEditingRemarks = (assignmentId: string) => {
    setEditingRemarks(null);
    setRemarksValue({ ...remarksValue, [assignmentId]: originalRemarks[assignmentId] || "" });
  };

  const handleSaveRemarks = async (assignmentId: string) => {
    try {
      await updateRemarks({
        id: assignmentId as Id<"assignments">,
        remarks: remarksValue[assignmentId] || "",
      });
      toast.success("Remarks updated successfully");
      setEditingRemarks(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update remarks");
    }
  };

  const handleRemarksInputChange = (assignmentId: string, value: string) => {
    setRemarksValue({ ...remarksValue, [assignmentId]: value });
  };

  const handleCreateDispatch = async () => {
    if (!createDispatchData.clientId || !createDispatchData.customName) {
      toast.error("Please select a client and enter a name");
      return;
    }

    try {
      let dispatchDocId: Id<"_storage"> | undefined;
      let ewayDocId: Id<"_storage"> | undefined;

      if (createDispatchDocFile) {
        const webpBlob = await convertToWebP(createDispatchDocFile);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, { method: "POST", body: webpBlob });
        const { storageId } = await response.json();
        dispatchDocId = storageId;
      }

      if (createDispatchEwayFile) {
        const webpBlob = await convertToWebP(createDispatchEwayFile);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, { method: "POST", body: webpBlob });
        const { storageId } = await response.json();
        ewayDocId = storageId;
      }

      await createCustomDispatch({
        clientId: createDispatchData.clientId,
        clientType: createDispatchData.clientType,
        customName: createDispatchData.customName,
        remarks: createDispatchData.remarks || undefined,
        dispatchNumber: createDispatchData.dispatchNumber || undefined,
        dispatchDocumentId: dispatchDocId,
        ewayNumber: createDispatchData.ewayNumber || undefined,
        ewayDocumentId: ewayDocId,
        trackingLink: createDispatchData.trackingLink || undefined,
      });

      toast.success("Custom dispatch created successfully");
      setShowCreateDispatchDialog(false);
      setCreateDispatchData({
        clientType: "b2b",
        clientId: "",
        customName: "",
        remarks: "",
        dispatchNumber: "",
        ewayNumber: "",
        trackingLink: "",
      });
      setCreateDispatchDocFile(null);
      setCreateDispatchEwayFile(null);
    } catch (error) {
      console.error("Error creating custom dispatch:", error);
      toast.error("Failed to create custom dispatch");
    }
  };

  const handleClearAllFilters = () => {
    setCustomerTypeFilter("all");
    setSearchQuery("");
    setSelectedPrograms([]);
    setSelectedKitCategories([]);
    setSelectedKits([]);
    setSelectedClients([]);
    setSelectedDispatchMonths([]);
    setSelectedStatuses([]);
    setSelectedProductionMonths([]);
  };

  const totalQuantity = filteredAssignments.reduce((sum, a) => sum + a.quantity, 0);

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dispatch Management</h1>
            <p className="text-muted-foreground">
              Manage assignments ready for dispatch
            </p>
          </div>
          <Button onClick={() => setShowCreateDispatchDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Dispatch
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by kit name or client name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
            clients={[...(clients || []), ...(b2cClients || [])]}
            assignments={filteredAssignments}
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

          <Button variant="outline" onClick={handleClearAllFilters}>
            Clear All Filters
          </Button>
        </div>

        {/* Assignments Grouped by Batch */}
        <div className="space-y-4">
          {!filteredAssignments ? (
            <div className="flex items-center justify-center py-12 border rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12 border rounded-lg text-muted-foreground">
              No assignments found for dispatch.
            </div>
          ) : (
            Object.entries(groupedAssignments).map(([batchKey, batchAssignments]) => {
              const batchInfo = batchAssignments[0]?.batchId
                ? batches?.find((b) => b._id === batchAssignments[0].batchId)
                : null;
              const isOpen = openBatches.has(batchKey);
              const batchQuantity = batchAssignments.reduce((sum, a) => sum + a.quantity, 0);

              return (
                <Collapsible
                  key={batchKey}
                  open={isOpen}
                  onOpenChange={() => toggleBatch(batchKey)}
                  className="border rounded-lg overflow-hidden"
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`h-5 w-5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          <div className="font-semibold">
                            {batchKey === "no-batch" ? "Standalone Assignments" : batchInfo?.batchId || batchKey}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {batchAssignments.length} assignments • {batchQuantity} total quantity
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{batchAssignments.length}</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/20 border-t">
                          <tr className="border-b">
                            <th className="text-left p-4 font-semibold">Customer</th>
                            <th className="text-left p-4 font-semibold">Kit</th>
                            <th className="text-left p-4 font-semibold">Quantity</th>
                            <th className="text-left p-4 font-semibold">Grade</th>
                            <th className="text-left p-4 font-semibold">Status</th>
                            <th className="text-left p-4 font-semibold">Dispatch Date</th>
                            <th className="text-left p-4 font-semibold">Remarks</th>
                            <th className="text-right p-4 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchAssignments.map((assignment) => {
                            const kit = kits?.find((k) => k._id === assignment.kitId);
                            const client = assignment.clientType === "b2b"
                              ? clients?.find((c) => c._id === assignment.clientId)
                              : b2cClients?.find((c) => c._id === assignment.clientId);
                            const isEditing = editingRemarks === assignment._id;

                            return (
                              <tr key={assignment._id} className="border-b hover:bg-muted/20">
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {assignment.clientType === "b2b"
                                        ? (client as any)?.organization || (client as any)?.name
                                        : (client as any)?.buyerName}
                                    </span>
                                    <Badge variant="outline" className="w-fit mt-1">
                                      {assignment.clientType?.toUpperCase() || "N/A"}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{kit?.name}</span>
                                    {kit?.category && (
                                      <span className="text-xs text-muted-foreground">{kit.category}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">{assignment.quantity}</td>
                                <td className="p-4">
                                  {assignment.grade ? (
                                    <Badge variant="outline">Grade {assignment.grade}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <Badge
                                    variant={
                                      assignment.status === "dispatched"
                                        ? "default"
                                        : assignment.status === "ready_for_dispatch"
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {assignment.status.replace(/_/g, " ")}
                                  </Badge>
                                </td>
                                <td className="p-4">
                                  {assignment.dispatchedAt
                                    ? new Date(assignment.dispatchedAt).toLocaleDateString()
                                    : "-"}
                                </td>
                                <td className="p-4">
                                  {isEditing ? (
                                    <div className="flex flex-col gap-2">
                                      <Textarea
                                        value={remarksValue[assignment._id] || ""}
                                        onChange={(e) => handleRemarksInputChange(assignment._id, e.target.value)}
                                        placeholder="Enter remarks"
                                        rows={2}
                                        className="min-w-[200px]"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveRemarks(assignment._id)}
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleCancelEditingRemarks(assignment._id)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                                        {assignment.remarks || "-"}
                                      </div>
                                      {canEdit && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleStartEditingRemarks(assignment._id, assignment.remarks || "")}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleViewClient(assignment)}
                                      title="View Client Details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">
                                          Change Status
                                          <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
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
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>

        {/* Create Dispatch Dialog */}
        <Dialog open={showCreateDispatchDialog} onOpenChange={setShowCreateDispatchDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Custom Dispatch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client Type</Label>
                <Select
                  value={createDispatchData.clientType}
                  onValueChange={(value: "b2b" | "b2c") =>
                    setCreateDispatchData({ ...createDispatchData, clientType: value, clientId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2b">B2B</SelectItem>
                    <SelectItem value="b2c">B2C</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Client *</Label>
                <Select
                  value={createDispatchData.clientId}
                  onValueChange={(value) =>
                    setCreateDispatchData({ ...createDispatchData, clientId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {createDispatchData.clientType === "b2b"
                      ? clients?.map((client) => (
                          <SelectItem key={client._id} value={client._id}>
                            {client.organization || client.name}
                          </SelectItem>
                        ))
                      : b2cClients?.map((client) => (
                          <SelectItem key={client._id} value={client._id}>
                            {client.buyerName}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dispatch Name *</Label>
                <Input
                  value={createDispatchData.customName}
                  onChange={(e) =>
                    setCreateDispatchData({ ...createDispatchData, customName: e.target.value })
                  }
                  placeholder="Enter dispatch name"
                />
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={createDispatchData.remarks}
                  onChange={(e) =>
                    setCreateDispatchData({ ...createDispatchData, remarks: e.target.value })
                  }
                  placeholder="Enter remarks"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Dispatch Number</Label>
                <Input
                  value={createDispatchData.dispatchNumber}
                  onChange={(e) =>
                    setCreateDispatchData({ ...createDispatchData, dispatchNumber: e.target.value })
                  }
                  placeholder="Enter dispatch number"
                />
              </div>

              <div className="space-y-2">
                <Label>Dispatch Document (PNG/JPEG/WEBP)</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setCreateDispatchDocFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>E-Way Number</Label>
                <Input
                  value={createDispatchData.ewayNumber}
                  onChange={(e) =>
                    setCreateDispatchData({ ...createDispatchData, ewayNumber: e.target.value })
                  }
                  placeholder="Enter e-way number"
                />
              </div>

              <div className="space-y-2">
                <Label>E-Way Document (PNG/JPEG/WEBP)</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setCreateDispatchEwayFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tracking Link</Label>
                <Input
                  value={createDispatchData.trackingLink}
                  onChange={(e) =>
                    setCreateDispatchData({ ...createDispatchData, trackingLink: e.target.value })
                  }
                  placeholder="Enter tracking link"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDispatchDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDispatch}>Create Dispatch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ready for Dispatch Dialog */}
        <Dialog open={readyForDispatchDialogOpen} onOpenChange={setReadyForDispatchDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ready for Dispatch Checklist</DialogTitle>
              <DialogDescription>
                Complete the checklist and provide dispatch details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check1"
                    checked={readyChecklist.check1}
                    onCheckedChange={(checked) =>
                      setReadyChecklist({ ...readyChecklist, check1: checked as boolean })
                    }
                  />
                  <label htmlFor="check1" className="text-sm font-medium">
                    All items verified and packed correctly
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check2"
                    checked={readyChecklist.check2}
                    onCheckedChange={(checked) =>
                      setReadyChecklist({ ...readyChecklist, check2: checked as boolean })
                    }
                  />
                  <label htmlFor="check2" className="text-sm font-medium">
                    Quality check completed
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check3"
                    checked={readyChecklist.check3}
                    onCheckedChange={(checked) =>
                      setReadyChecklist({ ...readyChecklist, check3: checked as boolean })
                    }
                  />
                  <label htmlFor="check3" className="text-sm font-medium">
                    Documentation prepared
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check4"
                    checked={readyChecklist.check4}
                    onCheckedChange={(checked) =>
                      setReadyChecklist({ ...readyChecklist, check4: checked as boolean })
                    }
                  />
                  <label htmlFor="check4" className="text-sm font-medium">
                    Ready for pickup/shipment
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>E-Way Number *</Label>
                <Input
                  value={ewayNumber}
                  onChange={(e) => setEwayNumber(e.target.value)}
                  placeholder="Enter E-Way number"
                />
              </div>

              <div className="space-y-2">
                <Label>E-Way Document (PNG/JPEG/WEBP) *</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setEwayDocFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Dispatch Number *</Label>
                <Input
                  value={dispatchNumber}
                  onChange={(e) => setDispatchNumber(e.target.value)}
                  placeholder="Enter dispatch number"
                />
              </div>

              <div className="space-y-2">
                <Label>Dispatch Document (PNG/JPEG/WEBP) *</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setDispatchDocFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tracking Link (Optional)</Label>
                <Input
                  value={trackingLink}
                  onChange={(e) => setTrackingLink(e.target.value)}
                  placeholder="Enter tracking link"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReadyForDispatchDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReadyForDispatch}>Confirm Ready for Dispatch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proof Photo Dialog */}
        <Dialog open={proofPhotoDialogOpen} onOpenChange={setProofPhotoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Proof Photo</DialogTitle>
              <DialogDescription>
                Upload a photo as proof of dispatch
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proof Photo (PNG/JPEG/WEBP) *</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setProofPhotoFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProofPhotoDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleProofPhotoUpload}>Upload and Mark as Dispatched</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Client Details Dialog */}
        <Dialog open={viewClientDialogOpen} onOpenChange={setViewClientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assignment Details</DialogTitle>
              <DialogDescription>
                {selectedAssignmentForView?.clientType === "b2b"
                  ? clients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.organization ||
                    clients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.name
                  : b2cClients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.buyerName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Dispatch Information Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Dispatch Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedAssignmentForView?.ewayNumber && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">E-Way Number</span>
                      <p className="text-sm">{selectedAssignmentForView.ewayNumber}</p>
                    </div>
                  )}
                  {selectedAssignmentForView?.dispatchNumber && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">Dispatch Number</span>
                      <p className="text-sm">{selectedAssignmentForView.dispatchNumber}</p>
                    </div>
                  )}
                  {selectedAssignmentForView?.trackingLink && (
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-sm font-medium text-muted-foreground">Tracking Link</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={selectedAssignmentForView.trackingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate max-w-[300px]"
                        >
                          {selectedAssignmentForView.trackingLink}
                        </a>
                        <Button variant="outline" size="sm" asChild>
                          <a href={selectedAssignmentForView.trackingLink} target="_blank" rel="noopener noreferrer">
                            Track Shipment
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 mt-2">
                  {ewayDocUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={ewayDocUrl} target="_blank" rel="noopener noreferrer">
                        View E-Way Document
                      </a>
                    </Button>
                  )}
                  {dispatchDocUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={dispatchDocUrl} target="_blank" rel="noopener noreferrer">
                        View Dispatch Document
                      </a>
                    </Button>
                  )}
                  {proofPhotoUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={proofPhotoUrl} target="_blank" rel="noopener noreferrer">
                        View Proof Photo
                      </a>
                    </Button>
                  )}
                </div>

                {selectedAssignmentForView?.remarks && (
                  <div className="space-y-1 mt-4">
                    <span className="text-sm font-medium text-muted-foreground">Remarks</span>
                    <p className="text-sm">{selectedAssignmentForView.remarks}</p>
                  </div>
                )}
              </div>

              {/* Client Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Client Information</h3>
                {selectedAssignmentForView?.clientType === "b2b" ? (
                  <>
                    {clients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.organization && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Organization:</span>
                        <span>{clients.find((c) => c._id === selectedAssignmentForView.clientId)?.organization}</span>
                      </div>
                    )}
                    {clients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.contact && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Contact:</span>
                        <span>{clients.find((c) => c._id === selectedAssignmentForView.clientId)?.contact}</span>
                      </div>
                    )}
                    {clients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span>
                        <span>{clients.find((c) => c._id === selectedAssignmentForView.clientId)?.email}</span>
                      </div>
                    )}
                    {clients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Address:</span>
                          <p className="text-sm mt-1">
                            {(() => {
                              const addr = clients.find((c) => c._id === selectedAssignmentForView.clientId)?.address;
                              if (!addr) return "-";
                              return [addr.line1, addr.line2, addr.line3, addr.state, addr.pincode, addr.country]
                                .filter(Boolean)
                                .join(", ");
                            })()}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {b2cClients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.buyerName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Buyer Name:</span>
                        <span>{b2cClients.find((c) => c._id === selectedAssignmentForView.clientId)?.buyerName}</span>
                      </div>
                    )}
                    {b2cClients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone:</span>
                        <span>{b2cClients.find((c) => c._id === selectedAssignmentForView.clientId)?.phone}</span>
                      </div>
                    )}
                    {b2cClients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span>
                        <span>{b2cClients.find((c) => c._id === selectedAssignmentForView.clientId)?.email}</span>
                      </div>
                    )}
                    {b2cClients?.find((c) => c._id === selectedAssignmentForView?.clientId)?.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Address:</span>
                          <p className="text-sm mt-1">
                            {(() => {
                              const addr = b2cClients.find((c) => c._id === selectedAssignmentForView.clientId)?.address;
                              if (!addr) return "-";
                              return [addr.line1, addr.line2, addr.line3, addr.state, addr.pincode, addr.country]
                                .filter(Boolean)
                                .join(", ");
                            })()}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewClientDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}