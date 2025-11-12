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
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Search, ChevronDown, ChevronRight, Eye, Building2, User, Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Dispatch() {
  const { isLoading, isAuthenticated, user } = useAuth();
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

  // Filter assignments: ONLY show transferred_to_dispatch
  let filteredAssignments = assignments?.filter(
    (a) => a.status === "transferred_to_dispatch"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 border rounded-lg bg-card">
            <div className="text-sm text-muted-foreground mb-1">Total Assignments</div>
            <div className="text-2xl font-bold">{filteredAssignments.length}</div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="text-sm text-muted-foreground mb-1">Total Quantity</div>
            <div className="text-2xl font-bold">{totalQuantity}</div>
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
                          <Badge variant={assignment.status === "dispatched" ? "default" : "secondary"}>
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
                            {assignment.status !== "dispatched" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleMarkAsDispatched(assignment._id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Dispatched
                              </Button>
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
                        <td colSpan={6} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5" />
                              )}
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
                              <Badge variant={assignment.status === "dispatched" ? "default" : "secondary"}>
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
                                {assignment.status !== "dispatched" && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleMarkAsDispatched(assignment._id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark Dispatched
                                  </Button>
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
      </div>
    </Layout>
  );
}
