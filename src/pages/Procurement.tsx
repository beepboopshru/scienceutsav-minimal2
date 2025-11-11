import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { Download, Calendar, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Procurement() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const programs = useQuery(api.programs.list);
  const assignments = useQuery(api.assignments.list);
  const inventory = useQuery(api.inventory.list);
  
  const [selectedProgramId, setSelectedProgramId] = useState<Id<"programs"> | null>(
    searchParams.get("programId") as Id<"programs"> | null
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    searchParams.get("month") || new Date().toISOString().slice(0, 7)
  );
  const [procurementScope, setProcurementScope] = useState<"month" | "total">(
    (searchParams.get("scope") as "month" | "total") || "month"
  );
  const [showCompleteList, setShowCompleteList] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
    if (!isLoading && isAuthenticated && user && user.role && !["admin", "manager", "operations", "inventory"].includes(user.role)) {
      toast.error("Access denied: Procurement access requires admin, manager, operations, or inventory role");
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Update URL params when selections change
  useEffect(() => {
    if (selectedProgramId) {
      searchParams.set("programId", selectedProgramId);
      searchParams.set("month", selectedMonth);
      searchParams.set("scope", procurementScope);
      setSearchParams(searchParams);
    }
  }, [selectedProgramId, selectedMonth, procurementScope]);

  if (isLoading || !programs || !assignments || !inventory) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

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

  // Filter by selected month for month-wise view
  const monthAssignments = procurementScope === "month" 
    ? programAssignments.filter((a) => {
        const assignmentDate = new Date(a._creationTime).toISOString().slice(0, 7);
        return assignmentDate === selectedMonth;
      })
    : programAssignments;

  // Calculate material shortages for an assignment
  const calculateShortages = (assignment: any) => {
    const kit = assignment.kit;
    if (!kit || !inventory) return { direct: [], packets: [] };

    const shortages: any = { direct: [], packets: [] };
    const requiredQty = assignment.quantity;

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

  // Generate complete procurement list across all programs
  const generateCompleteProcurementList = () => {
    const materialMap = new Map<string, any>();

    assignments?.forEach((assignment) => {
      const kit = assignment.kit;
      if (!kit || !inventory) return;

      const requiredQty = assignment.quantity;

      // Process structured packing requirements
      if (kit.isStructured && kit.packingRequirements) {
        const structure = parsePackingRequirements(kit.packingRequirements);
        const totalMaterials = calculateTotalMaterials(structure);
        
        totalMaterials.forEach((material) => {
          const required = material.quantity * requiredQty;
          const key = material.name.toLowerCase();
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            existing.programs.add(assignment.program?.name || "Unknown");
            existing.kits.add(kit.name);
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === key);
            materialMap.set(key, {
              name: material.name,
              required,
              available: invItem?.quantity || 0,
              unit: material.unit,
              category: "Main Component",
              programs: new Set([assignment.program?.name || "Unknown"]),
              kits: new Set([kit.name]),
            });
          }
        });
      }

      // Process spare kits
      if (kit.spareKits) {
        kit.spareKits.forEach((spare: any) => {
          const required = spare.quantity * requiredQty;
          const key = spare.name.toLowerCase();
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            existing.programs.add(assignment.program?.name || "Unknown");
            existing.kits.add(kit.name);
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === key);
            materialMap.set(key, {
              name: spare.name,
              required,
              available: invItem?.quantity || 0,
              unit: spare.unit,
              category: "Spare Kit",
              programs: new Set([assignment.program?.name || "Unknown"]),
              kits: new Set([kit.name]),
            });
          }
        });
      }

      // Process bulk materials
      if (kit.bulkMaterials) {
        kit.bulkMaterials.forEach((bulk: any) => {
          const required = bulk.quantity * requiredQty;
          const key = bulk.name.toLowerCase();
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            existing.programs.add(assignment.program?.name || "Unknown");
            existing.kits.add(kit.name);
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === key);
            materialMap.set(key, {
              name: bulk.name,
              required,
              available: invItem?.quantity || 0,
              unit: bulk.unit,
              category: "Bulk Material",
              programs: new Set([assignment.program?.name || "Unknown"]),
              kits: new Set([kit.name]),
            });
          }
        });
      }

      // Process miscellaneous
      if (kit.miscellaneous) {
        kit.miscellaneous.forEach((misc: any) => {
          const required = misc.quantity * requiredQty;
          const key = misc.name.toLowerCase();
          
          if (materialMap.has(key)) {
            const existing = materialMap.get(key);
            existing.required += required;
            existing.programs.add(assignment.program?.name || "Unknown");
            existing.kits.add(kit.name);
          } else {
            const invItem = inventory.find((i) => i.name.toLowerCase() === key);
            materialMap.set(key, {
              name: misc.name,
              required,
              available: invItem?.quantity || 0,
              unit: misc.unit,
              category: "Miscellaneous",
              programs: new Set([assignment.program?.name || "Unknown"]),
              kits: new Set([kit.name]),
            });
          }
        });
      }
    });

    return Array.from(materialMap.values()).map((item) => ({
      ...item,
      shortage: Math.max(0, item.required - item.available),
      programs: Array.from(item.programs),
      kits: Array.from(item.kits),
    }));
  };

  const completeProcurementList = showCompleteList ? generateCompleteProcurementList() : [];

  // Generate procurement list with proper shortage calculation
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
          existing.kits.add(assignment.kit?.name || "Unknown");
        } else {
          materialMap.set(key, {
            name: item.name,
            required: item.required,
            available: item.available,
            shortage: 0,
            unit: item.unit,
            category: item.category || "Main Component",
            kits: new Set([assignment.kit?.name || "Unknown"]),
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

  // Generate kit-wise procurement breakdown
  const generateKitWiseProcurement = () => {
    const relevantAssignments = procurementScope === "month" ? monthAssignments : programAssignments;
    const kitMap = new Map<string, any>();

    relevantAssignments.forEach((assignment) => {
      const kitName = assignment.kit?.name || "Unknown";
      const shortages = calculateShortages(assignment);
      
      if (!kitMap.has(kitName)) {
        kitMap.set(kitName, {
          kitName,
          category: assignment.kit?.category || "-",
          totalQuantity: 0,
          materials: new Map<string, any>(),
        });
      }

      const kitData = kitMap.get(kitName)!;
      kitData.totalQuantity += assignment.quantity;

      shortages.direct.forEach((item: any) => {
        const key = item.name.toLowerCase();
        if (kitData.materials.has(key)) {
          const existing = kitData.materials.get(key);
          existing.required += item.required;
        } else {
          kitData.materials.set(key, {
            name: item.name,
            required: item.required,
            available: item.available,
            unit: item.unit,
            category: item.category || "Main Component",
          });
        }
      });
    });

    return Array.from(kitMap.values()).map((kit: any) => ({
      kitName: kit.kitName,
      category: kit.category,
      totalQuantity: kit.totalQuantity,
      materials: Array.from(kit.materials.values()).map((mat: any) => ({
        name: mat.name,
        required: mat.required,
        available: mat.available,
        unit: mat.unit,
        category: mat.category,
        shortage: Math.max(0, mat.required - mat.available),
      })),
    }));
  };

  const procurementList = selectedProgramId ? generateProcurementList() : [];
  const kitWiseProcurement = selectedProgramId ? generateKitWiseProcurement() : [];

  const selectedProgram = programs?.find((p) => p._id === selectedProgramId);

  // Export Complete Procurement List to PDF
  const exportCompleteProcurementToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Complete Procurement List", 14, 20);
    
    doc.setFontSize(11);
    doc.text("Material requirements across all programs", 14, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 37);
    
    doc.setFontSize(14);
    doc.text("All Materials Summary", 14, 47);
    
    const summaryData = completeProcurementList.map((item) => [
      item.name,
      item.category,
      `${item.required} ${item.unit}`,
      `${item.available} ${item.unit}`,
      item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock",
      item.programs.join(", "),
      item.kits.join(", "),
    ]);
    
    autoTable(doc, {
      head: [["Material", "Category", "Required", "Available", "Shortage", "Programs", "Kits"]],
      body: summaryData,
      startY: 53,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 40 },
        6: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.text(`Total Unique Materials: ${completeProcurementList.length}`, 14, currentY);
    doc.text(`Materials with Shortage: ${completeProcurementList.filter(item => item.shortage > 0).length}`, 14, currentY + 7);
    doc.text(`Total Programs: ${programs?.length || 0}`, 14, currentY + 14);
    
    const fileName = `complete-procurement-list-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    toast.success("Complete procurement list exported as PDF");
  };

  // Export to PDF
  const exportToPDF = () => {
    if (!selectedProgram) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Procurement List", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Program: ${selectedProgram.name}`, 14, 30);
    doc.text(`Scope: ${procurementScope === "month" ? `Monthwise - ${monthOptions.find((m) => m.value === selectedMonth)?.label}` : "All Assignments"}`, 14, 37);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 44);
    
    doc.setFontSize(14);
    doc.text("Material Summary", 14, 54);
    
    const summaryData = procurementList.map((item) => [
      item.name,
      item.category,
      `${item.required} ${item.unit}`,
      `${item.available} ${item.unit}`,
      item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock",
      item.kits.join(", "),
    ]);
    
    autoTable(doc, {
      head: [["Material", "Category", "Required", "Available", "Shortage", "Used In Kits"]],
      body: summaryData,
      startY: 60,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 52 },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(14);
    doc.text("Kit-wise Breakdown", 14, currentY);
    currentY += 8;
    
    kitWiseProcurement.forEach((kit) => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(11);
      doc.text(`${kit.kitName} (${kit.category}) - ${kit.totalQuantity} units`, 14, currentY);
      currentY += 2;
      
      const kitData = kit.materials.map((mat: any) => [
        mat.name,
        mat.category,
        `${mat.required} ${mat.unit}`,
        `${mat.available} ${mat.unit}`,
        mat.shortage > 0 ? `${mat.shortage} ${mat.unit}` : "In Stock",
      ]);
      
      autoTable(doc, {
        head: [["Material", "Category", "Required", "Available", "Shortage"]],
        body: kitData,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 35 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
        },
        didParseCell: (data) => {
          if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });
    
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.text(`Total Unique Materials: ${procurementList.length}`, 14, currentY);
    doc.text(`Materials with Shortage: ${procurementList.filter(item => item.shortage > 0).length}`, 14, currentY + 7);
    doc.text(`Total Kits: ${kitWiseProcurement.length}`, 14, currentY + 14);
    
    const fileName = `procurement-list-${selectedProgram.name.replace(/\s+/g, "-")}-${procurementScope === "month" ? selectedMonth : "all"}.pdf`;
    doc.save(fileName);
    toast.success("Procurement list exported as PDF");
  };

  // Program Selection View
  if (!selectedProgramId && !showCompleteList) {
    return (
      <Layout>
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Procurement Lists</h1>
                <p className="text-muted-foreground mt-2">
                  Select a program to view material procurement requirements
                </p>
              </div>
              <Button onClick={() => setShowCompleteList(true)} variant="default">
                <Package className="mr-2 h-4 w-4" />
                Complete Procurement List
              </Button>
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

  // Complete Procurement List View
  if (showCompleteList) {
    return (
      <Layout>
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Complete Procurement List
                </h1>
                <p className="text-muted-foreground mt-2">
                  Material requirements across all programs
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={exportCompleteProcurementToPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={() => setShowCompleteList(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Programs
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">All Materials Summary</h3>
              <p className="text-sm text-muted-foreground">
                Aggregated material requirements across all programs and assignments
              </p>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Shortage</TableHead>
                        <TableHead>Used In Programs</TableHead>
                        <TableHead>Used In Kits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completeProcurementList.map((item, idx) => (
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
                            {item.programs.join(", ")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.kits.join(", ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // Procurement List View
  return (
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Procurement List - {selectedProgram?.name}
              </h1>
              <p className="text-muted-foreground mt-2">
                Material requirements and shortages
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setSelectedProgramId(null)}>
                Change Program
              </Button>
              <Button onClick={exportToPDF}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Select value={procurementScope} onValueChange={(v: any) => setProcurementScope(v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthwise</SelectItem>
                <SelectItem value="total">All Assignments</SelectItem>
              </SelectContent>
            </Select>
            {procurementScope === "month" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.length > 0 ? (
                    monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-data" disabled>
                      No months available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Material Summary */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Material Summary</h3>
            <p className="text-sm text-muted-foreground">
              Aggregated material requirements across all kits
            </p>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Shortage</TableHead>
                      <TableHead>Used In Kits</TableHead>
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
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Kit-wise Breakdown */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Kit-wise Breakdown</h3>
            <p className="text-sm text-muted-foreground">
              Material requirements organized by kit
            </p>
            {kitWiseProcurement.map((kit, kitIdx) => (
              <Card key={kitIdx}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{kit.kitName}</CardTitle>
                      <CardDescription>
                        {kit.category} • {kit.totalQuantity} units
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
                      {kit.materials.map((mat: any, matIdx: number) => (
                        <TableRow key={matIdx}>
                          <TableCell className="font-medium">{mat.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{mat.category}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {mat.required} {mat.unit}
                          </TableCell>
                          <TableCell className="text-sm">
                            {mat.available} {mat.unit}
                          </TableCell>
                          <TableCell>
                            {mat.shortage > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {mat.shortage} {mat.unit}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">In Stock</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}