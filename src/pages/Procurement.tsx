import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Download, Package, Calendar, Users, Layers, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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

  const rawKitWiseData = generateKitWiseData();
  const rawMonthWiseData = generateMonthWiseData();
  const rawClientWiseData = generateClientWiseData();

  // --- Filtering ---

  const filterData = (data: any[], type: "kit" | "month" | "client") => {
    if (!searchTerm && !showShortagesOnly) return data;

    return data.map(item => {
      const itemName = item.name || item.month || item.clientName || "";
      const itemMatchesSearch = itemName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const filteredMaterials = item.materials.filter((m: any) => {
        const materialMatchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                      m.category.toLowerCase().includes(searchTerm.toLowerCase());
        
        // If parent matches, show all materials (unless shortage filter applies)
        // If parent doesn't match, only show matching materials
        const isRelevant = itemMatchesSearch || materialMatchesSearch;
        const isShortage = m.shortage > 0;
        
        return isRelevant && (!showShortagesOnly || isShortage);
      });

      if (filteredMaterials.length > 0) {
        return { ...item, materials: filteredMaterials };
      }
      return null;
    }).filter(Boolean);
  };

  const filterSummary = (data: any[]) => {
    return data.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesShortage = !showShortagesOnly || item.shortage > 0;
      return matchesSearch && matchesShortage;
    });
  };

  const kitWiseData = filterData(rawKitWiseData, "kit");
  const monthWiseData = filterData(rawMonthWiseData, "month");
  const clientWiseData = filterData(rawClientWiseData, "client");
  const filteredMaterialSummary = filterSummary(materialSummary);

  // --- Export Functions ---

  const exportProcurementListPDF = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleDateString();
    
    let title = "";
    let dataToExport: any[] = [];

    if (activeTab === "kit-wise") {
      title = "Kit Wise Procurement List";
      dataToExport = kitWiseData;
    } else if (activeTab === "month-wise") {
      title = "Month Wise Procurement List";
      dataToExport = monthWiseData;
    } else if (activeTab === "client-wise") {
      title = "Client Wise Procurement List";
      dataToExport = clientWiseData;
    } else {
      title = "Material Summary Procurement List";
      dataToExport = filteredMaterialSummary;
    }

    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated: ${timestamp}`, 14, 28);
    if (searchTerm || showShortagesOnly) {
      doc.setFontSize(10);
      doc.text(`Filters: ${searchTerm ? `Search: "${searchTerm}"` : ""} ${showShortagesOnly ? "[Shortages Only]" : ""}`, 14, 34);
    }

    let finalY = 40;

    if (activeTab === "summary") {
      const columns = ["Material", "Category", "Required", "Available", "Shortage", "Used In"];
      const rows = filteredMaterialSummary.map((item) => [
        item.name,
        item.category,
        `${item.required} ${item.unit}`,
        `${item.available} ${item.unit}`,
        item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock",
        item.kits.join(", ").substring(0, 30) + (item.kits.join(", ").length > 30 ? "..." : ""),
      ]);
      
      autoTable(doc, {
        head: [columns],
        body: rows,
        startY: finalY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
        didParseCell: (data) => {
          if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    } else {
      // Grouped Views (Kit, Month, Client)
      dataToExport.forEach((group) => {
        if (finalY > 250) {
          doc.addPage();
          finalY = 20;
        }

        let groupName = group.name || group.month || group.clientName;
        if (activeTab === "month-wise" && group.month) {
             try {
                groupName = new Date(group.month + "-01").toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
             } catch (e) {}
        }

        let subInfo = "";
        if (activeTab === "kit-wise") subInfo = `Total Assigned: ${group.totalQuantity}`;
        else if (activeTab === "month-wise") subInfo = `Assignments: ${group.totalAssignments}`;
        else if (activeTab === "client-wise") subInfo = `Total Kits: ${group.totalKits}`;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(groupName, 14, finalY);
        
        if (subInfo) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(subInfo, 14, finalY + 5);
            finalY += 10;
        } else {
            finalY += 6;
        }

        const columns = ["Material", "Category", "Required", "Available", "Shortage"];
        const rows = group.materials.map((m: any) => [
          m.name,
          m.category,
          `${m.required} ${m.unit}`,
          `${m.available} ${m.unit}`,
          m.shortage > 0 ? `${m.shortage} ${m.unit}` : "In Stock"
        ]);

        if (rows.length > 0) {
            autoTable(doc, {
                startY: finalY,
                head: [columns],
                body: rows,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [71, 85, 105] },
                margin: { left: 14 },
                didParseCell: (data) => {
                if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = "bold";
                }
                },
            });
            finalY = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            doc.text("No materials required.", 14, finalY);
            finalY += 10;
        }
      });
    }

    doc.save(`procurement-${activeTab}.pdf`);
    toast.success(`Exported ${title}`);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
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

        <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
          <div className="flex-1 w-full md:max-w-sm">
            <Label className="mb-2 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search kits, clients, materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pb-2">
            <Switch
              id="shortages-mode"
              checked={showShortagesOnly}
              onCheckedChange={setShowShortagesOnly}
            />
            <Label htmlFor="shortages-mode">Show Shortages Only</Label>
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
                  {kitWiseData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data found matching your filters.</div>
                  ) : (
                    kitWiseData.map((kit, idx) => (
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
                  {monthWiseData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data found matching your filters.</div>
                  ) : (
                    monthWiseData.map((month, idx) => (
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
                  {clientWiseData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data found matching your filters.</div>
                  ) : (
                    clientWiseData.map((client, idx) => (
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