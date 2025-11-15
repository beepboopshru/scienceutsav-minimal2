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

  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "b2b" | "b2c">("all");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [viewClientDialogOpen, setViewClientDialogOpen] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<any>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<Id<"assignments">>>(new Set());

  // Client Details Generator state
  const [clientDetailsDialogOpen, setClientDetailsDialogOpen] = useState(false);
  const [selectedClientForLabel, setSelectedClientForLabel] = useState<string>("");
  const [selectedPOC, setSelectedPOC] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);

  // Checklist dialog state
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [selectedAssignmentForDispatch, setSelectedAssignmentForDispatch] = useState<Id<"assignments"> | null>(null);
  const [checklistItems, setChecklistItems] = useState({
    kitCount: false,
    bulkMaterials: false,
    workbookWorksheetConceptMap: false,
    spareKitsTools: false,
  });

  // Advanced filters
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedKitCategories, setSelectedKitCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);

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

  // Filter assignments: show transferred_to_dispatch and dispatched
  let filteredAssignments = assignments?.filter(
    (a) => a.status === "transferred_to_dispatch" || a.status === "dispatched"
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
    setSelectedClientForView(assignment.client);
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
    if (newStatus === "dispatched") {
      // Open checklist dialog
      setSelectedAssignmentForDispatch(assignmentId);
      setChecklistItems({
        kitCount: false,
        bulkMaterials: false,
        workbookWorksheetConceptMap: false,
        spareKitsTools: false,
      });
      setChecklistDialogOpen(true);
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

  const handleConfirmDispatch = async () => {
    const allChecked = Object.values(checklistItems).every((checked) => checked);
    
    if (!allChecked) {
      toast.error("Please verify all checklist items before dispatching");
      return;
    }

    if (!selectedAssignmentForDispatch) return;

    try {
      await updateStatus({ id: selectedAssignmentForDispatch, status: "dispatched" });
      toast.success("Status updated to Dispatched");
      setChecklistDialogOpen(false);
      setSelectedAssignmentForDispatch(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
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
              font-size: 18px;
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
              font-size: 20px;
              margin-bottom: 10px;
              text-decoration: underline;
            }
            .address-content {
              font-size: 16px;
              line-height: 1.7;
            }
            .address-content div {
              margin-bottom: 5px;
            }
            .contact-info {
              margin-top: 10px;
              font-size: 15px;
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
            clients={[...(clients || []), ...(b2cClients || [])]}
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

          <Button variant="outline" onClick={handleClearAllFilters}>
            Clear All Filters
          </Button>

          <Button 
            variant="default" 
            onClick={() => setClientDetailsDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Client Details Generator
          </Button>
        </div>

        {/* Assignments Table */}
        <div className="border rounded-lg overflow-hidden">
          {!filteredAssignments ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No assignments ready for dispatch.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  {canEdit && (
                    <th className="text-left p-4 font-semibold w-10">
                      <Checkbox
                        checked={selectedAssignments.size === filteredAssignments.length && filteredAssignments.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAssignments(new Set(filteredAssignments.map((a) => a._id)));
                          } else {
                            setSelectedAssignments(new Set());
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="text-left p-4 font-semibold">Customer</th>
                  <th className="text-left p-4 font-semibold">Kit</th>
                  <th className="text-left p-4 font-semibold">Quantity</th>
                  <th className="text-left p-4 font-semibold">Grade</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-left p-4 font-semibold">Dispatch Date</th>
                  <th className="text-right p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedAssignments).map(([batchKey, batchAssignments]) => {
                  const isExpanded = expandedBatches.has(batchKey);
                  const batch = batchKey !== "standalone" ? batches?.find((b) => b._id === batchKey) : null;
                  const totalQty = batchAssignments.reduce((sum, a) => sum + a.quantity, 0);

                  if (batchKey === "standalone") {
                    return batchAssignments.map((assignment) => (
                      <tr key={assignment._id} className="border-b hover:bg-muted/30">
                        {canEdit && (
                          <td className="p-4">
                            <Checkbox
                              checked={selectedAssignments.has(assignment._id)}
                              onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                            />
                          </td>
                        )}
                        <td className="p-4">
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
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.kit?.name}</span>
                            {assignment.kit?.category && (
                              <span className="text-xs text-muted-foreground">{assignment.kit.category}</span>
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
                          <Badge variant={
                            assignment.status === "dispatched" ? "default" : 
                            assignment.status === "delivered" ? "default" : 
                            "secondary"
                          }>
                            {assignment.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {assignment.dispatchedAt
                            ? new Date(assignment.dispatchedAt).toLocaleDateString()
                            : "-"}
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
                        </td>
                      </tr>
                    ));
                  }

                  return (
                    <>
                      <tr
                        key={`batch-${batchKey}`}
                        className="bg-muted/20 border-b cursor-pointer hover:bg-muted/40"
                        onClick={() => toggleBatch(batchKey)}
                      >
                        {canEdit && (
                          <td className="p-4">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </td>
                        )}
                        <td colSpan={6} className="p-4">
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
                        </td>
                      </tr>
                      {isExpanded &&
                        batchAssignments.map((assignment) => (
                          <tr key={assignment._id} className="border-b hover:bg-muted/30">
                            {canEdit && (
                              <td className="p-4">
                                <Checkbox
                                  checked={selectedAssignments.has(assignment._id)}
                                  onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                                />
                              </td>
                            )}
                            <td className="p-4 pl-12">
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
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{assignment.kit?.name}</span>
                                {assignment.kit?.category && (
                                  <span className="text-xs text-muted-foreground">{assignment.kit.category}</span>
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
                              <Badge variant={
                                assignment.status === "dispatched" ? "default" : 
                                assignment.status === "delivered" ? "default" : 
                                "secondary"
                              }>
                                {assignment.status}
                              </Badge>
                            </td>
                            <td className="p-4">
                              {assignment.dispatchedAt
                                ? new Date(assignment.dispatchedAt).toLocaleDateString()
                                : "-"}
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
                            </td>
                          </tr>
                        ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* View Client Dialog */}
        <Dialog open={viewClientDialogOpen} onOpenChange={setViewClientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Client Details</DialogTitle>
              <DialogDescription>
                {selectedClientForView?.organization || selectedClientForView?.buyerName || selectedClientForView?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
                    <p className="text-sm mt-1">{selectedClientForView.address}</p>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewClientDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispatch Checklist Dialog */}
        <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dispatch Checklist</DialogTitle>
              <DialogDescription>
                Please verify all items before marking as dispatched
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChecklistDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmDispatch}>
                Confirm Dispatch
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
      </div>
    </Layout>
  );
}