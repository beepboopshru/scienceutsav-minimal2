import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { aggregateMaterials } from "@/lib/procurementUtils";
import { MaterialSummaryTab } from "@/components/procurement/MaterialSummaryTab";
import { KitWiseTab } from "@/components/procurement/KitWiseTab";
import { MonthWiseTab } from "@/components/procurement/MonthWiseTab";
import { ClientWiseTab } from "@/components/procurement/ClientWiseTab";
import { AssignmentWiseTab } from "@/components/procurement/AssignmentWiseTab";
import { Card, CardContent } from "@/components/ui/card";

export default function Procurement() {
  const assignments = useQuery(api.assignments.list, {}) || [];
  const kits = useQuery(api.kits.list) || [];
  const inventory = useQuery(api.inventory.list) || [];
  const purchasingQuantities = useQuery(api.procurement.getPurchasingQuantities) || [];
  const vendors = useQuery(api.vendors.list) || [];
  const clients = useQuery(api.clients.list) || [];
  const b2cClients = useQuery(api.b2cClients.list) || [];
  const processingJobs = useQuery(api.processingJobs.list) || [];
  const materialRequests = useQuery(api.materialRequests.list) || [];

  const [isRefreshing, setIsRefreshing] = useState(false);

  const materials = useMemo(() => {
    if (!assignments.length || !kits.length || !inventory.length) return [];
    return aggregateMaterials(
      assignments,
      kits,
      inventory,
      purchasingQuantities,
      vendors,
      processingJobs,
      materialRequests
    );
  }, [assignments, kits, inventory, purchasingQuantities, vendors, processingJobs, materialRequests]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Requirements recalculated");
    }, 1000);
  };

  const handleExport = () => {
    toast.info("Exporting procurement summary...");
    // Implement export logic here
  };

  return (
    <Layout>
      <div className="p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
            <p className="text-muted-foreground mt-2">
              Manage material requirements and shortages across all active assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Material Summary</TabsTrigger>
            <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
            <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
            <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
            <TabsTrigger value="assignment-wise">Assignment Wise</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <MaterialSummaryTab materials={materials} vendors={vendors} />
          </TabsContent>

          <TabsContent value="kit-wise">
            <KitWiseTab 
              materials={materials} 
              assignments={assignments} 
              kits={kits} 
            />
          </TabsContent>

          <TabsContent value="month-wise">
            <MonthWiseTab 
              materials={materials} 
              assignments={assignments}
              kits={kits}
              clients={[...clients, ...b2cClients]}
            />
          </TabsContent>

          <TabsContent value="client-wise">
            <ClientWiseTab 
              materials={materials} 
              assignments={assignments}
              clients={[...clients, ...b2cClients]}
            />
          </TabsContent>

          <TabsContent value="assignment-wise">
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