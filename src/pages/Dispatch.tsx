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
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useQuery, useMutation, useAction } from "convex/react";
import { Loader2, Search, ChevronDown, ChevronRight, Eye, Building2, User, Mail, Phone, MapPin, CheckCircle2, MoreVertical, FileText, Check, ChevronsUpDown, X, Pencil, MessageSquare, Truck, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColumnVisibility } from "@/components/ui/column-visibility";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";

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
  const customDispatches = useQuery(api.customDispatches.list, {});
  const createCustomDispatch = useMutation(api.customDispatches.create);
  const updateCustomDispatchStatus = useMutation(api.customDispatches.updateStatus);
  const deleteCustomDispatch = useMutation(api.customDispatches.deleteCustomDispatch);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const updateRemarks = useMutation(api.assignments.updateRemarks);
  const updateNotes = useMutation(api.assignments.updateNotes);
  const updatePackingNotes = useMutation(api.assignments.updatePackingNotes);
  const updateDispatchNotes = useMutation(api.assignments.updateDispatchNotes);
  const downloadKitSheet = useAction(api.kitPdf.generateKitSheet);

  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "b2b" | "b2c">("all");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [viewClientDialogOpen, setViewClientDialogOpen] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<any>(null);
  
  const ewayDocUrl = useQuery(api.storage.getUrl, (selectedClientForView as any)?.ewayDocumentId ? { storageId: (selectedClientForView as any).ewayDocumentId } : "skip");
  const dispatchDocUrl = useQuery(api.storage.getUrl, (selectedClientForView as any)?.dispatchDocumentId ? { storageId: (selectedClientForView as any).dispatchDocumentId } : "skip");
  const proofPhotoUrl = useQuery(api.storage.getUrl, (selectedClientForView as any)?.proofPhotoId ? { storageId: (selectedClientForView as any).proofPhotoId } : "skip");

  const [selectedAssignments, setSelectedAssignments] = useState<Set<Id<"assignments">>>(new Set());

  // Client Details Generator state
  const [clientDetailsDialogOpen, setClientDetailsDialogOpen] = useState(false);
  const [selectedClientForLabel, setSelectedClientForLabel] = useState<string>("");
  const [selectedPOC, setSelectedPOC] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);

  // Box Content Generator state
  const [boxContentDialogOpen, setBoxContentDialogOpen] = useState(false);
  const [boxKits, setBoxKits] = useState<Array<{
    kitId: string;
    clientId: string;
    phase: string;
    class: string;
    section: string;
    quantity: number;
    remarks: string;
  }>>([]);
  const [kitComboboxOpen, setKitComboboxOpen] = useState<Record<number, boolean>>({});
  const [clientComboboxOpenBox, setClientComboboxOpenBox] = useState<Record<number, boolean>>({});

  // Checklist dialog state
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [selectedAssignmentForDispatch, setSelectedAssignmentForDispatch] = useState<Id<"assignments"> | null>(null);
  const [checklistItems, setChecklistItems] = useState({
    kitCount: false,
    bulkMaterials: false,
    workbookWorksheetConceptMap: false,
    spareKitsTools: false,
  });
  const [ewayNumber, setEwayNumber] = useState("");
  const [ewayDocument, setEwayDocument] = useState<File | null>(null);
  const [dispatchNumber, setDispatchNumber] = useState("");
  const [dispatchDocument, setDispatchDocument] = useState<File | null>(null);
  const [trackingLink, setTrackingLink] = useState("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  
  // Proof photo state for dispatched status
  const [proofPhotoDialogOpen, setProofPhotoDialogOpen] = useState(false);
  const [selectedAssignmentForProof, setSelectedAssignmentForProof] = useState<Id<"assignments"> | null>(null);
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Advanced filters
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedKitCategories, setSelectedKitCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  
  // Remarks editing state
  const [editingRemarks, setEditingRemarks] = useState<Record<string, string>>({});
  const [originalRemarks, setOriginalRemarks] = useState<Record<string, string>>({});

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

  // Handler for downloading kit sheet
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

  const canView = hasPermission("dispatch", "view");
  const canEdit = hasPermission("dispatch", "edit");

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
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
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

  const toggleAssignmentSelection = (assignmentId: Id<"assignments">) => {
    setSelectedAssignments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assignmentId)) {
        newSet.delete(assignmentId);
      } else {
        newSet.add(assignmentId);
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
    setViewClientDialogOpen(true);
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
    setSearchQuery("");
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
      setChecklistDialogOpen(true);
    } else if (newStatus === "dispatched") {
      // Open proof photo dialog for dispatched status
      setSelectedAssignmentForProof(assignmentId);
      setProofPhoto(null);
      setProofPhotoDialogOpen(true);
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

  const handleStartEditingRemarks = (assignmentId: Id<"assignments">, currentRemarks: string) => {
    setEditingRemarks(prev => ({ ...prev, [assignmentId]: currentRemarks || "" }));
    setOriginalRemarks(prev => ({ ...prev, [assignmentId]: currentRemarks || "" }));
  };

  const handleCancelEditingRemarks = (assignmentId: Id<"assignments">) => {
    const newEditingRemarks = { ...editingRemarks };
    delete newEditingRemarks[assignmentId];
    setEditingRemarks(newEditingRemarks);
    
    const newOriginalRemarks = { ...originalRemarks };
    delete newOriginalRemarks[assignmentId];
    setOriginalRemarks(newOriginalRemarks);
  };

  const handleSaveRemarks = async (assignmentId: Id<"assignments">) => {
    if (!hasPermission("dispatch", "edit")) {
      toast.error("You don't have permission to edit remarks");
      return;
    }
    
    const newRemarks = editingRemarks[assignmentId] || "";
    
    try {
      await updateRemarks({ id: assignmentId, remarks: newRemarks });
      toast.success("Remarks saved successfully");
      
      // Clear editing state
      const newEditingRemarks = { ...editingRemarks };
      delete newEditingRemarks[assignmentId];
      setEditingRemarks(newEditingRemarks);
      
      const newOriginalRemarks = { ...originalRemarks };
      delete newOriginalRemarks[assignmentId];
      setOriginalRemarks(newOriginalRemarks);
    } catch (error: any) {
      toast.error(error.message || "Failed to save remarks");
    }
  };

  const handleRemarksInputChange = (assignmentId: Id<"assignments">, value: string) => {
    setEditingRemarks(prev => ({ ...prev, [assignmentId]: value }));
  };

  const handleConfirmProofPhoto = async () => {
    if (!proofPhoto) {
      toast.error("Please upload a proof photo");
      return;
    }

    if (!selectedAssignmentForProof) return;

    try {
      setIsUploadingProof(true);

      // Helper function to convert image to WebP
      const convertToWebP = async (file: File): Promise<Blob> => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        return new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.9);
        });
      };

      // Convert and upload proof photo
      const proofWebpBlob = await convertToWebP(proofPhoto);
      const proofUploadUrl = await generateUploadUrl();
      const proofUploadResponse = await fetch(proofUploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/webp' },
        body: proofWebpBlob,
      });

      if (!proofUploadResponse.ok) {
        throw new Error('Failed to upload proof photo');
      }

      const { storageId: proofStorageId } = await proofUploadResponse.json();

      // Update assignment with proof photo
      await updateStatus({ 
        id: selectedAssignmentForProof, 
        status: "dispatched",
        proofPhotoId: proofStorageId,
      });

      toast.success("Status updated to Dispatched with proof photo");
      setProofPhotoDialogOpen(false);
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

    if (!ewayNumber.trim()) {
      toast.error("Please enter the e-way number");
      return;
    }

    if (!ewayDocument) {
      toast.error("Please upload an e-way document");
      return;
    }

    if (!dispatchNumber.trim()) {
      toast.error("Please enter the dispatch number");
      return;
    }

    if (!dispatchDocument) {
      toast.error("Please upload a dispatch document");
      return;
    }

    if (!selectedAssignmentForDispatch) return;

    try {
      setIsUploadingDocument(true);

      // Helper function to convert image to WebP
      const convertToWebP = async (file: File): Promise<Blob> => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        return new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.9);
        });
      };

      // Convert and upload e-way document
      const ewayWebpBlob = await convertToWebP(ewayDocument);
      const ewayUploadUrl = await generateUploadUrl();
      const ewayUploadResponse = await fetch(ewayUploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/webp' },
        body: ewayWebpBlob,
      });

      if (!ewayUploadResponse.ok) {
        throw new Error('Failed to upload e-way document');
      }

      const { storageId: ewayStorageId } = await ewayUploadResponse.json();

      // Convert and upload dispatch document
      const dispatchWebpBlob = await convertToWebP(dispatchDocument);
      const dispatchUploadUrl = await generateUploadUrl();
      const dispatchUploadResponse = await fetch(dispatchUploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/webp' },
        body: dispatchWebpBlob,
      });

      if (!dispatchUploadResponse.ok) {
        throw new Error('Failed to upload dispatch document');
      }

      const { storageId: dispatchStorageId } = await dispatchUploadResponse.json();

      // Update assignment with all dispatch details
      await updateStatus({ 
        id: selectedAssignmentForDispatch, 
        status: "ready_for_dispatch",
        ewayNumber: ewayNumber.trim(),
        ewayDocumentId: ewayStorageId,
        dispatchNumber: dispatchNumber.trim(),
        dispatchDocumentId: dispatchStorageId,
        trackingLink: trackingLink.trim() || undefined,
      });

      toast.success("Status updated to Ready for Dispatch");
      setChecklistDialogOpen(false);
      setSelectedAssignmentForDispatch(null);
      setEwayNumber("");
      setEwayDocument(null);
      setDispatchNumber("");
      setDispatchDocument(null);
      setTrackingLink("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleGenerateClientLabel = () => {
    if (!selectedClientForLabel) {
      toast.error("Please select a client");
      return;
    }

    // Find the selected client
    const allClients = [...(clients || []), ...(b2cClients || [])];
    const client = allClients.find((c) => c._id === selectedClientForLabel);
    
    if (!client) {
      toast.error("Client not found");
      return;
    }

    // Get selected POC
    const poc = client.pointsOfContact?.find((p: any) => p.name === selectedPOC);
    
    if (!poc) {
      toast.error("Please select a Point of Contact");
      return;
    }

    // Determine client name based on type
    const clientName = (client as any).organization || (client as any).buyerName || (client as any).name;

    // Generate HTML for printing
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Client Address Label</title>
          <style>
            @page {
              size: 297mm 210mm;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              width: 297mm;
              height: 210mm;
              max-width: 297mm;
              max-height: 210mm;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              overflow: hidden;
            }
            .container {
              border: 2px solid #000;
              padding: 15px;
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
              margin: 0;
            }
            .logo {
              text-align: center;
              margin-bottom: 15px;
            }
            .logo img {
              max-width: 250px;
              height: auto;
            }
            .customer-id {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 15px;
              padding: 10px;
              background-color: #f5f5f5;
              border: 1px solid #ddd;
            }
            .address-section {
              flex: 1;
              display: flex;
              flex-direction: row;
              gap: 15px;
            }
            .address-box {
              border: 2px solid #000;
              padding: 12px;
              flex: 1;
            }
            .address-label {
              font-weight: bold;
              font-size: 22px;
              margin-bottom: 10px;
              text-decoration: underline;
            }
            .address-content {
              font-size: 24px;
              line-height: 1.7;
            }
            .address-content div {
              margin-bottom: 5px;
            }
            .contact-info {
              margin-top: 10px;
              font-size: 22px;
            }
            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <img src="https://harmless-tapir-303.convex.cloud/api/storage/b4678ea2-dd0d-4c31-820f-c3d431d56cb7" alt="ScienceUtsav Logo" />
            </div>
            
            ${customerId ? `<div class="customer-id">Customer ID: ${customerId}</div>` : ''}
            
            <div class="address-section">
              <div class="address-box">
                <div class="address-label">FROM:</div>
                <div class="address-content">
                  <div><strong>ScienceUtsav Educational Services Pvt Ltd</strong></div>
                  <div>25/1 9th Cross, 19th A Main Rd</div>
                  <div>2nd Phase, J. P. Nagar</div>
                  <div>Bengaluru - 560078</div>
                  <div>Karnataka, India</div>
                  <div class="contact-info">Contact: 9739008220, 9029402028</div>
                </div>
              </div>
              
              <div class="address-box">
                <div class="address-label">TO:</div>
                <div class="address-content">
                  <div><strong>${clientName}</strong></div>
                  <div><strong>Attn: ${poc.name}${poc.designation ? ' (' + poc.designation + ')' : ''}</strong></div>
                  ${client.address ? `
                    <div>${client.address.line1}</div>
                    ${client.address.line2 ? `<div>${client.address.line2}</div>` : ''}
                    ${client.address.line3 ? `<div>${client.address.line3}</div>` : ''}
                    <div>${client.address.state} - ${client.address.pincode}</div>
                    <div>${client.address.country}</div>
                  ` : '<div>Address not available</div>'}
                  <div class="contact-info">
                    ${poc.phone ? `Phone: ${poc.phone}` : ''}
                    ${poc.email ? `${poc.phone ? ' | ' : ''}Email: ${poc.email}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    // Reset form
    setClientDetailsDialogOpen(false);
    setSelectedClientForLabel("");
    setSelectedPOC("");
    setCustomerId("");
    toast.success("Client label generated");
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
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => {
                                            const kit = kits?.find(k => k._id === assignment.kitId);
                                            if (kit) handleDownloadKitSheet(kit._id);
                                          }}
                                          className="h-8 w-8"
                                        >
                                          <Download className="h-4 w-4 text-purple-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Download Kit Sheet</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="p-4">
                              {editingRemarks[assignment._id] !== undefined ? (
                                <div className="space-y-2">
                                  <textarea
                                    className="w-full min-w-[200px] p-2 border rounded text-sm resize-none"
                                    rows={2}
                                    value={editingRemarks[assignment._id]}
                                    onChange={(e) => handleRemarksInputChange(assignment._id, e.target.value)}
                                    placeholder="Add remarks..."
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="default"
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
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-[200px] p-2 border rounded text-sm bg-muted/30">
                                    {assignment.remarks || <span className="text-muted-foreground italic">No remarks</span>}
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
                                  {editingRemarks[assignment._id] !== undefined ? (
                                    <div className="space-y-2">
                                      <textarea
                                        className="w-full min-w-[200px] p-2 border rounded text-sm resize-none"
                                        rows={2}
                                        value={editingRemarks[assignment._id]}
                                        onChange={(e) => handleRemarksInputChange(assignment._id, e.target.value)}
                                        placeholder="Add remarks..."
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="default"
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
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1 min-w-[200px] p-2 border rounded text-sm bg-muted/30">
                                        {assignment.remarks || <span className="text-muted-foreground italic">No remarks</span>}
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
        <Dialog open={viewClientDialogOpen} onOpenChange={setViewClientDialogOpen}>
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
              <Button variant="outline" onClick={() => setViewClientDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispatch Checklist Dialog */}
        <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ready for Dispatch Checklist</DialogTitle>
              <DialogDescription>
                Please verify all items before marking as ready for dispatch
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kitCount"
                  checked={checklistItems.kitCount}
                  onCheckedChange={(checked) =>
                    setChecklistItems((prev) => ({ ...prev, kitCount: checked as boolean }))
                  }
                />
                <Label htmlFor="kitCount" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Kit count verified
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bulkMaterials"
                  checked={checklistItems.bulkMaterials}
                  onCheckedChange={(checked) =>
                    setChecklistItems((prev) => ({ ...prev, bulkMaterials: checked as boolean }))
                  }
                />
                <Label htmlFor="bulkMaterials" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Bulk materials included
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="workbookWorksheetConceptMap"
                  checked={checklistItems.workbookWorksheetConceptMap}
                  onCheckedChange={(checked) =>
                    setChecklistItems((prev) => ({ ...prev, workbookWorksheetConceptMap: checked as boolean }))
                  }
                />
                <Label htmlFor="workbookWorksheetConceptMap" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Workbook, worksheet, concept map included
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="spareKitsTools"
                  checked={checklistItems.spareKitsTools}
                  onCheckedChange={(checked) =>
                    setChecklistItems((prev) => ({ ...prev, spareKitsTools: checked as boolean }))
                  }
                />
                <Label htmlFor="spareKitsTools" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Spare kits and tools included
                </Label>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="ewayNumber">E-Way Number *</Label>
                <Input
                  id="ewayNumber"
                  placeholder="Enter e-way number..."
                  value={ewayNumber}
                  onChange={(e) => setEwayNumber(e.target.value)}
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
                      setEwayDocument(file);
                    }
                  }}
                />
                {ewayDocument && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {ewayDocument.name} (will be converted to WebP)
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
                setChecklistDialogOpen(false);
                setEwayNumber("");
                setEwayDocument(null);
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

        {/* Box Content Generator Dialog */}
        <Dialog open={boxContentDialogOpen} onOpenChange={setBoxContentDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Box Content Labels</DialogTitle>
              <DialogDescription>
                Add kit details to generate printable box content labels (max 2 kits per page)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {boxKits.map((kit, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Kit {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newKits = boxKits.filter((_, i) => i !== index);
                        setBoxKits(newKits);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Kit Name Combobox */}
                    <div className="space-y-2">
                      <Label>Kit Name</Label>
                      <Popover 
                        open={kitComboboxOpen[index]} 
                        onOpenChange={(open) => setKitComboboxOpen({ ...kitComboboxOpen, [index]: open })}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {kit.kitId ? kits?.find((k) => k._id === kit.kitId)?.name || "Select kit..." : "Select kit..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search kits..." />
                            <CommandList>
                              <CommandEmpty>No kit found.</CommandEmpty>
                              <CommandGroup>
                                {(kits || []).map((k) => (
                                  <CommandItem
                                    key={k._id}
                                    value={k.name}
                                    onSelect={() => {
                                      const newKits = [...boxKits];
                                      newKits[index].kitId = k._id;
                                      setBoxKits(newKits);
                                      setKitComboboxOpen({ ...kitComboboxOpen, [index]: false });
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        kit.kitId === k._id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {k.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Client Name Combobox */}
                    <div className="space-y-2">
                      <Label>Client Name</Label>
                      <Popover 
                        open={clientComboboxOpenBox[index]} 
                        onOpenChange={(open) => setClientComboboxOpenBox({ ...clientComboboxOpenBox, [index]: open })}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {kit.clientId ? (() => {
                              const allClients = [...(clients || []), ...(b2cClients || [])];
                              const client = allClients.find((c) => c._id === kit.clientId);
                              return client ? ((client as any).organization || (client as any).buyerName || (client as any).name) : "Select client...";
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
                                {[...(clients || []), ...(b2cClients || [])].map((c) => {
                                  const clientName = (c as any).organization || (c as any).buyerName || (c as any).name || "";
                                  return (
                                    <CommandItem
                                      key={c._id}
                                      value={clientName}
                                      onSelect={() => {
                                        const newKits = [...boxKits];
                                        newKits[index].clientId = c._id;
                                        setBoxKits(newKits);
                                        setClientComboboxOpenBox({ ...clientComboboxOpenBox, [index]: false });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          kit.clientId === c._id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {clientName}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Phase */}
                    <div className="space-y-2">
                      <Label>Phase</Label>
                      <Input
                        value={kit.phase}
                        onChange={(e) => {
                          const newKits = [...boxKits];
                          newKits[index].phase = e.target.value;
                          setBoxKits(newKits);
                        }}
                        placeholder="Enter phase..."
                      />
                    </div>

                    {/* Class */}
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Input
                        value={kit.class}
                        onChange={(e) => {
                          const newKits = [...boxKits];
                          newKits[index].class = e.target.value;
                          setBoxKits(newKits);
                        }}
                        placeholder="Enter class..."
                      />
                    </div>

                    {/* Section */}
                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Input
                        value={kit.section}
                        onChange={(e) => {
                          const newKits = [...boxKits];
                          newKits[index].section = e.target.value;
                          setBoxKits(newKits);
                        }}
                        placeholder="Enter section..."
                      />
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={kit.quantity}
                        onChange={(e) => {
                          const newKits = [...boxKits];
                          newKits[index].quantity = parseInt(e.target.value) || 0;
                          setBoxKits(newKits);
                        }}
                        placeholder="Enter quantity..."
                      />
                    </div>

                    {/* Remarks */}
                    <div className="space-y-2 col-span-2">
                      <Label>Remarks</Label>
                      <Input
                        value={kit.remarks}
                        onChange={(e) => {
                          const newKits = [...boxKits];
                          newKits[index].remarks = e.target.value;
                          setBoxKits(newKits);
                        }}
                        placeholder="Enter remarks..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => {
                  if (boxKits.length >= 2) {
                    toast.error("Maximum 2 kits allowed per box content generator");
                    return;
                  }
                  setBoxKits([...boxKits, {
                    kitId: "",
                    clientId: "",
                    phase: "",
                    class: "",
                    section: "",
                    quantity: 0,
                    remarks: ""
                  }]);
                }}
                className="w-full"
                disabled={boxKits.length >= 2}
              >
                Add Kit {boxKits.length >= 2 ? "(Maximum reached)" : ""}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBoxContentDialogOpen(false);
                setBoxKits([]);
              }}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (boxKits.length === 0) {
                  toast.error("Please add at least one kit");
                  return;
                }

                // Generate HTML pages (2 kits per page)
                const pages: string[] = [];
                for (let i = 0; i < boxKits.length; i += 2) {
                  const kitsOnPage = boxKits.slice(i, i + 2);
                  
                const pageHtml = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="UTF-8">
                      <title>Box Content - Page ${Math.floor(i / 2) + 1}</title>
                      <style>
                        @page {
                          size: A4 portrait;
                          margin: 0;
                        }
                        * {
                          margin: 0;
                          padding: 0;
                          box-sizing: border-box;
                        }
                        body {
                          font-family: Arial, sans-serif;
                          width: 210mm;
                          height: 297mm;
                          padding: 15mm;
                          display: flex;
                          flex-direction: column;
                        }
                        .page-header {
                          text-align: center;
                          margin-bottom: 20px;
                        }
                        .page-header img {
                          max-width: 200px;
                          height: auto;
                        }
                        .kits-container {
                          flex: 1;
                          display: flex;
                          flex-direction: column;
                          gap: 20px;
                        }
                        .kit-box {
                          border: 3px solid #000;
                          padding: 15px;
                          flex: 1;
                          display: flex;
                          flex-direction: column;
                          gap: 12px;
                        }
                        .field-row {
                          display: flex;
                          gap: 10px;
                        }
                        .field {
                          border: 2px solid #333;
                          padding: 10px;
                          flex: 1;
                        }
                        .field-label {
                          font-weight: bold;
                          font-size: 24px;
                          color: #666;
                          margin-bottom: 5px;
                        }
                        .field-value {
                          font-size: 28px;
                          min-height: 20px;
                        }
                        @media print {
                          body {
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                          }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="page-header">
                        <img src="https://harmless-tapir-303.convex.cloud/api/storage/b4678ea2-dd0d-4c31-820f-c3d431d56cb7" alt="ScienceUtsav Logo" />
                      </div>
                      
                      <div class="kits-container">
                        ${kitsOnPage.map((kit, idx) => {
                          const kitData = kits?.find((k) => k._id === kit.kitId);
                          const allClients = [...(clients || []), ...(b2cClients || [])];
                          const clientData = allClients.find((c) => c._id === kit.clientId);
                          const clientName = clientData ? ((clientData as any).organization || (clientData as any).buyerName || (clientData as any).name) : "";
                          
                          return `
                            <div class="kit-box">
                              <div class="field-row">
                                <div class="field">
                                  <div class="field-label">Kit Name</div>
                                  <div class="field-value">${kitData?.name || ""}</div>
                                </div>
                                <div class="field">
                                  <div class="field-label">Client Name</div>
                                  <div class="field-value">${clientName}</div>
                                </div>
                              </div>
                              
                              <div class="field-row">
                                <div class="field">
                                  <div class="field-label">Phase</div>
                                  <div class="field-value">${kit.phase}</div>
                                </div>
                                <div class="field">
                                  <div class="field-label">Class</div>
                                  <div class="field-value">${kit.class}</div>
                                </div>
                                <div class="field">
                                  <div class="field-label">Section</div>
                                  <div class="field-value">${kit.section}</div>
                                </div>
                              </div>
                              
                              <div class="field-row">
                                <div class="field">
                                  <div class="field-label">Quantity</div>
                                  <div class="field-value">${kit.quantity}</div>
                                </div>
                              </div>
                              
                              <div class="field">
                                <div class="field-label">Remarks</div>
                                <div class="field-value">${kit.remarks}</div>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </body>
                  </html>
                  `;
                  
                  pages.push(pageHtml);
                }

                // Open all pages in new windows
                pages.forEach((pageHtml, index) => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(pageHtml);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                      printWindow.print();
                    }, 250 * (index + 1));
                  }
                });

                toast.success(`Generated ${pages.length} page(s) for ${boxKits.length} kit(s)`);
                setBoxContentDialogOpen(false);
                setBoxKits([]);
              }}>
                Generate & Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proof Photo Dialog */}
        <Dialog open={proofPhotoDialogOpen} onOpenChange={setProofPhotoDialogOpen}>
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
                setProofPhotoDialogOpen(false);
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