import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Download, Package, Calendar, Users, Layers, AlertCircle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Procurement() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  
  const canView = hasPermission("procurementJobs", "view");
  const canEdit = hasPermission("procurementJobs", "edit");
  
  const assignments = useQuery(api.assignments.list, {});
  const inventory = useQuery(api.inventory.list);
  
  const [activeTab, setActiveTab] = useState("kit-wise");
  const [searchTerm, setSearchTerm] = useState("");
  const [showShortagesOnly, setShowShortagesOnly] = useState(false);

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

  if (isLoading || !assignments || !inventory) {
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

    const processMaterial = (name: string, qtyPerKit: number, unit: string, category: string) => {
      const required = qtyPerKit * requiredQty;
      const invItem = inventory.find((i) => i.name.toLowerCase() === name.toLowerCase());
      const available = invItem?.quantity || 0;
      const shortage = Math.max(0, required - available);
      
      if (shortage > 0 || required > 0) {
        shortages.push({
          name,
          required,
          available,
          shortage,
          unit,
          category,
        });
      }
    };

    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      const totalMaterials = calculateTotalMaterials(structure);
      totalMaterials.forEach(m => processMaterial(m.name, m.quantity, m.unit, "Main Component"));
    }

    kit.spareKits?.forEach((s: any) => processMaterial(s.name, s.quantity, s.unit, "Spare Kit"));
    kit.bulkMaterials?.forEach((b: any) => processMaterial(b.name, b.quantity, b.unit, "Bulk Material"));
    kit.miscellaneous?.forEach((m: any) => processMaterial(m.name, m.quantity, m.unit, "Miscellaneous"));

    return { direct: shortages };
  };

  const aggregateMaterials = (assignmentList: any[]) => {
    const materialMap = new Map<string, any>();

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
          materialMap.set(key, {
            name: item.name,
            required: item.required,
            available: item.available,
            shortage: 0, // Recalculated at end
            unit: item.unit,
            category: item.category,
            kits: new Set([assignment.kit?.name || "Unknown"]),
            programs: new Set([assignment.program?.name || "Unknown"]),
          });
        }
      });
    });

    return Array.from(materialMap.values()).map((item) => ({
      ...item,
      shortage: Math.max(0, item.required - item.available),
      kits: Array.from(item.kits),
      programs: Array.from(item.programs),
    }));
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
      const clientName = (assignment.client as any)?.name || "Unknown Client";
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

  // --- Filtering Logic ---

  const filterData = (data: any[], type: "kit" | "month" | "client" | "material") => {
    return data.filter(item => {
      // Search Filter
      let matchesSearch = false;
      if (type === "kit") matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      else if (type === "month") matchesSearch = item.month.toLowerCase().includes(searchTerm.toLowerCase());
      else if (type === "client") matchesSearch = item.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      else if (type === "material") matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

      // Shortage Filter
      let matchesShortage = true;
      if (showShortagesOnly) {
        if (type === "material") {
          matchesShortage = item.shortage > 0;
        } else {
          // For containers (kits, months, clients), match if they have ANY shortage
          matchesShortage = item.materials.some((m: any) => m.shortage > 0);
        }
      }

      return matchesSearch && matchesShortage;
    });
  };

  const filteredKitWiseData = filterData(kitWiseData, "kit");
  const filteredMonthWiseData = filterData(monthWiseData, "month");
  const filteredClientWiseData = filterData(clientWiseData, "client");
  const filteredMaterialSummary = filterData(materialSummary, "material");

  // --- Export Functions ---

  const getMaterialsFromCurrentView = () => {
    if (activeTab === "summary") return filteredMaterialSummary;

    // Aggregate materials from the filtered items in the current view
    let itemsToAggregate: any[] = [];
    if (activeTab === "kit-wise") itemsToAggregate = filteredKitWiseData;
    else if (activeTab === "month-wise") itemsToAggregate = filteredMonthWiseData;
    else if (activeTab === "client-wise") itemsToAggregate = filteredClientWiseData;

    // Re-aggregate materials
    const materialMap = new Map<string, any>();

    itemsToAggregate.forEach((item) => {
      item.materials.forEach((mat: any) => {
        const key = mat.name.toLowerCase();
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.required += mat.required;
          // Available is constant per material, don't sum it
          // Merge usage lists
          mat.kits.forEach((k: string) => existing.kits.add(k));
        } else {
          materialMap.set(key, {
            name: mat.name,
            category: mat.category,
            unit: mat.unit,
            required: mat.required,
            available: mat.available,
            kits: new Set(mat.kits),
          });
        }
      });
    });

    return Array.from(materialMap.values()).map((item) => ({
      ...item,
      shortage: Math.max(0, item.required - item.available),
      kits: Array.from(item.kits),
    }));
  };

  const exportProcurementListPDF = () => {
    const materials = getMaterialsFromCurrentView();
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Procurement List", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    let filterText = `View: ${activeTab.replace("-", " ").toUpperCase()}`;
    if (searchTerm) filterText += ` | Search: "${searchTerm}"`;
    if (showShortagesOnly) filterText += ` | Shortages Only`;
    doc.text(filterText, 14, 38);

    const tableData = materials.map((item) => [
      item.name,
      item.category,
      `${item.required} ${item.unit}`,
      `${item.available} ${item.unit}`,
      item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock",
      item.kits.join(", ").substring(0, 30) + (item.kits.join(", ").length > 30 ? "..." : ""),
    ]);

    autoTable(doc, {
      head: [["Material", "Category", "Required", "Available", "Shortage", "Used In"]],
      body: tableData,
      startY: 45,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`procurement-list-${activeTab}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Exported Procurement List PDF");
  };

  // --- Render Components ---

  const MaterialTable = ({ materials }: { materials: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Shortage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((mat: any, idx: number) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{mat.name}</TableCell>
            <TableCell><Badge variant="outline" className="text-xs">{mat.category}</Badge></TableCell>
            <TableCell>{mat.required} {mat.unit}</TableCell>
            <TableCell>{mat.available} {mat.unit}</TableCell>
            <TableCell>
              {mat.shortage > 0 ? (
                <Badge variant="destructive" className="text-xs">{mat.shortage} {mat.unit}</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">In Stock</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
          <div className="flex items-center gap-4">
             {canEdit && (
              <Button onClick={exportProcurementListPDF}>
                <Download className="mr-2 h-4 w-4" />
                Export List
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 bg-muted/30 p-4 rounded-lg border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-background"
            />
          </div>
          <div className="flex items-center space-x-2 border-l pl-4">
            <Switch
              id="shortage-mode"
              checked={showShortagesOnly}
              onCheckedChange={setShowShortagesOnly}
            />
            <Label htmlFor="shortage-mode" className="cursor-pointer">Show Shortages Only</Label>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="kit-wise">Kit Wise</TabsTrigger>
            <TabsTrigger value="month-wise">Month Wise</TabsTrigger>
            <TabsTrigger value="client-wise">Client Wise</TabsTrigger>
            <TabsTrigger value="summary">Material Summary</TabsTrigger>
          </TabsList>

          <div className="mt-6 flex-1">
            {/* Kit Wise Tab */}
            <TabsContent value="kit-wise" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-4 pr-4">
                  {filteredKitWiseData.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No kits found matching your filters.</div>
                  ) : (
                    filteredKitWiseData.map((kit, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{kit.name}</CardTitle>
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
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Month Wise Tab */}
            <TabsContent value="month-wise" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-4 pr-4">
                  {filteredMonthWiseData.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No data found matching your filters.</div>
                  ) : (
                    filteredMonthWiseData.map((month, idx) => (
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
                          <MaterialTable materials={month.materials} />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Client Wise Tab */}
            <TabsContent value="client-wise" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-4 pr-4">
                  {filteredClientWiseData.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No clients found matching your filters.</div>
                  ) : (
                    filteredClientWiseData.map((client, idx) => (
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
                          <MaterialTable materials={client.materials} />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Material Summary Tab */}
            <TabsContent value="summary" className="h-full">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Total Material Requirements</CardTitle>
                  <CardDescription>Aggregated list of all materials needed across all assignments</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="p-6 pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Available</TableHead>
                            <TableHead>Shortage</TableHead>
                            <TableHead>Used In (Kits)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMaterialSummary.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No materials found matching your filters.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredMaterialSummary.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                                <TableCell>{item.required} {item.unit}</TableCell>
                                <TableCell>{item.available} {item.unit}</TableCell>
                                <TableCell>
                                  {item.shortage > 0 ? (
                                    <Badge variant="destructive">{item.shortage} {item.unit}</Badge>
                                  ) : (
                                    <Badge variant="secondary">In Stock</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                  {item.kits.join(", ")}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}