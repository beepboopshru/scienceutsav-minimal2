import { Layout } from "@/components/Layout";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, FileDown } from "lucide-react";
import { toast } from "sonner";
import { aggregateMaterials } from "@/lib/procurementUtils";
import { exportProcurementPDF } from "@/lib/procurementExport";
import { MaterialSummaryTab } from "@/components/procurement/MaterialSummaryTab";
import { KitWiseTab } from "@/components/procurement/KitWiseTab";
import { MonthWiseTab } from "@/components/procurement/MonthWiseTab";
import { ClientWiseTab } from "@/components/procurement/ClientWiseTab";
import { AssignmentWiseTab } from "@/components/procurement/AssignmentWiseTab";
import { usePermissions } from "@/hooks/use-permissions";

export default function Procurement() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shortageFilter, setShortageFilter] = useState<"all" | "shortages">("shortages");
  const [activeTab, setActiveTab] = useState("summary");

  const assignments = useQuery(api.assignments.listAll, {}) || [];
  const inventory = useQuery(api.inventory.list, {}) || [];
  const vendors = useQuery(api.vendors.list, {}) || [];
  const purchasingQuantities = useQuery(api.procurement.getPurchasingQuantities, {}) || [];
  const processingJobs = useQuery(api.processingJobs.list, {}) || [];
  const approvedMaterialRequests = useQuery(api.materialRequests.listApproved, {}) || [];
  const kits = useQuery(api.kits.list, {}) || [];
  const clients = useQuery(api.clients.list, {}) || [];
  const b2cClients = useQuery(api.b2cClients.list, {}) || [];
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("procurementJobs", "edit");

  const materials = useMemo(() => {
    return aggregateMaterials(
      assignments,
      kits,
      inventory,
      purchasingQuantities,
      vendors,
      processingJobs,
      approvedMaterialRequests
    );
  }, [assignments, kits, inventory, purchasingQuantities, vendors, processingJobs, approvedMaterialRequests]);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    toast.info("Recalculating requirements...");
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Requirements recalculated");
    }, 1000);
  };

  const handleExport = () => {
    toast.info("Generating PDF...");
    try {
      // Map assignments to ProcurementAssignment type
      const enrichedAssignments = assignments.map((a: any) => {
        const kit = kits.find((k: any) => k._id === a.kitId);
        const client = clients.find((c: any) => c._id === a.clientId) || b2cClients.find((c: any) => c._id === a.clientId);
        const c = client as any;
        return {
          ...a,
          kitName: kit?.name || "Unknown Kit",
          programName: "N/A",
          clientName: c?.name || c?.organization || c?.buyerName || "Unknown Client",
        };
      });

      exportProcurementPDF(
        activeTab,
        materials,
        enrichedAssignments,
        kits,
        [...clients, ...b2cClients]
      );
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
            <p className="text-muted-foreground">
              Manage material requirements and shortages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            {canEdit && (
              <Button onClick={handleExport}>
                <FileDown className="mr-2 h-4 w-4" />
                Export List
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Material Summary</TabsTrigger>
            <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
            <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
            <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
            <TabsTrigger value="assignment-wise">Assignment Wise</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <MaterialSummaryTab materials={materials} vendors={vendors} />
          </TabsContent>

          <TabsContent value="kit-wise" className="space-y-4">
            <KitWiseTab 
              materials={materials} 
              assignments={assignments}
              kits={kits}
            />
          </TabsContent>

          <TabsContent value="month-wise" className="space-y-4">
            <MonthWiseTab 
              materials={materials} 
              assignments={assignments}
              kits={kits}
              clients={[...clients, ...b2cClients]}
            />
          </TabsContent>

          <TabsContent value="client-wise" className="space-y-4">
            <ClientWiseTab 
              materials={materials} 
              assignments={assignments}
              clients={[...clients, ...b2cClients]}
            />
          </TabsContent>

          <TabsContent value="assignment-wise" className="space-y-4">
            <AssignmentWiseTab 
              materials={materials} 
              assignments={assignments}
              kits={kits}
              clients={[...clients, ...b2cClients]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}