import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, ChevronDown, ChevronRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface RequirementsTableProps {
  items: any[];
  onStartJob: (targetItemId: Id<"inventory"> | string, quantity: number, components: any[]) => void;
  onCreateItem?: (name: string) => void;
}

export function RequirementsTable({ items, onStartJob, onCreateItem }: RequirementsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => {
    setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Sealed Packet Name</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>In Stock</TableHead>
          <TableHead>Deficit/Surplus</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, idx) => {
          const rowKey = `${item.id}_${idx}`;
          const hasComponents = item.components && item.components.length > 0;
          const hasDeficit = item.shortage > 0;
          const hasSurplus = item.surplus > 0;
          const isMissing = typeof item.id === 'string' && item.id.startsWith('missing_');
          
          return (
            <>
              <TableRow key={idx}>
                <TableCell>
                  {hasComponents && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleRow(rowKey)}
                    >
                      {expandedRows[rowKey] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.required} {item.unit}</TableCell>
                <TableCell>
                  <Badge variant={hasDeficit ? "destructive" : "secondary"}>
                    {item.available} {item.unit}
                  </Badge>
                </TableCell>
                <TableCell>
                  {hasDeficit && (
                    <Badge variant="destructive">Deficit: {item.shortage} {item.unit}</Badge>
                  )}
                  {hasSurplus && (
                    <Badge variant="secondary">Surplus: {item.surplus} {item.unit}</Badge>
                  )}
                  {!hasDeficit && !hasSurplus && (
                    <Badge variant="outline">Exact Match</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isMissing ? (
                    onCreateItem && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onCreateItem(item.name)}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Create Item
                      </Button>
                    )
                  ) : (
                    hasDeficit && (
                      <Button 
                        size="sm" 
                        onClick={() => onStartJob(item.id, item.shortage, item.components)}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Start Job
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
              {expandedRows[rowKey] && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50 p-4">
                    <div className="space-y-4">
                      {/* Component Breakdown */}
                      {hasComponents && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Raw Materials Required (from Kit Definition):</p>
                          <div className="grid gap-2">
                            {item.components.map((comp: any, compIdx: number) => {
                              const stockAvailable = comp.inventoryItem?.quantity || 0;
                              const hasEnoughStock = stockAvailable >= comp.totalRequired;
                              
                              return (
                                <div key={compIdx} className="flex items-center justify-between text-sm border rounded p-2">
                                  <span className="font-medium">{comp.name}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground">
                                      Total Needed: {comp.totalRequired} {comp.unit}
                                    </span>
                                    <Badge variant={hasEnoughStock ? "secondary" : "destructive"}>
                                      Stock: {stockAvailable} {comp.unit}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Assignment Details */}
                      {item.assignments && item.assignments.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Assignment Details:</p>
                          <div className="grid gap-2">
                            {item.assignments.map((assignment: any, aIdx: number) => (
                              <div key={aIdx} className="text-sm border rounded p-2 bg-background">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-muted-foreground">Client:</span>{" "}
                                    <span className="font-medium">{assignment.clientName}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Kit:</span>{" "}
                                    <span className="font-medium">{assignment.kitName}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Quantity:</span>{" "}
                                    <span className="font-medium">{assignment.quantity}</span>
                                  </div>
                                  {assignment.productionMonth && (
                                    <div>
                                      <span className="text-muted-foreground">Month:</span>{" "}
                                      <span className="font-medium">{assignment.productionMonth}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}