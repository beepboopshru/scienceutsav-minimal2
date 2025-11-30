import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Download, Package, Calendar, Users, Layers, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import { exportProcurementPDF } from "@/lib/procurementExport";
import { Id } from "@/convex/_generated/dataModel";

export default function Procurement() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  
  const canView = hasPermission("procurementJobs", "view");
  const canEdit = hasPermission("procurementJobs", "edit");
  
  const assignments = useQuery(api.assignments.list, {});
  const inventory = useQuery(api.inventory.list);
  const vendors = useQuery(api.vendors.list);
  const savedQuantities = useQuery(api.procurementPurchasingQuantities.list);
  
  const removeJob = useMutation(api.procurementJobs.remove);
  const upsertPurchasingQty = useMutation(api.procurementPurchasingQuantities.upsert);
  
  const [activeTab, setActiveTab] = useState("summary");
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [purchasingQuantities, setPurchasingQuantities] = useState<Map<string, number>>(new Map());

  // Load saved purchasing quantities from database
  useEffect(() => {
    if (savedQuantities) {
      const quantitiesMap = new Map<string, number>();
      savedQuantities.forEach((item) => {
        quantitiesMap.set(item.materialName.toLowerCase(), item.purchasingQty);
      });
      setPurchasingQuantities(quantitiesMap);
    }
  }, [savedQuantities]);

  const inventoryByName = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [i.name.toLowerCase(), i]));
  }, [inventory, lastRefresh]);

  const inventoryById = useMemo(() => {
    if (!inventory) return new Map();
    return new Map(inventory.map(i => [i._id, i]));
  }, [inventory, lastRefresh]);

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
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
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

  // --- Helper Functions ---

  const calculateShortages = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !inventory) return { direct: [] };

    const shortages: any[] = [];
    const requiredQty = assignment.quantity;

    const processMaterial = (name: string, qtyPerKit: number, unit: string, category: string, subcategory?: string) => {
      const required = qtyPerKit * requiredQty;
      const invItem = inventoryByName.get(name.toLowerCase());
      const available = invItem?.quantity || 0;
      const minStockLevel = invItem?.minStockLevel || 0;
      const finalSubcategory = subcategory || invItem?.subcategory || "Uncategorized";
      
      // Check if this is a sealed packet - if so, explode its BOM
      if (invItem && invItem.type === "sealed_packet" && invItem.components && invItem.components.length > 0) {
        // Don't add the sealed packet itself to procurement
        // Instead, add its raw material components
        invItem.components.forEach((comp: any) => {
          const compItem = inventoryById.get(comp.rawMaterialId);
          if (compItem && compItem.type === "raw") {
            const compRequired = comp.quantityRequired * qtyPerKit * requiredQty;
            const compAvailable = compItem.quantity || 0;
            const compMinStockLevel = compItem.minStockLevel || 0;
            
            // MSL-based shortage calculation for raw materials
            let compShortage = 0;
            if (compAvailable < compMinStockLevel) {
              // Need to fulfill order + restore MSL
              compShortage = compRequired + (compMinStockLevel - compAvailable);
            } else {
              // Just need to fulfill order if it exceeds available stock
              compShortage = Math.max(0, compRequired - compAvailable);
            }
            
            if (compShortage > 0 || compRequired > 0) {
              shortages.push({
                name: compItem.name,
                required: compRequired,
                available: compAvailable,
                shortage: compShortage,
                unit: comp.unit,
                category: `${category} (from Sealed Packet: ${name})`,
                subcategory: compItem.subcategory || "Uncategorized",
                minStockLevel: compMinStockLevel,
              });
            }
          }
        });
      } else {
        // Regular material (not a sealed packet)
        // Apply MSL logic only to raw materials
        let shortage = 0;
        if (invItem && invItem.type === "raw") {
          if (available < minStockLevel) {
            // Need to fulfill order + restore MSL
            shortage = required + (minStockLevel - available);
          } else {
            // Just need to fulfill order if it exceeds available stock
            shortage = Math.max(0, required - available);
          }
        } else {
          // For non-raw materials, use simple shortage calculation
          shortage = Math.max(0, required - available);
        }
        
        if (shortage > 0 || required > 0) {
          shortages.push({
            name,
            required,
            available,
            shortage,
            unit,
            category,
            subcategory: finalSubcategory,
            minStockLevel,
          });
        }
      }
    };

    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      const totalMaterials = calculateTotalMaterials(structure);
      totalMaterials.forEach(m => processMaterial(m.name, m.quantity, m.unit, "Main Component"));
    }

    kit.spareKits?.forEach((s: any) => processMaterial(s.name, s.quantity, s.unit, "Spare Kit", s.subcategory));
    kit.bulkMaterials?.forEach((b: any) => processMaterial(b.name, b.quantity, b.unit, "Bulk Material", b.subcategory));
    kit.miscellaneous?.forEach((m: any) => processMaterial(m.name, m.quantity, m.unit, "Miscellaneous"));

    return { direct: shortages };
  };

  const aggregateMaterials = (assignmentList: any[]) => {
    const materialMap = new Map<string, any>();

    // 1. Collect direct requirements (already includes sealed packet BOM explosion from calculateShortages)
    assignmentList.forEach((assignment) => {
      const shortages = calculateShortages(assignment);
      shortages.direct.forEach((item: any) => {
        const key = item.name.toLowerCase();
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.required += item.required;
          existing.kits.add(assignment.kit?.name || "Unknown");
          existing.programs.add(assignment.program?.name || "Unknown");
        } else {
          const invItem = inventoryByName.get(item.name.toLowerCase());
          const vendorPrice = getVendorPrice(invItem?._id);
          
          materialMap.set(key, {
            name: item.name,
            required: item.required,
            available: item.available,
            shortage: 0, // Recalculated later
            unit: item.unit,
            category: item.category,
            subcategory: item.subcategory,
            kits: new Set([assignment.kit?.name || "Unknown"]),
            programs: new Set([assignment.program?.name || "Unknown"]),
            processedShortage: 0, // Track processed shortage for BOM explosion
            vendorPrice: vendorPrice,
            inventoryId: invItem?._id,
          });
        }
      });
    });

    // 2. BOM Explosion for Shortages (for pre-processed items that have raw material BOMs)
    const queue = Array.from(materialMap.keys());
    
    while (queue.length > 0) {
      const key = queue.shift()!;
      const item = materialMap.get(key);
      if (!item) continue;

      // Calculate current shortage with MSL logic for raw materials
      const invItem = inventoryByName.get(key);
      let currentShortage = 0;
      
      if (invItem && invItem.type === "raw") {
        const minStockLevel = invItem.minStockLevel || 0;
        if (item.available < minStockLevel) {
          // Need to fulfill order + restore MSL
          currentShortage = item.required + (minStockLevel - item.available);
        } else {
          // Just need to fulfill order if it exceeds available stock
          currentShortage = Math.max(0, item.required - item.available);
        }
      } else {
        // For non-raw materials, use simple shortage calculation
        currentShortage = Math.max(0, item.required - item.available);
      }
      
      item.shortage = currentShortage;
      item.minStockLevel = invItem?.minStockLevel || 0;

      if (currentShortage > 0) {
        const processedShortage = item.processedShortage || 0;
        const newShortage = currentShortage - processedShortage;

        if (newShortage > 0) {
          // Find inventory item to get BOM
          const bomInvItem = inventoryByName.get(key);
          
          if (bomInvItem && bomInvItem.components && bomInvItem.components.length > 0) {
            // Mark as processed to avoid re-processing the same shortage amount
            item.processedShortage = currentShortage;
            // Mark as exploded to exclude from procurement list (since we are making it)
            item.isExploded = true;

            bomInvItem.components.forEach((comp: any) => {
              const compInvItem = inventoryById.get(comp.rawMaterialId);
              if (compInvItem) {
                const compKey = compInvItem.name.toLowerCase();
                const qtyNeeded = newShortage * comp.quantityRequired;

                if (materialMap.has(compKey)) {
                  const existing = materialMap.get(compKey);
                  existing.required += qtyNeeded;
                  // Inherit kits/programs from parent
                  item.kits.forEach((k: string) => existing.kits.add(k));
                  item.programs.forEach((p: string) => existing.programs.add(p));
                  
                  // Add to queue to re-evaluate this component's shortage
                  if (!queue.includes(compKey)) queue.push(compKey);
                } else {
                  const vendorPrice = getVendorPrice(compInvItem._id);
                  
                  materialMap.set(compKey, {
                    name: compInvItem.name,
                    required: qtyNeeded,
                    available: compInvItem.quantity,
                    shortage: 0,
                    unit: compInvItem.unit,
                    category: "Raw Material (BOM)",
                    subcategory: compInvItem.subcategory || "Uncategorized",
                    kits: new Set(item.kits),
                    programs: new Set(item.programs),
                    processedShortage: 0,
                    minStockLevel: compInvItem.minStockLevel || 0,
                    vendorPrice: vendorPrice,
                    inventoryId: compInvItem._id,
                  });
                  queue.push(compKey);
                }
              }
            });
          }
        }
      }
    }

    return Array.from(materialMap.values())
      .filter((item: any) => !item.isExploded)
      .map((item) => ({
      ...item,
      kits: Array.from(item.kits),
      programs: Array.from(item.programs),
    }));
  };

  // --- Helper: Get Vendor Price ---
  const getVendorPrice = (inventoryId?: string) => {
    if (!inventoryId || !vendors) return null;
    
    for (const vendor of vendors) {
      if (vendor.itemPrices) {
        const priceEntry = vendor.itemPrices.find(p => p.itemId === inventoryId);
        if (priceEntry) {
          return priceEntry.averagePrice;
        }
      }
    }
    return null;
  };

  // --- Data Generation ---

  // 1. Kit Wise Data
  const generateKitWiseData = () => {
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
    
    return Array.from(kitMap.values()).map(kit => ({
      ...kit,
      materials: aggregateMaterials(kit.assignments)
    }));
  };

  // 2. Month Wise Data
  const generateMonthWiseData = () => {
    const monthMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      // Use productionMonth if available, else creation time
      const monthKey = assignment.productionMonth || new Date(assignment._creationTime).toISOString().slice(0, 7);
      
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
      .map(month => ({
        ...month,
        materials: aggregateMaterials(month.assignments)
      }));
  };

  // 3. Client Wise Data
  const generateClientWiseData = () => {
    const clientMap = new Map<string, any>();
    assignments.forEach((assignment) => {
      // Add null check for client
      if (!assignment.client) {
        return; // Skip assignments without client data
      }
      
      const clientName = (assignment.client as any)?.organization || (assignment.client as any)?.name || (assignment.client as any)?.buyerName || "Unknown Client";
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

    return Array.from(clientMap.values()).map(client => ({
      ...client,
      materials: aggregateMaterials(client.assignments)
    }));
  };

  // 4. Material Summary (All)
  const materialSummary = aggregateMaterials(assignments);

  const kitWiseData = generateKitWiseData();
  const monthWiseData = generateMonthWiseData();
  const clientWiseData = generateClientWiseData();

  // --- Export Functions ---

  const handleExport = () => {
    // Attach purchasing quantities to materials before export
    const attachPurchasingQty = (materials: any[]) => {
      return materials.map(mat => ({
        ...mat,
        purchasingQty: purchasingQuantities.get(mat.name.toLowerCase()) || mat.shortage
      }));
    };

    if (activeTab === "summary") {
      exportProcurementPDF("summary", attachPurchasingQty(materialSummary), "material-procurement-summary.pdf");
    } else if (activeTab === "kit-wise") {
      const dataWithQty = kitWiseData.map(kit => ({
        ...kit,
        materials: attachPurchasingQty(kit.materials)
      }));
      exportProcurementPDF("kit", dataWithQty, "kit-wise-procurement.pdf");
    } else if (activeTab === "month-wise") {
      const dataWithQty = monthWiseData.map(month => ({
        ...month,
        materials: attachPurchasingQty(month.materials)
      }));
      exportProcurementPDF("month", dataWithQty, "month-wise-procurement.pdf");
    } else if (activeTab === "client-wise") {
      const dataWithQty = clientWiseData.map(client => ({
        ...client,
        materials: attachPurchasingQty(client.materials)
      }));
      exportProcurementPDF("client", dataWithQty, "client-wise-procurement.pdf");
    }
  };

  const handleDelete = async (id: Id<"procurementJobs">) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      const result = await removeJob({ id });
      if (result && 'requestCreated' in result && result.requestCreated) {
        toast.success("Deletion request submitted for admin approval");
      } else {
        toast.success("Job deleted");
      }
    } catch (err) {
      toast.error("Failed to delete job");
    }
  };

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
    
    // Trigger a re-render by updating state
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Requirements recalculated");
    }, 500);
  };

  // --- Render Components ---

  const MaterialTable = ({ materials }: { materials: any[] }) => (
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
          <TableHead>Est. Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((mat: any, idx: number) => {
          const materialKey = mat.name.toLowerCase();
          const purchasingQty = purchasingQuantities.get(materialKey) ?? mat.shortage;
          const estimatedCost = mat.vendorPrice ? (purchasingQty * mat.vendorPrice).toFixed(2) : null;
          
          return (
            <TableRow key={idx}>
              <TableCell className="font-medium">{mat.name}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{mat.category}</Badge></TableCell>
              <TableCell>{mat.required} {mat.unit}</TableCell>
              <TableCell>{mat.available} {mat.unit}</TableCell>
              <TableCell>{mat.minStockLevel || 0} {mat.unit}</TableCell>
              <TableCell>
                {mat.shortage > 0 ? (
                  <Badge variant="destructive" className="text-xs">{mat.shortage} {mat.unit}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">In Stock</Badge>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  value={purchasingQty}
                  onChange={async (e) => {
                    const newQty = Number(e.target.value);
                    setPurchasingQuantities(prev => {
                      const updated = new Map(prev);
                      updated.set(materialKey, newQty);
                      return updated;
                    });
                    
                    // Save to database
                    try {
                      await upsertPurchasingQty({
                        materialName: materialKey,
                        purchasingQty: newQty,
                      });
                    } catch (err) {
                      console.error("Failed to save purchasing quantity:", err);
                    }
                  }}
                  className="w-24"
                  placeholder="0"
                />
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
              <TableCell className="font-medium text-xs">{a.batch?.batchId || a.batchId || "-"}</TableCell>
              <TableCell className="text-xs">{a.program?.name || "-"}</TableCell>
              <TableCell className="text-xs">{a.kit?.name || "-"}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{a.kit?.category || "-"}</Badge></TableCell>
              <TableCell className="text-xs">{a.client?.name || a.client?.buyerName || "-"}</TableCell>
              <TableCell className="text-right text-xs">{a.quantity}</TableCell>
              <TableCell className="text-xs">{a.dispatchedAt ? new Date(a.dispatchedAt).toLocaleDateString() : "-"}</TableCell>
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
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                            <TableHead>Est. Cost</TableHead>
                            <TableHead>Used In (Kits)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materialSummary.map((item, idx) => {
                            const materialKey = item.name.toLowerCase();
                            const purchasingQty = purchasingQuantities.get(materialKey) ?? item.shortage;
                            const estimatedCost = item.vendorPrice ? (purchasingQty * item.vendorPrice).toFixed(2) : null;
                            
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                                <TableCell>{item.required} {item.unit}</TableCell>
                                <TableCell>{item.available} {item.unit}</TableCell>
                                <TableCell>{item.minStockLevel || 0} {item.unit}</TableCell>
                                <TableCell>
                                  {item.shortage > 0 ? (
                                    <Badge variant="destructive">{item.shortage} {item.unit}</Badge>
                                  ) : (
                                    <Badge variant="secondary">In Stock</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={purchasingQty}
                                    onChange={async (e) => {
                                      const newQty = Number(e.target.value);
                                      setPurchasingQuantities(prev => {
                                        const updated = new Map(prev);
                                        updated.set(materialKey, newQty);
                                        return updated;
                                      });
                                      
                                      // Save to database
                                      try {
                                        await upsertPurchasingQty({
                                          materialName: materialKey,
                                          purchasingQty: newQty,
                                        });
                                      } catch (err) {
                                        console.error("Failed to save purchasing quantity:", err);
                                      }
                                    }}
                                    className="w-24"
                                    placeholder="0"
                                  />
                                </TableCell>
                                <TableCell>
                                  {estimatedCost ? (
                                    <span className="font-medium">₹{estimatedCost}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">No price</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                  {item.kits.join(", ")}
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
                          <Badge variant={kit.materials.some((m: any) => m.shortage > 0) ? "destructive" : "secondary"}>
                            {kit.materials.filter((m: any) => m.shortage > 0).length} Shortages
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
                          <Badge variant={month.materials.some((m: any) => m.shortage > 0) ? "destructive" : "secondary"}>
                            {month.materials.filter((m: any) => m.shortage > 0).length} Shortages
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
                          <Badge variant={client.materials.some((m: any) => m.shortage > 0) ? "destructive" : "secondary"}>
                            {client.materials.filter((m: any) => m.shortage > 0).length} Shortages
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
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}