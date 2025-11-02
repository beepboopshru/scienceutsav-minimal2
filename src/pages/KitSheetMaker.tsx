import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Search, Printer, AlertCircle, Package, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { parsePackingRequirements, calculateTotalMaterials } from "@/lib/kitPacking";

export default function KitSheetMaker() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const inventory = useQuery(api.inventory.list);

  const [selectedKitId, setSelectedKitId] = useState<Id<"kits"> | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("all");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !programs || !kits || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const activeKits = kits.filter((k) => k.status !== "archived");
  const activePrograms = programs.filter((p) => p.status !== "archived");

  const filteredKits = activeKits.filter((kit) => {
    const matchesSearch = kit.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram = selectedProgramFilter === "all" || kit.programId === selectedProgramFilter;
    return matchesSearch && matchesProgram;
  });

  const selectedKit = selectedKitId ? kits.find((k) => k._id === selectedKitId) : null;
  const selectedProgram = selectedKit ? programs.find((p) => p._id === selectedKit.programId) : null;

  const calculateTotals = () => {
    if (!selectedKit) return [];

    // If structured, parse packing requirements
    if (selectedKit.isStructured && selectedKit.packingRequirements) {
      const structure = parsePackingRequirements(selectedKit.packingRequirements);
      const materials = calculateTotalMaterials(structure);

      return materials.map((material) => {
        const item = inventory.find((i) => i.name === material.name);
        const totalQty = material.quantity * quantity;
        const hasShortage = item ? item.quantity < totalQty : true;

        return {
          name: material.name,
          unit: material.unit,
          quantityPerKit: material.quantity,
          totalQty,
          hasShortage,
          item,
          notes: material.notes,
        };
      });
    }

    // Legacy: use components array
    if (selectedKit.components) {
      return selectedKit.components.map((comp) => {
        const item = inventory.find((i) => i._id === comp.inventoryItemId);
        const totalQty = comp.quantityPerKit * quantity;
        const hasShortage = item ? item.quantity < totalQty : true;

        return {
          name: item?.name || "Unknown Item",
          unit: comp.unit,
          quantityPerKit: comp.quantityPerKit,
          totalQty,
          hasShortage,
          item,
          notes: comp.wastageNotes || comp.comments,
        };
      });
    }

    return [];
  };

  const totals = calculateTotals();
  const hasAnyShortage = totals.some((t) => t.hasShortage);

  const packingStructure = selectedKit?.isStructured && selectedKit.packingRequirements
    ? parsePackingRequirements(selectedKit.packingRequirements)
    : null;

  const handlePrint = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  return (
    <Layout>
      <div className="p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kit Sheet Maker</h1>
              <p className="text-muted-foreground mt-2">Generate printable packing sheets for kits</p>
            </div>
          </div>

          {/* Selection Section */}
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Kit and Quantity
              </CardTitle>
              <CardDescription>Choose a kit and specify the quantity to pack</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search and Filter */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Search Kits</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by kit name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label>Filter by Program</Label>
                  <Select value={selectedProgramFilter} onValueChange={setSelectedProgramFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {activePrograms.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Kit Selection */}
              <div>
                <Label>Select Kit</Label>
                <Select value={selectedKitId || ""} onValueChange={(value) => setSelectedKitId(value as Id<"kits">)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a kit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredKits.map((kit) => {
                      const program = programs.find((p) => p._id === kit.programId);
                      return (
                        <SelectItem key={kit._id} value={kit._id}>
                          {kit.name} {program && `(${program.name})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity Input */}
              <div>
                <Label>Quantity to Pack</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Enter quantity"
                />
              </div>

              {/* Actions */}
              {selectedKit && (
                <div className="flex gap-2">
                  <Button onClick={handlePrint} className="flex-1">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Sheet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview/Print Section */}
          {selectedKit && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Packing Sheet Preview
                    </CardTitle>
                    <CardDescription>
                      Kit ID: {selectedKit._id} | Generated: {new Date().toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant={hasAnyShortage ? "destructive" : "secondary"}>
                    {hasAnyShortage ? "Stock Shortage" : "Ready to Pack"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Kit Information */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{selectedKit.name}</h3>
                  {selectedProgram && <p className="text-sm text-muted-foreground">Program: {selectedProgram.name}</p>}
                  <p className="text-sm">
                    <strong>Quantity:</strong> {quantity} units
                  </p>
                  {selectedKit.description && (
                    <p className="text-sm text-muted-foreground">{selectedKit.description}</p>
                  )}
                </div>

                <Separator />

                {/* Shortage Alert */}
                {hasAnyShortage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Some items have insufficient stock. Please resolve shortages before packing.
                    </AlertDescription>
                  </Alert>
                )}

                {/* BOM Table - Structured or Legacy */}
                {packingStructure ? (
                  <div className="space-y-6">
                    {/* Pouches */}
                    {packingStructure.pouches.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-4">Pouches</h4>
                        {packingStructure.pouches.map((pouch, pouchIdx) => (
                          <div key={pouchIdx} className="mb-6">
                            <h5 className="font-medium mb-2">{pouch.name}</h5>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead>Unit</TableHead>
                                  <TableHead className="text-right">Per Kit</TableHead>
                                  <TableHead className="text-right">Total Qty</TableHead>
                                  <TableHead className="text-right">Available</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pouch.materials.map((material, matIdx) => {
                                  const item = inventory.find((i) => i.name === material.name);
                                  const totalQty = material.quantity * quantity;
                                  const hasShortage = item ? item.quantity < totalQty : true;
                                  return (
                                    <TableRow key={matIdx} className={hasShortage ? "bg-destructive/10" : ""}>
                                      <TableCell className="font-medium">
                                        {material.name}
                                        {hasShortage && (
                                          <Badge variant="destructive" className="ml-2 text-xs">
                                            Short
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>{material.unit}</TableCell>
                                      <TableCell className="text-right">{material.quantity}</TableCell>
                                      <TableCell className="text-right font-semibold">{totalQty}</TableCell>
                                      <TableCell className="text-right">{item?.quantity || 0}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {material.notes || "-"}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Packets */}
                    {packingStructure.packets.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-4">Packets (Pre-sealed)</h4>
                        {packingStructure.packets.map((packet, packetIdx) => (
                          <div key={packetIdx} className="mb-6">
                            <h5 className="font-medium mb-2">{packet.name}</h5>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead>Unit</TableHead>
                                  <TableHead className="text-right">Per Kit</TableHead>
                                  <TableHead className="text-right">Total Qty</TableHead>
                                  <TableHead className="text-right">Available</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {packet.materials.map((material, matIdx) => {
                                  const item = inventory.find((i) => i.name === material.name);
                                  const totalQty = material.quantity * quantity;
                                  const hasShortage = item ? item.quantity < totalQty : true;
                                  return (
                                    <TableRow key={matIdx} className={hasShortage ? "bg-destructive/10" : ""}>
                                      <TableCell className="font-medium">
                                        {material.name}
                                        {hasShortage && (
                                          <Badge variant="destructive" className="ml-2 text-xs">
                                            Short
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>{material.unit}</TableCell>
                                      <TableCell className="text-right">{material.quantity}</TableCell>
                                      <TableCell className="text-right font-semibold">{totalQty}</TableCell>
                                      <TableCell className="text-right">{item?.quantity || 0}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {material.notes || "-"}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Bill of Materials</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Per Kit</TableHead>
                          <TableHead className="text-right">Total Qty</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {totals.map((total, idx) => (
                          <TableRow key={idx} className={total.hasShortage ? "bg-destructive/10" : ""}>
                            <TableCell className="font-medium">
                              {total.name}
                              {total.hasShortage && (
                                <Badge variant="destructive" className="ml-2 text-xs">
                                  Short
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{total.unit}</TableCell>
                            <TableCell className="text-right">{total.quantityPerKit}</TableCell>
                            <TableCell className="text-right font-semibold">{total.totalQty}</TableCell>
                            <TableCell className="text-right">{total.item?.quantity || 0}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {total.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Spare Kits */}
                {selectedKit.spareKits && selectedKit.spareKits.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Spare Kits</h4>
                      <Table>
                        <TableBody>
                          {selectedKit.spareKits.map((spare, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{spare.name}</TableCell>
                              <TableCell>{spare.unit}</TableCell>
                              <TableCell className="text-right">{spare.quantity * quantity}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{spare.notes || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {/* Bulk Materials */}
                {selectedKit.bulkMaterials && selectedKit.bulkMaterials.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Bulk Materials</h4>
                      <Table>
                        <TableBody>
                          {selectedKit.bulkMaterials.map((bulk, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{bulk.name}</TableCell>
                              <TableCell>{bulk.unit}</TableCell>
                              <TableCell className="text-right">{bulk.quantity * quantity}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{bulk.notes || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {/* Miscellaneous */}
                {selectedKit.miscellaneous && selectedKit.miscellaneous.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Miscellaneous</h4>
                      <Table>
                        <TableBody>
                          {selectedKit.miscellaneous.map((misc, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{misc.name}</TableCell>
                              <TableCell>{misc.unit}</TableCell>
                              <TableCell className="text-right">{misc.quantity * quantity}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{misc.notes || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {/* Assembly Notes */}
                {selectedKit.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-lg font-semibold mb-2">Assembly Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedKit.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!selectedKit && (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Kit Selected</h3>
                <p className="text-muted-foreground">Select a kit and quantity above to generate a packing sheet</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </Layout>
  );
}
