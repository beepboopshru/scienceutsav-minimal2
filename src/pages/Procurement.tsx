import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Download, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { exportProcurementPDF } from "@/lib/procurementExport";
import { aggregateMaterials, type MaterialShortage } from "@/lib/procurementUtils";

// Import sub-components
import { MaterialSummaryTab } from "@/components/procurement/MaterialSummaryTab";
import { KitWiseTab } from "@/components/procurement/KitWiseTab";
import { MonthWiseTab } from "@/components/procurement/MonthWiseTab";
import { ClientWiseTab } from "@/components/procurement/ClientWiseTab";
import { AssignmentWiseTab } from "@/components/procurement/AssignmentWiseTab";

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
  const processingJobs = useQuery(api.processingJobs.list);
  const approvedMaterialRequests = useQuery(api.materialRequestsByAssignment.getAllApprovedQuantities);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);

  // Mutations
  const upsertPurchasingQty = useMutation(api.procurementPurchasingQuantities.upsert);

  // Local state
  const [activeTab, setActiveTab] = useState("summary");
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [purchasingQuantities, setPurchasingQuantities] = useState<Map<string, number>>(new Map());
  const [selectedVendors, setSelectedVendors] = useState<Map<string, string>>(new Map());

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

  // Filter active assignments (exclude received_from_inventory, dispatched, delivered)
  // Note: aggregateMaterials also does this filtering, but we do it here for grouping logic
  const activeAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter((a) => {
      const status = (a as any).status;
      return (
        status === "assigned" ||
        status === "in_production" ||
        status === "ready_to_pack" ||
        status === "transferred_to_dispatch" ||
        status === "ready_for_dispatch"
      );
    });
  }, [assignments]);

  // --- Data Aggregation ---

  const materialSummary = useMemo(() => {
    if (!assignments || !inventory || !vendors) return [];
    
    const allMaterials = aggregateMaterials(
      assignments, // aggregateMaterials handles filtering internally now
      inventoryByName, 
      inventoryById, 
      vendors,
      approvedMaterialRequests || undefined,
      processingJobs || undefined
    );
    
    // Filter out items that are fully in stock (no shortage)
    return allMaterials.filter(item => item.shortage > 0);
  }, [assignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests, processingJobs]);

  const kitWiseData = useMemo(() => {
    if (!activeAssignments || !inventory || !vendors) return [];

    const kitMap = new Map<string, any>();
    activeAssignments.forEach((assignment) => {
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

    return Array.from(kitMap.values()).map((kit) => {
      const allMaterials = aggregateMaterials(
        kit.assignments, 
        inventoryByName, 
        inventoryById, 
        vendors,
        approvedMaterialRequests || undefined,
        processingJobs || undefined
      );
      return {
        ...kit,
        materials: allMaterials.filter(item => item.shortage > 0),
      };
    }).filter(kit => kit.materials.length > 0);
  }, [activeAssignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests, processingJobs]);

  const monthWiseData = useMemo(() => {
    if (!activeAssignments || !inventory || !vendors) return [];

    const monthMap = new Map<string, any>();
    activeAssignments.forEach((assignment) => {
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
      .map((month) => {
        const allMaterials = aggregateMaterials(
          month.assignments, 
          inventoryByName, 
          inventoryById, 
          vendors,
          approvedMaterialRequests || undefined,
          processingJobs || undefined
        );
        return {
          ...month,
          materials: allMaterials.filter(item => item.shortage > 0),
        };
      }).filter(month => month.materials.length > 0);
  }, [activeAssignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests, processingJobs]);

  const clientWiseData = useMemo(() => {
    if (!activeAssignments || !inventory || !vendors) return [];

    const clientMap = new Map<string, any>();
    activeAssignments.forEach((assignment) => {
      if (!assignment.client) return;

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

    return Array.from(clientMap.values()).map((client) => {
      const allMaterials = aggregateMaterials(
        client.assignments, 
        inventoryByName, 
        inventoryById, 
        vendors,
        approvedMaterialRequests || undefined,
        processingJobs || undefined
      );
      return {
        ...client,
        materials: allMaterials.filter(item => item.shortage > 0),
      };
    }).filter(client => client.materials.length > 0);
  }, [activeAssignments, inventory, vendors, inventoryByName, inventoryById, approvedMaterialRequests, processingJobs]);

  // --- Handlers ---

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

  // --- Auth & Permissions ---

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

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

  if (isLoading || !assignments || !inventory || !vendors) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

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
          <TabsList className="grid w-full grid-cols-5 lg:w-[800px]">
            <TabsTrigger value="summary">Material Summary</TabsTrigger>
            <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
            <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
            <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
            <TabsTrigger value="assignment">Assignment Wise</TabsTrigger>
          </TabsList>

          <div className="mt-6 flex-1">
            <TabsContent value="summary" className="h-full">
              <MaterialSummaryTab
                materials={materialSummary}
                vendors={vendors}
                purchasingQuantities={purchasingQuantities}
                selectedVendors={selectedVendors}
                onPurchasingQtyChange={handlePurchasingQtyChange}
                onVendorChange={handleVendorChange}
              />
            </TabsContent>

            <TabsContent value="kit-wise" className="h-full">
              <KitWiseTab
                data={kitWiseData}
                vendors={vendors}
                purchasingQuantities={purchasingQuantities}
                selectedVendors={selectedVendors}
                onPurchasingQtyChange={handlePurchasingQtyChange}
                onVendorChange={handleVendorChange}
              />
            </TabsContent>

            <TabsContent value="month-wise" className="h-full">
              <MonthWiseTab
                data={monthWiseData}
                vendors={vendors}
                purchasingQuantities={purchasingQuantities}
                selectedVendors={selectedVendors}
                onPurchasingQtyChange={handlePurchasingQtyChange}
                onVendorChange={handleVendorChange}
              />
            </TabsContent>

            <TabsContent value="client-wise" className="h-full">
              <ClientWiseTab
                data={clientWiseData}
                vendors={vendors}
                purchasingQuantities={purchasingQuantities}
                selectedVendors={selectedVendors}
                onPurchasingQtyChange={handlePurchasingQtyChange}
                onVendorChange={handleVendorChange}
              />
            </TabsContent>

            <TabsContent value="assignment" className="h-full">
              <AssignmentWiseTab
                assignments={assignments}
                kits={kits || []}
                clients={clients || []}
                b2cClients={b2cClients || []}
                inventoryByName={inventoryByName}
                inventoryById={inventoryById}
                vendors={vendors}
                approvedMaterialRequests={approvedMaterialRequests}
                processingJobs={processingJobs}
                purchasingQuantities={purchasingQuantities}
                selectedVendors={selectedVendors}
                onPurchasingQtyChange={handlePurchasingQtyChange}
                onVendorChange={handleVendorChange}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}