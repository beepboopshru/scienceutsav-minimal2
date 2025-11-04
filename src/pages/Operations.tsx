import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { 
  Loader2, 
  ArrowLeft,
  Calendar,
  Package,
  AlertTriangle,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Operations() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const programs = useQuery(api.programs.list);
  const assignments = useQuery(api.assignments.list);
  const inventory = useQuery(api.inventory.list);
  
  const [selectedProgramId, setSelectedProgramId] = useState<Id<"programs"> | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "kit">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false);
  const [procurementDialogOpen, setProcurementDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedKitShortage, setSelectedKitShortage] = useState<any>(null);
  const [kitShortageDialogOpen, setKitShortageDialogOpen] = useState(false);
  const [procurementScope, setProcurementScope] = useState<"month" | "total">("month");

  // Fetch kit-wise shortages when a program is selected
  const kitWiseShortages = useQuery(
    api.operations.calculateKitWiseShortages,
    selectedProgramId ? { programId: selectedProgramId } : "skip"
  );

  // Auto-select the most recent month if current selection is not in the list
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
    if (!isLoading && isAuthenticated && user && user.role && !["admin", "manager", "operations"].includes(user.role)) {
      toast.error("Access denied: Operations role required");
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Filter assignments by selected program
  const programAssignments = selectedProgramId && assignments
    ? assignments.filter((a) => a.kit?.programId === selectedProgramId)
    : [];

  // Generate month options based on actual assignments
  const generateMonthOptions = () => {
    if (!selectedProgramId) return [];
    
    const monthSet = new Set<string>();
    programAssignments.forEach((assignment) => {
      const monthValue = new Date(assignment._creationTime).toISOString().slice(0, 7);
      monthSet.add(monthValue);
    });

    const options = Array.from(monthSet)
      .sort()
      .map((value) => {
        const date = new Date(value + "-01");
        const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        return { value, label };
      });

    return options;
  };

  const monthOptions = generateMonthOptions();

  // Auto-select the most recent month when program changes
  useEffect(() => {
    if (selectedProgramId && monthOptions.length > 0) {
      const currentMonthExists = monthOptions.some((opt: any) => opt.value === selectedMonth);
      if (!currentMonthExists) {
        setSelectedMonth(monthOptions[monthOptions.length - 1].value);
      }
    }
  }, [selectedProgramId, monthOptions.length, selectedMonth]);

  // Filter by selected month for month-wise view
  const monthAssignments = programAssignments.filter((a) => {
    const assignmentDate = new Date(a._creationTime).toISOString().slice(0, 7);
    return assignmentDate === selectedMonth;
  });

  // Aggregate by kit for kit-wise view
  const kitAggregation = programAssignments.reduce((acc, assignment) => {
    const kitId = assignment.kitId;
    if (!acc[kitId]) {
      acc[kitId] = {
        kit: assignment.kit,
        totalQuantity: 0,
        pendingQuantity: 0,
        dispatchedQuantity: 0,
      };
    }
    acc[kitId].totalQuantity += assignment.quantity;
    if (assignment.status === "dispatched") {
      acc[kitId].dispatchedQuantity += assignment.quantity;
    } else {
      acc[kitId].pendingQuantity += assignment.quantity;
    }
    return acc;
  }, {} as Record<string, any>);

  const kitAggregationArray = Object.values(kitAggregation);

  // Calculate material shortages for an assignment
  const calculateShortages = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !inventory) return { direct: [], packets: [] };

    const shortages: any = { direct: [], packets: [] };
    const requiredQty = assignment.quantity;

    // Direct components from packing structure
    if (kit.isStructured && kit.packingRequirements) {
      const structure = parsePackingRequirements(kit.packingRequirements);
      const totalMaterials = calculateTotalMaterials(structure);
      
      totalMaterials.forEach((material) => {
        const required = material.quantity * requiredQty;
        const invItem = inventory.find((i) => i.name.toLowerCase() === material.name.toLowerCase());
        const available = invItem?.quantity || 0;
        const shortage = Math.max(0, required - available);
        
        if (shortage > 0 || required > 0) {
          shortages.direct.push({
            name: material.name,
            required,
            available,
            shortage,
            unit: material.unit,
          });
        }
      });
    }

    // Spare kits
    if (kit.spareKits) {
      kit.spareKits.forEach((spare: any) => {
        const required = spare.quantity * requiredQty;
        const invItem = inventory.find((i) => i.name.toLowerCase() === spare.name.toLowerCase());
        const available = invItem?.quantity || 0;
        const shortage = Math.max(0, required - available);
        
        if (shortage > 0 || required > 0) {
          shortages.direct.push({
            name: spare.name,
            required,
            available,
            shortage,
            unit: spare.unit,
            category: "Spare Kit",
          });
        }
      });
    }

    // Bulk materials
    if (kit.bulkMaterials) {
      kit.bulkMaterials.forEach((bulk: any) => {
        const required = bulk.quantity * requiredQty;
        const invItem = inventory.find((i) => i.name.toLowerCase() === bulk.name.toLowerCase());
        const available = invItem?.quantity || 0;
        const shortage = Math.max(0, required - available);
        
        if (shortage > 0 || required > 0) {
          shortages.direct.push({
            name: bulk.name,
            required,
            available,
            shortage,
            unit: bulk.unit,
            category: "Bulk Material",
          });
        }
      });
    }

    // Miscellaneous
    if (kit.miscellaneous) {
      kit.miscellaneous.forEach((misc: any) => {
        const required = misc.quantity * requiredQty;
        const invItem = inventory.find((i) => i.name.toLowerCase() === misc.name.toLowerCase());
        const available = invItem?.quantity || 0;
        const shortage = Math.max(0, required - available);
        
        if (shortage > 0 || required > 0) {
          shortages.direct.push({
            name: misc.name,
            required,
            available,
            shortage,
            unit: misc.unit,
            category: "Miscellaneous",
          });
        }
      });
    }

    return shortages;
  };

  // Generate procurement list
  const generateProcurementList = () => {
    const relevantAssignments = procurementScope === "month" ? monthAssignments : programAssignments;
    const materialMap = new Map<string, any>();

    relevantAssignments.forEach((assignment) => {
      const shortages = calculateShortages(assignment);
      
      shortages.direct.forEach((item: any) => {
        const key = item.name.toLowerCase();
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.required += item.required;
          existing.shortage += item.shortage;
          existing.kits.add(assignment.kit?.name || "Unknown");
        } else {
          materialMap.set(key, {
            name: item.name,
            required: item.required,
            available: item.available,
            shortage: item.shortage,
            unit: item.unit,
            category: item.category || "Main Component",
            kits: new Set([assignment.kit?.name || "Unknown"]),
          });
        }
      });
    });

    return Array.from(materialMap.values()).map((item) => ({
      ...item,
      kits: Array.from(item.kits),
    }));
  };

  const procurementList = procurementDialogOpen ? generateProcurementList() : [];

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text("Procurement List", 14, 20);
    
    // Add program and scope info
    doc.setFontSize(11);
    doc.text(`Program: ${selectedProgram?.name || "Unknown"}`, 14, 30);
    doc.text(`Scope: ${procurementScope === "month" ? `Month - ${monthOptions.find((m) => m.value === selectedMonth)?.label}` : "All Assignments"}`, 14, 37);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 44);
    
    // Prepare table data
    const tableData = procurementList.map((item) => [
      item.name,
      item.category,
      `${item.required} ${item.unit}`,
      `${item.available} ${item.unit}`,
      item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock",
      item.kits.join(", "),
    ]);
    
    // Add table
    autoTable(doc, {
      head: [["Material", "Category", "Required", "Available", "Shortage", "Used In Kits"]],
      body: tableData,
      startY: 50,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 55 },
      },
      didParseCell: (data) => {
        // Highlight shortage cells in red if there's a shortage
        if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    
    // Add summary at the bottom
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(10);
    doc.text(`Total Materials: ${procurementList.length}`, 14, finalY + 10);
    doc.text(`Materials with Shortage: ${procurementList.filter(item => item.shortage > 0).length}`, 14, finalY + 17);
    
    // Save the PDF
    const fileName = `procurement-list-${selectedProgram?.name.replace(/\s+/g, "-")}-${procurementScope === "month" ? selectedMonth : "all"}.pdf`;
    doc.save(fileName);
    toast.success("Procurement list exported as PDF");
  };

  // Program Selection View
  if (!selectedProgramId) {
    return (
      <Layout>
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Operations Hub</h1>
              <p className="text-muted-foreground mt-2">
                Select a program to view assignments and manage procurement
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs?.map((program) => (
                <motion.div
                  key={program._id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedProgramId(program._id)}
                  >
                    <CardHeader>
                      <CardTitle>{program.name}</CardTitle>
                      <CardDescription>
                        {program.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>
                          {assignments?.filter((a) => a.kit?.programId === program._id).length || 0} assignments
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const selectedProgram = programs?.find((p) => p._id === selectedProgramId);

  // Kit Operations View
  return (
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedProgramId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {selectedProgram?.name} Operations
                </h1>
                <p className="text-muted-foreground mt-2">
                  Track assignments and manage material procurement
                </p>
              </div>
            </div>
            <Button onClick={() => setProcurementDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Procurement List
            </Button>
          </div>

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="month">Month-wise View</TabsTrigger>
                <TabsTrigger value="kit">Kit-wise View</TabsTrigger>
              </TabsList>
              <div className={viewMode === "month" ? "" : "invisible"}>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px]">
                    <Calendar className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Month-wise View */}
            <TabsContent value="month" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Assignments for {monthOptions.find((m) => m.value === selectedMonth)?.label}
                  </CardTitle>
                  <CardDescription>
                    {monthAssignments.length} assignments in this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kit Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Dispatch Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthAssignments.map((assignment) => (
                        <TableRow key={assignment._id}>
                          <TableCell className="font-medium">
                            {assignment.kit?.name || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {assignment.kit?.category || "-"}
                          </TableCell>
                          <TableCell>
                            {assignment.client?.name || "Unknown"}
                          </TableCell>
                          <TableCell>{assignment.quantity}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                assignment.status === "dispatched"
                                  ? "default"
                                  : assignment.status === "packed"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {assignment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.dispatchedAt
                              ? new Date(assignment.dispatchedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setShortageDialogOpen(true);
                              }}
                            >
                              Shortage
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Kit-wise View */}
            <TabsContent value="kit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Kit Aggregation</CardTitle>
                  <CardDescription>
                    Total demand across all time periods
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kit Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Total Quantity</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Dispatched</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kitWiseShortages?.map((item: any) => {
                        const hasShortages = item.materialShortages.some((m: any) => m.shortage > 0);
                        return (
                          <TableRow key={item.kitId}>
                            <TableCell className="font-medium">
                              {item.kitName}
                            </TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.totalQuantity}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.pendingQuantity}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.dispatchedQuantity}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={hasShortages ? "destructive" : "outline"}
                                onClick={() => {
                                  setSelectedKitShortage(item);
                                  setKitShortageDialogOpen(true);
                                }}
                              >
                                {hasShortages ? (
                                  <>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Shortage
                                  </>
                                ) : (
                                  "View Materials"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Shortage Dialog */}
          <Dialog open={shortageDialogOpen} onOpenChange={setShortageDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Material Shortage Analysis</DialogTitle>
                <DialogDescription>
                  {selectedAssignment?.kit?.name} - {selectedAssignment?.quantity} units for{" "}
                  {selectedAssignment?.client?.name}
                </DialogDescription>
              </DialogHeader>
              {selectedAssignment && (
                <div className="space-y-4">
                  {(() => {
                    const shortages = calculateShortages(selectedAssignment);
                    const hasShortages = shortages.direct.some((s: any) => s.shortage > 0);

                    return (
                      <>
                        {!hasShortages && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>All materials are in stock</p>
                          </div>
                        )}
                        {shortages.direct.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="font-semibold">Direct Components</h3>
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
                                {shortages.direct.map((item: any, idx: number) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{item.category || "Main"}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {item.required} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                      {item.available} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                      {item.shortage > 0 ? (
                                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                          <AlertTriangle className="h-3 w-3" />
                                          {item.shortage} {item.unit}
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary">In Stock</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Kit-wise Shortage Dialog */}
          <Dialog open={kitShortageDialogOpen} onOpenChange={setKitShortageDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Material Requirements - {selectedKitShortage?.kitName}</DialogTitle>
                <DialogDescription>
                  Total requirements across {selectedKitShortage?.totalQuantity} units ({selectedKitShortage?.pendingQuantity} pending, {selectedKitShortage?.dispatchedQuantity} dispatched)
                </DialogDescription>
              </DialogHeader>
              {selectedKitShortage && (
                <div className="space-y-4">
                  {selectedKitShortage.materialShortages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No materials defined for this kit</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Total Required</TableHead>
                          <TableHead>Available</TableHead>
                          <TableHead>Shortage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedKitShortage.materialShortages.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              {item.totalRequired} {item.unit}
                            </TableCell>
                            <TableCell>
                              {item.available} {item.unit}
                            </TableCell>
                            <TableCell>
                              {item.shortage > 0 ? (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <AlertTriangle className="h-3 w-3" />
                                  {item.shortage} {item.unit}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">In Stock</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Procurement List Dialog */}
          <Dialog open={procurementDialogOpen} onOpenChange={setProcurementDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Procurement List</DialogTitle>
                <DialogDescription>
                  Materials needed for {selectedProgram?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Select value={procurementScope} onValueChange={(v: any) => setProcurementScope(v)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">This Month Only</SelectItem>
                      <SelectItem value="total">All Assignments</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={exportToPDF}>
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
                <Separator />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Shortage</TableHead>
                      <TableHead>Used In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procurementList.map((item, idx) => (
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
                          {item.shortage > 0 ? (
                            <Badge variant="destructive">
                              {item.shortage} {item.unit}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In Stock</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.kits.join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </Layout>
  );
}