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
import { useQuery, useMutation } from "convex/react";
import { Loader2, Search, ChevronDown, ChevronRight, Eye, Building2, User, Mail, Phone, MapPin, CheckCircle2, MoreVertical, FileText, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnVisibility } from "@/components/ui/column-visibility";

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

  // Add column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    customerType: true,
    batch: true,
    client: true,
    program: true,
    kit: true,
    kitCategory: true,
    quantity: true,
    grade: true,
    status: true,
    dispatchDate: true,
    productionMonth: true,
    createdOn: true,
    assignmentNotes: true,
    packingNotes: true,
    dispatchNotes: true,
    remarks: true,
  });

  const toggleColumn = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId as keyof typeof prev]: !prev[columnId as keyof typeof prev],
    }));
  };

  const columns = [
    { id: "customerType", label: "Customer Type", visible: columnVisibility.customerType },
    { id: "batch", label: "Batch", visible: columnVisibility.batch },
    { id: "client", label: "Client", visible: columnVisibility.client },
    { id: "program", label: "Program", visible: columnVisibility.program },
    { id: "kit", label: "Kit", visible: columnVisibility.kit },
    { id: "kitCategory", label: "Kit Category", visible: columnVisibility.kitCategory },
    { id: "quantity", label: "Quantity", visible: columnVisibility.quantity },
    { id: "grade", label: "Grade", visible: columnVisibility.grade },
    { id: "status", label: "Status", visible: columnVisibility.status },
    { id: "dispatchDate", label: "Dispatch Date", visible: columnVisibility.dispatchDate },
    { id: "productionMonth", label: "Production Month", visible: columnVisibility.productionMonth },
    { id: "createdOn", label: "Created On", visible: columnVisibility.createdOn },
    { id: "assignmentNotes", label: "Assignment Notes", visible: columnVisibility.assignmentNotes },
    { id: "packingNotes", label: "Packing Notes", visible: columnVisibility.packingNotes },
    { id: "dispatchNotes", label: "Dispatch Notes", visible: columnVisibility.dispatchNotes },
    { id: "remarks", label: "Remarks", visible: columnVisibility.remarks },
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
      <div className="flex flex-col h-screen">
        <div className="p-6 border-b bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dispatch Operations</h1>
              <p className="text-muted-foreground">Manage kit dispatch and delivery</p>
            </div>
            <ColumnVisibility columns={columns} onToggle={toggleColumn} />
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-6 pb-6">
          <Card className="h-full">
            <CardContent className="p-0 h-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    {canEdit && <TableHead className="w-12">Select</TableHead>}
                    {columnVisibility.customerType && <TableHead>Customer Type</TableHead>}
                    {columnVisibility.batch && <TableHead>Batch</TableHead>}
                    {columnVisibility.client && <TableHead>Client</TableHead>}
                    {columnVisibility.program && <TableHead>Program</TableHead>}
                    {columnVisibility.kit && <TableHead>Kit</TableHead>}
                    {columnVisibility.kitCategory && <TableHead>Kit Category</TableHead>}
                    {columnVisibility.quantity && <TableHead>Quantity</TableHead>}
                    {columnVisibility.grade && <TableHead>Grade</TableHead>}
                    {columnVisibility.status && <TableHead>Status</TableHead>}
                    {columnVisibility.dispatchDate && <TableHead>Dispatch Date</TableHead>}
                    {columnVisibility.productionMonth && <TableHead>Production Month</TableHead>}
                    {columnVisibility.createdOn && <TableHead>Created On</TableHead>}
                    {columnVisibility.assignmentNotes && <TableHead>Assignment Notes</TableHead>}
                    {columnVisibility.packingNotes && <TableHead>Packing Notes</TableHead>}
                    {columnVisibility.dispatchNotes && <TableHead>Dispatch Notes</TableHead>}
                    {columnVisibility.remarks && <TableHead>Remarks</TableHead>}
                    {canEdit && <TableHead>Dispatch Status</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
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
                          {columnVisibility.customerType && <TableCell className="p-4">
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
                          </TableCell>}
                          {columnVisibility.batch && <TableCell className="p-4">
                            {batch?.batchId || "N/A"}
                          </TableCell>}
                          {columnVisibility.client && <TableCell className="p-4">
                            {assignment.clientType === "b2b"
                              ? (assignment.client as any)?.organization || (assignment.client as any)?.name
                              : (assignment.client as any)?.buyerName}
                          </TableCell>}
                          {columnVisibility.program && <TableCell className="p-4">
                            {assignment.program?.name || "N/A"}
                          </TableCell>}
                          {columnVisibility.kit && <TableCell className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium">{assignment.kit?.name}</span>
                              {assignment.kit?.category && (
                                <span className="text-xs text-muted-foreground">{assignment.kit.category}</span>
                              )}
                            </div>
                          </TableCell>}
                          {columnVisibility.kitCategory && <TableCell className="p-4">
                            {assignment.kit?.category || "N/A"}
                          </TableCell>}
                          {columnVisibility.quantity && <TableCell className="p-4">{assignment.quantity}</TableCell>}
                          {columnVisibility.grade && <TableCell className="p-4">
                            {assignment.grade ? (
                              <Badge variant="outline">Grade {assignment.grade}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>}
                          {columnVisibility.status && <TableCell className="p-4">
                            <Badge variant={
                              assignment.status === "dispatched" ? "default" : 
                              assignment.status === "delivered" ? "default" : 
                              "secondary"
                            }>
                              {assignment.status}
                            </Badge>
                          </TableCell>}
                          {columnVisibility.dispatchDate && <TableCell className="p-4">
                            {assignment.dispatchedAt
                              ? new Date(assignment.dispatchedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>}
                          {columnVisibility.productionMonth && <TableCell className="p-4">
                            {assignment.productionMonth || "N/A"}
                          </TableCell>}
                          {columnVisibility.createdOn && <TableCell className="p-4">
                            {new Date(assignment._creationTime).toLocaleDateString()}
                          </TableCell>}
                          {columnVisibility.assignmentNotes && <TableCell className="p-4">
                            <div className="min-w-[200px] p-2 border rounded text-sm bg-muted/30 max-h-24 overflow-y-auto">
                              {assignment.notes || <span className="text-muted-foreground italic">No assignment notes</span>}
                            </div>
                          </TableCell>}
                          {columnVisibility.packingNotes && <TableCell className="p-4">
                            <div className="min-w-[200px] p-2 border rounded text-sm bg-muted/30 max-h-24 overflow-y-auto">
                              {assignment.packingNotes || <span className="text-muted-foreground italic">No packing notes</span>}
                            </div>
                          </TableCell>}
                          {columnVisibility.dispatchNotes && <TableCell className="p-4">
                            <div className="min-w-[200px] p-2 border rounded text-sm bg-muted/30 max-h-24 overflow-y-auto">
                              {assignment.dispatchNotes || <span className="text-muted-foreground italic">No dispatch notes</span>}
                            </div>
                          </TableCell>}
                          {columnVisibility.remarks && <TableCell className="p-4">
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
                          </TableCell>}
                          {canEdit && <TableCell className="p-4">
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
                          </TableCell>}
                          <TableCell className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewClient(assignment)}
                              title="View Client Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
                          <TableCell colSpan={canEdit ? 10 : 11} className="p-4">
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
                              {columnVisibility.customerType && <TableCell className="p-4 pl-12">
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
                              </TableCell>}
                              {columnVisibility.batch && <TableCell className="p-4">
                                {batch?.batchId || "N/A"}
                              </TableCell>}
                              {columnVisibility.client && <TableCell className="p-4">
                                {assignment.clientType === "b2b"
                                  ? (assignment.client as any)?.organization || (assignment.client as any)?.name
                                  : (assignment.client as any)?.buyerName}
                              </TableCell>}
                              {columnVisibility.program && <TableCell className="p-4">
                                {assignment.program?.name || "N/A"}
                              </TableCell>}
                              {columnVisibility.kit && <TableCell className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-medium">{assignment.kit?.name}</span>
                                  {assignment.kit?.category && (
                                    <span className="text-xs text-muted-foreground">{assignment.kit.category}</span>
                                  )}
                                </div>
                              </TableCell>}
                              {columnVisibility.kitCategory && <TableCell className="p-4">
                                {assignment.kit?.category || "N/A"}
                              </TableCell>}
                              {columnVisibility.quantity && <TableCell className="p-4">{assignment.quantity}</TableCell>}
                              {columnVisibility.grade && <TableCell className="p-4">
                                {assignment.grade ? (
                                  <Badge variant="outline">Grade {assignment.grade}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>}
                              {columnVisibility.status && <TableCell className="p-4">
                                <Badge variant={
                                  assignment.status === "dispatched" ? "default" : 
                                  assignment.status === "delivered" ? "default" : 
                                  "secondary"
                                }>
                                  {assignment.status}
                                </Badge>
                              </TableCell>}
                              {columnVisibility.dispatchDate && <TableCell className="p-4">
                                {assignment.dispatchedAt
                                  ? new Date(assignment.dispatchedAt).toLocaleDateString()
                                  : "-"}
                              </TableCell>}
                              {columnVisibility.productionMonth && <TableCell className="p-4">
                                {assignment.productionMonth || "N/A"}
                              </TableCell>}
                              {columnVisibility.createdOn && <TableCell className="p-4">
                                {new Date(assignment._creationTime).toLocaleDateString()}
                              </TableCell>}
                              {columnVisibility.assignmentNotes && <TableCell className="p-4">
                                <div className="min-w-[200px] p-2 border rounded text-sm bg-muted/30 max-h-24 overflow-y-auto">
                                  {assignment.notes || <span className="text-muted-foreground italic">No assignment notes</span>}
                                </div>
                              </TableCell>}
                              {columnVisibility.packingNotes && <TableCell className="p-4">
                                <div className="min-w-[200px] p-2 border rounded text-sm bg-muted/30 max-h-24 overflow-y-auto">
                                  {assignment.packingNotes || <span className="text-muted-foreground italic">No packing notes</span>}
                                </div>
                              </TableCell>}
                              {columnVisibility.dispatchNotes && <TableCell className="p-4">
                                <div className="min-w-[200px] p-2 border rounded text-sm bg-muted/30 max-h-24 overflow-y-auto">
                                  {assignment.dispatchNotes || <span className="text-muted-foreground italic">No dispatch notes</span>}
                                </div>
                              </TableCell>}
                              {columnVisibility.remarks && <TableCell className="p-4">
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
                              </TableCell>}
                              {canEdit && <TableCell className="p-4">
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
                              </TableCell>}
                              <TableCell className="p-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewClient(assignment)}
                                  title="View Client Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}