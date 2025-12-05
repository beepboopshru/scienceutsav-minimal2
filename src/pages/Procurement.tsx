import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Download, Package, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { exportProcurementPDF } from "@/lib/procurementExport";
import { aggregateMaterials, type MaterialShortage } from "@/lib/procurementUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function Procurement() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canView = hasPermission("procurementJobs", "view");
  const canEdit = hasPermission("procurementJobs", "edit");

  // Data queries
  const assignments = useQuery(api.assignments.list, {});
  const inventory = useQuery(api.inventory.list);
  const vendors = useQuery(api.vendors.list);
  const savedQuantities = useQuery(api.procurementPurchasingQuantities.list);
  const procurementJobs = useQuery(api.procurementJobs.list);
  const approvedMaterialRequests = useQuery(api.materialRequestsByAssignment.getAllApprovedQuantities);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);

  // Mutations
  const upsertPurchasingQty = useMutation(api.procurementPurchasingQuantities.upsert);
  const markJobComplete = useMutation(api.procurementJobs.markAsComplete);

  // Local state
  const [activeTab, setActiveTab] = useState("summary");
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [purchasingQuantities, setPurchasingQuantities] = useState<Map<string, number>>(new Map());
  const [selectedVendors, setSelectedVendors] = useState<Map<string, string>>(new Map());
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showShortagesOnly, setShowShortagesOnly] = useState<boolean>(false);

  // Load saved purchasing quantities
  useEffect(() => {
    if (savedQuantities) {
      const quantitiesMap = new Map<string, number>();
      savedQuantities.forEach((item) => {
        quantitiesMap.set(item.materialName.toLowerCase(), item.purchasingQty);
      });
      setPurchasingQuantities(quantitiesMap);
    }
  }, [savedQuantities]);

  // Create inventory lookup maps
  const inventoryByName = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map((i) => [i.name.toLowerCase(), i]));
  }, [inventory]);

  const inventoryById = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map((i) => [i._id, i]));
  }, [inventory]);

  // Filter procurement jobs
  const filteredProcurementJobs = useMemo(() => {
    if (!procurementJobs) return [];
    
    return procurementJobs.filter((job: any) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (priorityFilter !== "all" && job.priority !== priorityFilter) return false;
      return true;
    });
  }, [procurementJobs, statusFilter, priorityFilter]);

  // Generate aggregated data views
  const materialSummary = useMemo(() => {
    if (!assignments || !inventory || !vendors) return [];
    return aggregateMaterials(
      assignments, 
      inventoryByName, 
      inventoryById, 
      vendors,
      approvedMaterialRequests || undefined
    );
  }, [assignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests]);

  const kitWiseData = useMemo(() => {
    if (!assignments || !inventory || !vendors) return [];

    const kitMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      const kitName = assignment.kit?.name || "Unknown";
      if (!kitMap.has(kitName)) {
        kitMap.set(kitName, {
          name: kitName,
          assignments: [],
          totalQuantity: 0,
        });
      }
      const entry = kitMap.get(kitName);
      entry.assignments.push(assignment);
      entry.totalQuantity += assignment.quantity;
    });

    return Array.from(kitMap.values()).map((kit) => ({
      ...kit,
      materials: aggregateMaterials(
        kit.assignments, 
        inventoryByName, 
        inventoryById, 
        vendors,
        approvedMaterialRequests || undefined
      ),
    }));
  }, [assignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests]);

  const monthWiseData = useMemo(() => {
    if (!assignments || !inventory || !vendors) return [];

    const monthMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      const monthKey =
        assignment.productionMonth ||
        new Date(assignment._creationTime).toISOString().slice(0, 7);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          assignments: [],
          totalAssignments: 0,
        });
      }
      const entry = monthMap.get(monthKey);
      entry.assignments.push(assignment);
      entry.totalAssignments += 1;
    });

    return Array.from(monthMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((month) => ({
        ...month,
        materials: aggregateMaterials(
          month.assignments, 
          inventoryByName, 
          inventoryById, 
          vendors,
          approvedMaterialRequests || undefined
        ),
      }));
  }, [assignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests]);

  const clientWiseData = useMemo(() => {
    if (!assignments || !inventory || !vendors) return [];

    const clientMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      // Skip assignments without client data
      if (!assignment.client) return;

      // Extract client name with better fallback logic
      let clientName = "Unknown Client";
      const client = assignment.client as any;
      
      if (typeof client === 'string') {
        clientName = client;
      } else if (typeof client === 'object') {
        clientName = 
          client.organization || 
          client.name || 
          client.buyerName || 
          client.contactPerson ||
          client.email ||
          "Unknown Client";
      }

      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, {
          clientName: clientName,
          assignments: [],
          totalKits: 0,
        });
      }
      const entry = clientMap.get(clientName);
      entry.assignments.push(assignment);
      entry.totalKits += assignment.quantity;
    });

    return Array.from(clientMap.values()).map((client) => ({
      ...client,
      materials: aggregateMaterials(
        client.assignments, 
        inventoryByName, 
        inventoryById, 
        vendors,
        approvedMaterialRequests || undefined
      ),
    }));
  }, [assignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests]);

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Handlers
  const handleRefresh = () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefresh;
    const oneMinute = 60000;

    if (timeSinceLastRefresh < oneMinute) {
      const remainingSeconds = Math.ceil((oneMinute - timeSinceLastRefresh) / 1000);
      toast.error(`Please wait ${remainingSeconds} seconds before refreshing again`);
      return;
    }

    setIsRefreshing(true);
    setLastRefresh(now);

    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Requirements recalculated");
    }, 500);
  };

  const handleMarkComplete = async (jobId: string) => {
    try {
      await markJobComplete({ id: jobId as any });
      toast.success("Procurement job marked as complete");
    } catch (error) {
      toast.error("Failed to mark procurement as complete", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleExport = () => {
    const attachPurchasingQty = (materials: MaterialShortage[]) => {
      return materials.map((mat) => {
        const materialKey = mat.name.toLowerCase();
        const selectedVendor = selectedVendors.get(materialKey);
        return {
          ...mat,
          purchasingQty: purchasingQuantities.get(materialKey) || mat.shortage,
          vendorName: selectedVendor || mat.vendorName,
        };
      });
    };

    if (activeTab === "summary") {
      exportProcurementPDF(
        "summary",
        attachPurchasingQty(materialSummary),
        "material-procurement-summary.pdf"
      );
    } else if (activeTab === "kit-wise") {
      const dataWithQty = kitWiseData.map((kit) => ({
        ...kit,
        materials: attachPurchasingQty(kit.materials),
      }));
      exportProcurementPDF("kit", dataWithQty, "kit-wise-procurement.pdf");
    } else if (activeTab === "month-wise") {
      const dataWithQty = monthWiseData.map((month) => ({
        ...month,
        materials: attachPurchasingQty(month.materials),
      }));
      exportProcurementPDF("month", dataWithQty, "month-wise-procurement.pdf");
    } else if (activeTab === "client-wise") {
      const dataWithQty = clientWiseData.map((client) => ({
        ...client,
        materials: attachPurchasingQty(client.materials),
      }));
      exportProcurementPDF("client", dataWithQty, "client-wise-procurement.pdf");
    }
  };

  const handlePurchasingQtyChange = async (materialName: string, newQty: number) => {
    const materialKey = materialName.toLowerCase();
    setPurchasingQuantities((prev) => {
      const updated = new Map(prev);
      updated.set(materialKey, newQty);
      return updated;
    });

    try {
      await upsertPurchasingQty({
        materialName: materialKey,
        purchasingQty: newQty,
      });
    } catch (err) {
      console.error("Failed to save purchasing quantity:", err);
      toast.error("Failed to save purchasing quantity");
    }
  };

  const handleVendorChange = (materialName: string, vendorName: string) => {
    const materialKey = materialName.toLowerCase();
    setSelectedVendors((prev) => {
      const updated = new Map(prev);
      updated.set(materialKey, vendorName);
      return updated;
    });
  };

  // Permission check
  if (!canView) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">
            You do not have permission to view this page.
          </p>
        </div>
      </Layout>
    );
  }

  // Loading state
  if (isLoading || !assignments || !inventory || !vendors) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  // Render components
  const MaterialTable = ({ materials }: { materials: MaterialShortage[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Order Req.</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Min. Stock</TableHead>
          <TableHead>Shortage (Procurement)</TableHead>
          <TableHead>Purchasing Qty</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead>Est. Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((mat, idx) => {
          const materialKey = mat.name.toLowerCase();
          const purchasingQty = purchasingQuantities.get(materialKey) ?? mat.shortage;
          const selectedVendor = selectedVendors.get(materialKey) || mat.vendorName;
          
          // Get vendors for this material
          const materialVendors = vendors?.filter(v => 
            v.inventoryItems?.includes(mat.inventoryId as any)
          ) || [];
          
          const estimatedCost = mat.vendorPrice
            ? (purchasingQty * mat.vendorPrice).toFixed(2)
            : null;

          return (
            <TableRow key={idx}>
              <TableCell className="font-medium">{mat.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {mat.category}
                </Badge>
              </TableCell>
              <TableCell>
                {mat.required} {mat.unit}
              </TableCell>
              <TableCell>
                {mat.available} {mat.unit}
              </TableCell>
              <TableCell>
                {mat.minStockLevel || 0} {mat.unit}
              </TableCell>
              <TableCell>
                {mat.shortage > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    {mat.shortage} {mat.unit}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    In Stock
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  value={purchasingQty}
                  onChange={(e) => handlePurchasingQtyChange(mat.name, Number(e.target.value))}
                  className="w-24"
                  placeholder="0"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={selectedVendor || ""}
                  onValueChange={(value) => handleVendorChange(mat.name, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialVendors.length > 0 ? (
                      materialVendors.map((vendor) => (
                        <SelectItem key={vendor._id} value={vendor.name}>
                          {vendor.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-vendor" disabled>
                        No vendors available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {estimatedCost ? (
                  <span className="font-medium">₹{estimatedCost}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">No price</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const AssignmentsTable = ({ assignments }: { assignments: any[] }) => (
    <div className="mb-6 border rounded-md overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b text-sm font-medium">Assignment Details</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Batch</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Kit</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Dispatch</TableHead>
            <TableHead>Prod. Month</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-xs">
                {a.batch?.batchId || a.batchId || "-"}
              </TableCell>
              <TableCell className="text-xs">{a.program?.name || "-"}</TableCell>
              <TableCell className="text-xs">{a.kit?.name || "-"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">
                  {a.kit?.category || "-"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {a.client?.name || a.client?.buyerName || "-"}
              </TableCell>
              <TableCell className="text-right text-xs">{a.quantity}</TableCell>
              <TableCell className="text-xs">
                {a.dispatchedAt ? new Date(a.dispatchedAt).toLocaleDateString() : "-"}
              </TableCell>
              <TableCell className="text-xs">{a.productionMonth || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Layout>
      <div className="p-8 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
            <p className="text-muted-foreground mt-2">
              Manage material requirements and shortages across all assignments
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canEdit && (
              <Button onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export {activeTab === "summary" ? "Summary" : "List"} PDF
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="summary">Material Summary</TabsTrigger>
            <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
            <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
            <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
          </TabsList>

          <div className="mt-6 flex-1">
            {/* Material Summary Tab */}
            <TabsContent value="summary" className="h-full">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Total Material Requirements</CardTitle>
                  <CardDescription>Aggregated list of all materials needed across all assignments</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-[calc(100vh-350px)]">
                    <div className="p-6 pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Order Req.</TableHead>
                            <TableHead>Available</TableHead>
                            <TableHead>Min. Stock</TableHead>
                            <TableHead>Shortage (Procurement)</TableHead>
                            <TableHead>Purchasing Qty</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Est. Cost</TableHead>
                            <TableHead className="w-[80px]">Kits</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materialSummary.map((item, idx) => {
                            const materialKey = item.name.toLowerCase();
                            const purchasingQty =
                              purchasingQuantities.get(materialKey) ?? item.shortage;
                            const selectedVendor = selectedVendors.get(materialKey) || item.vendorName;
                            
                            // Get vendors for this material
                            const materialVendors = vendors?.filter(v => 
                              v.inventoryItems?.includes(item.inventoryId as any)
                            ) || [];
                            
                            const estimatedCost = item.vendorPrice
                              ? (purchasingQty * item.vendorPrice).toFixed(2)
                              : null;

                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{item.category}</Badge>
                                </TableCell>
                                <TableCell>
                                  {item.required} {item.unit}
                                </TableCell>
                                <TableCell>
                                  {item.available} {item.unit}
                                </TableCell>
                                <TableCell>
                                  {item.minStockLevel || 0} {item.unit}
                                </TableCell>
                                <TableCell>
                                  {item.shortage > 0 ? (
                                    <Badge variant="destructive">
                                      {item.shortage} {item.unit}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">In Stock</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={purchasingQty}
                                    onChange={(e) =>
                                      handlePurchasingQtyChange(item.name, Number(e.target.value))
                                    }
                                    className="w-24"
                                    placeholder="0"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={selectedVendor || ""}
                                    onValueChange={(value) => handleVendorChange(item.name, value)}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue placeholder="Select vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {materialVendors.length > 0 ? (
                                        materialVendors.map((vendor) => (
                                          <SelectItem key={vendor._id} value={vendor.name}>
                                            {vendor.name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="no-vendor" disabled>
                                          No vendors available
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {estimatedCost ? (
                                    <span className="font-medium">₹{estimatedCost}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">No price</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <Info className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Used in Kits</h4>
                                        <div className="text-sm text-muted-foreground max-h-[200px] overflow-y-auto">
                                          {item.kits.length > 0 ? (
                                            <ul className="list-disc list-inside space-y-1">
                                              {item.kits.map((kit, idx) => (
                                                <li key={idx}>{kit}</li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p>No kits found</p>
                                          )}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Kit Wise Tab */}
            <TabsContent value="kit-wise" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-4 pr-4">
                  {kitWiseData.map((kit, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{kit.name}</CardTitle>
                            <div className="flex flex-wrap gap-2 mt-2 mb-1">
                            <Badge variant="secondary" className="font-normal">
                              Program: {kit.assignments[0]?.program?.name || "Unknown"}
                            </Badge>
                            <Badge variant="outline" className="font-normal">
                              Category: {kit.assignments[0]?.kit?.category || "Unknown"}
                            </Badge>
                            </div>
                            <CardDescription>Total Assigned: {kit.totalQuantity} units</CardDescription>
                          </div>
                          <Badge
                            variant={
                              kit.materials.some((m: MaterialShortage) => m.shortage > 0)
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {kit.materials.filter((m: MaterialShortage) => m.shortage > 0).length} Shortages
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <MaterialTable materials={kit.materials} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Month Wise Tab */}
            <TabsContent value="month-wise" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-4 pr-4">
                  {monthWiseData.map((month, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {new Date(month.month + "-01").toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                            </CardTitle>
                            <CardDescription>{month.totalAssignments} Assignments</CardDescription>
                          </div>
                          <Badge
                            variant={
                              month.materials.some((m: MaterialShortage) => m.shortage > 0)
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {month.materials.filter((m: MaterialShortage) => m.shortage > 0).length} Shortages
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <AssignmentsTable assignments={month.assignments} />
                        <div className="mt-6">
                          <h4 className="text-sm font-medium mb-3">Material Requirements</h4>
                          <MaterialTable materials={month.materials} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Client Wise Tab */}
            <TabsContent value="client-wise" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-4 pr-4">
                  {clientWiseData.map((client, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{client.clientName}</CardTitle>
                            <CardDescription>Total Kits Ordered: {client.totalKits}</CardDescription>
                          </div>
                          <Badge
                            variant={
                              client.materials.some((m: MaterialShortage) => m.shortage > 0)
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {client.materials.filter((m: MaterialShortage) => m.shortage > 0).length} Shortages
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <AssignmentsTable assignments={client.assignments} />
                        <div className="mt-6">
                          <h4 className="text-sm font-medium mb-3">Material Requirements</h4>
                          <MaterialTable materials={client.materials} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Assignment Wise Tab */}
            <TabsContent value="assignment" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-4 pr-4">
                  {(() => {
                    if (!assignments || !kits) return null;

                    // Filter out completed assignments
                    const activeAssignments = assignments.filter(
                      (a) => a.status !== "dispatched" && a.status !== "delivered"
                    );

                    if (activeAssignments.length === 0) {
                      return (
                        <Card>
                          <CardContent className="py-8">
                            <div className="text-center text-muted-foreground">
                              No active assignments found.
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return activeAssignments.map((assignment) => {
                      const kit = kits.find((k) => k._id === assignment.kitId);
                      const client = assignment.clientType === "b2b"
                        ? clients?.find((c) => c._id === assignment.clientId)
                        : b2cClients?.find((c) => c._id === assignment.clientId);

                      if (!kit) return null;

                      // Calculate materials for this specific assignment
                      const materials = aggregateMaterials(
                        [assignment],
                        inventoryByName,
                        inventoryById,
                        vendors || [],
                        approvedMaterialRequests || undefined
                      );

                      const totalShortages = materials.filter((m) => m.shortage > 0).length;

                      return (
                        <Card key={assignment._id}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">{kit.name}</CardTitle>
                                <div className="flex flex-wrap gap-2 mt-2 mb-1">
                                  <Badge variant="secondary" className="font-normal">
                                    Program: {assignment.program?.name || "Unknown"}
                                  </Badge>
                                  <Badge variant="outline" className="font-normal">
                                    Category: {kit.category || "Unknown"}
                                  </Badge>
                                </div>
                                <CardDescription>
                                  Client: {assignment.clientType === "b2b" 
                                    ? (client as any)?.name 
                                    : (client as any)?.buyerName || "Unknown"} • 
                                  Quantity: {assignment.quantity} units • 
                                  Month: {assignment.productionMonth || "N/A"}
                                </CardDescription>
                              </div>
                              {totalShortages > 0 ? (
                                <Badge variant="destructive">
                                  {totalShortages} Shortage{totalShortages !== 1 ? "s" : ""}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">All Available</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <MaterialTable materials={materials} />
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}