import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Search, ChevronDown, Eye, Building2, User, Mail, Phone, MapPin, Package, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function OrderRecords() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const orders = useQuery(api.orderHistory.list, {});
  const kits = useQuery(api.kits.list, {});
  const clients = useQuery(api.clients.list, {});
  const b2cClients = useQuery(api.b2cClients.list, {});
  const programs = useQuery(api.programs.list);
  const batches = useQuery(api.batches.list, {});
  const updateStatus = useMutation(api.orderHistory.updateStatus);

  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "b2b" | "b2c">("all");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [viewClientDialogOpen, setViewClientDialogOpen] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<any>(null);
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());

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

  // Filter orders
  let filteredOrders = orders || [];

  // Apply batch filter
  if (selectedBatch !== "all") {
    filteredOrders = filteredOrders.filter((o) => o.batchId === selectedBatch);
  }

  // Apply customer type filter
  if (customerTypeFilter !== "all") {
    filteredOrders = filteredOrders.filter((o) => o.clientType === customerTypeFilter);
  }

  // Apply advanced filters
  if (selectedPrograms.length > 0) {
    filteredOrders = filteredOrders.filter((o) =>
      o.program ? selectedPrograms.includes(o.program._id) : false
    );
  }

  if (selectedKitCategories.length > 0) {
    filteredOrders = filteredOrders.filter((o) =>
      o.kit?.category ? selectedKitCategories.includes(o.kit.category) : false
    );
  }

  if (selectedKits.length > 0) {
    filteredOrders = filteredOrders.filter((o) => selectedKits.includes(o.kitId));
  }

  if (selectedClients.length > 0) {
    filteredOrders = filteredOrders.filter((o) => selectedClients.includes(o.clientId));
  }

  if (selectedStatuses.length > 0) {
    filteredOrders = filteredOrders.filter((o) => selectedStatuses.includes(o.status));
  }

  if (selectedProductionMonths.length > 0) {
    filteredOrders = filteredOrders.filter((o) =>
      o.productionMonth ? selectedProductionMonths.includes(o.productionMonth) : false
    );
  }

  if (selectedDispatchMonths.length > 0) {
    filteredOrders = filteredOrders.filter((o) => {
      const dispatchDate = new Date(o.dispatchedAt);
      const monthKey = `${dispatchDate.getFullYear()}-${String(dispatchDate.getMonth() + 1).padStart(2, "0")}`;
      return selectedDispatchMonths.includes(monthKey);
    });
  }

  // Apply search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredOrders = filteredOrders.filter((o) => {
      const kitName = o.kit?.name?.toLowerCase() || "";
      const clientName = o.clientType === "b2b"
        ? (o.client as any)?.organization?.toLowerCase() || (o.client as any)?.name?.toLowerCase() || ""
        : (o.client as any)?.buyerName?.toLowerCase() || "";
      const batchName = o.batch?.batchId?.toLowerCase() || "";
      return kitName.includes(query) || clientName.includes(query) || batchName.includes(query);
    });
  }

  // Group orders by batch
  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const batchKey = order.batchId || "no-batch";
    if (!acc[batchKey]) {
      acc[batchKey] = [];
    }
    acc[batchKey].push(order);
    return acc;
  }, {} as Record<string, typeof filteredOrders>);

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

  const handleViewClient = (order: any) => {
    setSelectedClientForView(order.client);
    setViewClientDialogOpen(true);
  };

  const handleStatusChange = async (orderId: Id<"orderHistory">, newStatus: string) => {
    try {
      await updateStatus({ id: orderId, status: newStatus as any });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleClearAllFilters = () => {
    setCustomerTypeFilter("all");
    setSearchQuery("");
    setSelectedBatch("all");
    setSelectedPrograms([]);
    setSelectedKitCategories([]);
    setSelectedKits([]);
    setSelectedClients([]);
    setSelectedStatuses([]);
    setSelectedProductionMonths([]);
    setSelectedDispatchMonths([]);
  };

  const totalQuantity = filteredOrders.reduce((sum, o) => sum + o.quantity, 0);

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Order Records</h1>
            <p className="text-muted-foreground mt-2">
              Historical records of dispatched and delivered orders
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded-lg bg-card">
            <div className="text-sm text-muted-foreground mb-1">Total Orders</div>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="text-sm text-muted-foreground mb-1">Total Quantity</div>
            <div className="text-2xl font-bold">{totalQuantity}</div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="text-sm text-muted-foreground mb-1">Delivered</div>
            <div className="text-2xl font-bold">
              {filteredOrders.filter((o) => o.status === "delivered").length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by kit name, client name, or batch ID..."
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
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by Batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches?.map((batch) => (
                  <SelectItem key={batch._id} value={batch._id}>
                    {batch.batchId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AssignmentFilters
            programs={programs || []}
            kits={kits || []}
            clients={[...(clients || []), ...(b2cClients || [])]}
            assignments={[]}
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

        {/* Orders Grouped by Batch */}
        <div className="space-y-4">
          {!filteredOrders ? (
            <div className="flex items-center justify-center py-12 border rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 border rounded-lg text-muted-foreground">
              No order records found.
            </div>
          ) : (
            Object.entries(groupedOrders).map(([batchKey, batchOrders]) => {
              const batchInfo = batchOrders[0]?.batch;
              const isOpen = openBatches.has(batchKey);
              const batchQuantity = batchOrders.reduce((sum, o) => sum + o.quantity, 0);

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
                            {batchKey === "no-batch" ? "Orders without Batch" : batchInfo?.batchId || batchKey}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {batchOrders.length} orders • {batchQuantity} total quantity
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{batchOrders.length}</Badge>
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
                            <th className="text-left p-4 font-semibold">Delivery Date</th>
                            <th className="text-right p-4 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchOrders.map((order) => (
                            <tr key={order._id} className="border-b hover:bg-muted/20">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {order.clientType === "b2b"
                                      ? (order.client as any)?.organization || (order.client as any)?.name
                                      : (order.client as any)?.buyerName}
                                  </span>
                                  <Badge variant="outline" className="w-fit mt-1">
                                    {order.clientType?.toUpperCase() || "N/A"}
                                  </Badge>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-medium">{order.kit?.name}</span>
                                  {order.kit?.category && (
                                    <span className="text-xs text-muted-foreground">{order.kit.category}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">{order.quantity}</td>
                              <td className="p-4">
                                {order.grade ? (
                                  <Badge variant="outline">Grade {order.grade}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                <Badge
                                  variant={
                                    order.status === "delivered"
                                      ? "default"
                                      : order.status === "cancelled"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {order.status}
                                </Badge>
                              </td>
                              <td className="p-4">
                                {new Date(order.dispatchedAt).toLocaleDateString()}
                              </td>
                              <td className="p-4">
                                {order.deliveredAt
                                  ? new Date(order.deliveredAt).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewClient(order)}
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
                                        onClick={() => handleStatusChange(order._id, "dispatched")}
                                        disabled={order.status === "dispatched"}
                                      >
                                        Dispatched
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleStatusChange(order._id, "delivered")}
                                        disabled={order.status === "delivered"}
                                      >
                                        Delivered
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleStatusChange(order._id, "cancelled")}
                                        disabled={order.status === "cancelled"}
                                      >
                                        Cancelled
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
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