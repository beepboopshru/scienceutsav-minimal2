import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
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
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Search, ChevronDown, ChevronRight, Eye, Building2, User, Mail, Phone, MapPin, CheckCircle2, MoreVertical, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Dispatch() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const assignments = useQuery(api.assignments.list, {});
  const kits = useQuery(api.kits.list, {});
  const clients = useQuery(api.clients.list, {});
  const b2cClients = useQuery(api.b2cClients.list, {});
  const batches = useQuery(api.batches.list, {});
  const programs = useQuery(api.programs.list);
  const inventory = useQuery(api.inventory.list, {});
  const updateStatus = useMutation(api.assignments.updateStatus);

  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "b2b" | "b2c">("all");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [viewClientDialogOpen, setViewClientDialogOpen] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<any>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<Id<"assignments">>>(new Set());

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

  const canAccess = user.role === "admin" || user.role === "operations" || user.role === "dispatch";

  if (!canAccess) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
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

  const calculateAggregateComponents = (assignmentsToProcess: typeof filteredAssignments) => {
    if (!inventory) return { byCategory: {}, all: [] };

    const materialMap = new Map<string, any>();

    assignmentsToProcess.forEach((assignment) => {
      const kit = kits?.find((k) => k._id === assignment.kitId);
      if (!kit) return;

      const requiredQty = assignment.quantity;

      // Process structured packing requirements
      if (kit.isStructured && kit.packingRequirements) {
        try {
          const packingData = JSON.parse(kit.packingRequirements);
          
          if (packingData.pouches) {
            packingData.pouches.forEach((pouch: any, pouchIndex: number) => {
              if (pouch.materials) {
                pouch.materials.forEach((material: any) => {
                  const key = material.name.toLowerCase();
                  const required = material.quantity * requiredQty;
                  
                  if (materialMap.has(key)) {
                    const existing = materialMap.get(key);
                    existing.required += required;
                    if (!existing.sourceKits.includes(kit.name)) {
                      existing.sourceKits.push(kit.name);
                    }
                    existing.traceability.push(`${kit.name} - Pouch ${pouchIndex + 1}`);
                  } else {
                    const invItem = inventory.find((i) => i.name.toLowerCase() === material.name.toLowerCase());
                    materialMap.set(key, {
                      name: material.name,
                      currentStock: invItem?.quantity || 0,
                      required,
                      unit: material.unit,
                      category: "Main Component",
                      sourceKits: [kit.name],
                      traceability: [`${kit.name} - Pouch ${pouchIndex + 1}`],
                    });
                  }
                });
              }
            });
          }

          if (packingData.packets) {
            packingData.packets.forEach((packet: any, packetIndex: number) => {
              if (packet.materials) {
                packet.materials.forEach((material: any) => {
                  const key = material.name.toLowerCase();
                  const required = material.quantity * requiredQty;
                  
                  if (materialMap.has(key)) {
                    const existing = materialMap.get(key);
                    existing.required += required;
                    if (!existing.sourceKits.includes(kit.name)) {
                      existing.sourceKits.push(kit.name);
                    }
                    existing.traceability.push(`${kit.name} - Packet ${packetIndex + 1}`);
                  } else {
                    const invItem = inventory.find((i) => i.name.toLowerCase() === material.name.toLowerCase());
                    materialMap.set(key, {
                      name: material.name,
                      currentStock: invItem?.quantity || 0,
                      required,
                      unit: material.unit,
                      category: "Main Component",
                      sourceKits: [kit.name],
                      traceability: [`${kit.name} - Packet ${packetIndex + 1}`],
                    });
                  }
                });
              }
            });
          }
        } catch (error) {
          console.error("Error parsing packing requirements:", error);
        }
      }

      // Process spare kits
      if (kit.spareKits) {
        kit.spareKits.forEach((spare: any) => {
          const key = spare.name.toLowerCase();
          const required = spare.quantity * requiredQty;
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            if (!existing.sourceKits.includes(kit.name)) {
              existing.sourceKits.push(kit.name);
            }
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === spare.name.toLowerCase());
            materialMap.set(key, {
              name: spare.name,
              currentStock: invItem?.quantity || 0,
              required,
              unit: spare.unit,
              category: "Spare Kit",
              sourceKits: [kit.name],
              traceability: [`${kit.name} - Spare Kits`],
            });
          }
        });
      }

      // Process bulk materials
      if (kit.bulkMaterials) {
        kit.bulkMaterials.forEach((bulk: any) => {
          const key = bulk.name.toLowerCase();
          const required = bulk.quantity * requiredQty;
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            if (!existing.sourceKits.includes(kit.name)) {
              existing.sourceKits.push(kit.name);
            }
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === bulk.name.toLowerCase());
            materialMap.set(key, {
              name: bulk.name,
              currentStock: invItem?.quantity || 0,
              required,
              unit: bulk.unit,
              category: "Bulk Material",
              sourceKits: [kit.name],
              traceability: [`${kit.name} - Bulk Materials`],
            });
          }
        });
      }

      // Process miscellaneous
      if (kit.miscellaneous) {
        kit.miscellaneous.forEach((misc: any) => {
          const key = misc.name.toLowerCase();
          const required = misc.quantity * requiredQty;
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            if (!existing.sourceKits.includes(kit.name)) {
              existing.sourceKits.push(kit.name);
            }
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === misc.name.toLowerCase());
            materialMap.set(key, {
              name: misc.name,
              currentStock: invItem?.quantity || 0,
              required,
              unit: misc.unit,
              category: "Miscellaneous",
              sourceKits: [kit.name],
              traceability: [`${kit.name} - Miscellaneous`],
            });
          }
        });
      }
    });

    const allMaterials = Array.from(materialMap.values()).map((item) => ({
      ...item,
      shortage: Math.max(0, item.required - item.currentStock),
    }));

    const byCategory = allMaterials.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof allMaterials>);

    return { byCategory, all: allMaterials };
  };

  const handleDownloadComponentsReport = (useSelected: boolean) => {
    const assignmentsToProcess = useSelected 
      ? filteredAssignments.filter((a) => selectedAssignments.has(a._id))
      : filteredAssignments;

    if (assignmentsToProcess.length === 0) {
      toast.error(useSelected ? "No assignments selected" : "No assignments to process");
      return;
    }

    const { byCategory } = calculateAggregateComponents(assignmentsToProcess);
    
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
  <title>Aggregate Components Report - Dispatch</title>
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
  <h1>Aggregate Components Report - Dispatch</h1>
  
  <div class="meta-info">
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Report Type:</strong> ${useSelected ? "Selected Assignments" : "All Filtered Assignments"}</p>
    <p><strong>Total Assignments:</strong> ${assignmentsToProcess.length}</p>
    <p><strong>Total Kits:</strong> ${assignmentsToProcess.reduce((sum, a) => sum + a.quantity, 0)}</p>
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
    <p>This report shows the aggregate components needed for dispatch operations.</p>
    <p>Materials with shortages are highlighted in red.</p>
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dispatch-components-report-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Components report downloaded");
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

        {/* Download Components Report Buttons */}
        <div className="flex gap-2 mb-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Components Report
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleDownloadComponentsReport(false)}>
                All Filtered Assignments ({filteredAssignments.length})
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDownloadComponentsReport(true)}
                disabled={selectedAssignments.size === 0}
              >
                Selected Assignments ({selectedAssignments.size})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                        <td className="p-4">
                          <Checkbox
                            checked={selectedAssignments.has(assignment._id)}
                            onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                          />
                        </td>
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
                        <td className="p-4">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </td>
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
                            <td className="p-4">
                              <Checkbox
                                checked={selectedAssignments.has(assignment._id)}
                                onCheckedChange={() => toggleAssignmentSelection(assignment._id)}
                              />
                            </td>
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
      </div>
    </Layout>
  );
}