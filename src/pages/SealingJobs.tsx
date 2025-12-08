import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Package, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SealingRequirements } from "@/components/processing/SealingRequirements";
import { ProcessingJobsList } from "@/components/processing/ProcessingJobsList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { QuickAddInventoryDialog } from "@/components/research/QuickAddInventoryDialog";
import { parsePackingRequirements } from "@/lib/kitPacking";

export default function SealingJobs() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  
  const canView = hasPermission("processingJobs", "view");
  const canEdit = hasPermission("processingJobs", "edit");
  
  const assignments = useQuery(api.assignments.list, {});
  const inventory = useQuery(api.inventory.list);
  const processingJobs = useQuery(api.processingJobs.list);
  const vendors = useQuery(api.vendors.list);
  const services = useQuery(api.services.list);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);
  
  const [viewMode, setViewMode] = useState<"requirements" | "jobs">("requirements");
  const [generateJobsOpen, setGenerateJobsOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allRequirements, setAllRequirements] = useState<any[]>([]);

  const createProcessingJob = useMutation(api.processingJobs.create);
  const startJob = useMutation(api.processingJobs.startJob);
  const completeJob = useMutation(api.processingJobs.complete);
  const cancelJob = useMutation(api.processingJobs.cancel);
  const deleteJob = useMutation(api.processingJobs.remove);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

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

  if (!canView) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading || !user || !assignments || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const handleGenerateJobs = () => {
    // Collect all requirements with shortages from the SealingRequirements component
    // This will be populated when the component calculates requirements
    setGenerateJobsOpen(true);
  };

  const handleCreateItem = (name: string) => {
    setNewItemName(name);
    setCreateItemOpen(true);
  };

  const handleBatchCreateJobs = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to create jobs for");
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const itemId of selectedItems) {
        const requirement = allRequirements.find(r => r.id === itemId);
        if (!requirement) continue;

        // Skip missing items
        if (typeof requirement.id === 'string' && requirement.id.startsWith('missing_')) {
          failCount++;
          continue;
        }

        const targetItem = inventory.find(i => i._id === requirement.id);
        if (!targetItem || !requirement.components || requirement.components.length === 0) {
          failCount++;
          continue;
        }

        const sources = requirement.components.map((comp: any) => ({
          sourceItemId: comp.inventoryId,
          sourceQuantity: comp.totalRequired,
        }));

        // Validate stock
        let hasStock = true;
        for (const source of sources) {
          const sourceItem = inventory.find(i => i._id === source.sourceItemId);
          if (!sourceItem || sourceItem.quantity < source.sourceQuantity) {
            hasStock = false;
            break;
          }
        }

        if (!hasStock) {
          failCount++;
          continue;
        }

        await createProcessingJob({
          name: `Seal ${targetItem.name} - ${requirement.shortage} units`,
          sources,
          targets: [{
            targetItemId: requirement.id,
            targetQuantity: requirement.shortage,
          }],
          processedByType: "in_house",
        });

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} sealing job(s)`);
      }
      if (failCount > 0) {
        toast.warning(`Failed to create ${failCount} job(s) due to missing items or insufficient stock`);
      }

      setGenerateJobsOpen(false);
      setSelectedItems(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to create sealing jobs");
    }
  };

  const handleStartJob = async (id: Id<"processingJobs">) => {
    try {
      await startJob({ id });
      toast.success("Job started successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to start job");
    }
  };

  const handleCompleteJob = async (id: Id<"processingJobs">) => {
    try {
      await completeJob({ id });
      toast.success("Job completed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete job");
    }
  };

  const handleCancelJob = async (id: Id<"processingJobs">, status: string) => {
    try {
      await cancelJob({ id });
      toast.success("Job cancelled successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel job");
    }
  };

  const handleDeleteJob = async (id: Id<"processingJobs">) => {
    try {
      await deleteJob({ id });
      toast.success("Job deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete job");
    }
  };

  // Filter processing jobs to show only sealed packet jobs
  const sealingJobs = processingJobs?.filter(job => {
    return job.targets.some(target => {
      const item = inventory.find(i => i._id === target.targetItemId);
      return item?.type === "sealed_packet";
    });
  }) || [];

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
              <h1 className="text-3xl font-bold tracking-tight">Sealing Packet Jobs</h1>
              <p className="text-muted-foreground mt-2">
                Track sealed packet requirements and production
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerateJobs} disabled={!canEdit}>
                <Package className="mr-2 h-4 w-4" />
                Generate Jobs
              </Button>
              <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
              <TabsTrigger value="requirements">Requirements & Planning</TabsTrigger>
              <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
            </TabsList>

            <TabsContent value="requirements" className="space-y-4">
              <SealingRequirements 
                assignments={assignments} 
                inventory={inventory} 
                activeJobs={sealingJobs}
                onCreateItem={handleCreateItem}
                refreshTrigger={lastRefresh}
              />
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <ProcessingJobsList 
                jobs={sealingJobs}
                inventory={inventory}
                vendors={vendors || []}
                services={services || []}
                canEdit={canEdit}
                onStartJob={handleStartJob}
                onCompleteJob={handleCompleteJob}
                onCancelJob={handleCancelJob}
                onDeleteJob={handleDeleteJob}
              />
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Wise Sealing Jobs</CardTitle>
                  <CardDescription>
                    Sealing jobs grouped by assignment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Group sealing jobs by assignment
                    const assignmentGroups = new Map<string, {
                      assignment: any;
                      jobs: any[];
                    }>();

                    sealingJobs?.forEach((job) => {
                      if (job.assignmentIds && job.assignmentIds.length > 0) {
                        job.assignmentIds.forEach((assignmentId) => {
                          const assignment = assignments?.find(a => a._id === assignmentId);
                          if (!assignment) return;

                          // Skip completed assignments
                          if (assignment.status === "dispatched" || assignment.status === "delivered") {
                            return;
                          }

                          const key = assignmentId;
                          if (!assignmentGroups.has(key)) {
                            const kit = kits?.find(k => k._id === assignment.kitId);
                            const client = assignment.clientType === "b2b"
                              ? clients?.find(c => c._id === assignment.clientId)
                              : b2cClients?.find(c => c._id === assignment.clientId);
                            
                            assignmentGroups.set(key, {
                              assignment: { ...assignment, kit, client },
                              jobs: [],
                            });
                          }
                          assignmentGroups.get(key)!.jobs.push(job);
                        });
                      }
                    });

                    if (assignmentGroups.size === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No sealing jobs linked to assignments yet.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {Array.from(assignmentGroups.entries()).map(([assignmentId, data]) => {
                          const { assignment, jobs: assignmentJobs } = data;

                          return (
                            <div key={assignmentId} className="border rounded-lg p-4">
                              <div className="mb-4">
                                <h3 className="font-semibold text-lg">
                                  {assignment.kit?.name || "Unknown Kit"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Client: {assignment.client?.name || assignment.client?.buyerName || "Unknown"} • 
                                  Quantity: {assignment.quantity} units • 
                                  Jobs: {assignmentJobs.length}
                                </p>
                              </div>
                              <ProcessingJobsList
                                jobs={assignmentJobs}
                                inventory={inventory}
                                vendors={vendors || []}
                                services={services || []}
                                canEdit={canEdit}
                                onStartJob={handleStartJob}
                                onCompleteJob={handleCompleteJob}
                                onCancelJob={handleCancelJob}
                                onDeleteJob={handleDeleteJob}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Generate Jobs Dialog */}
          <Dialog open={generateJobsOpen} onOpenChange={setGenerateJobsOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Generate Sealing Jobs</DialogTitle>
                <DialogDescription>
                  Select sealed packets to create jobs for. Only items with sufficient stock will be processed.
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {(() => {
                    // Calculate requirements for display
                    const reqs: any[] = [];
                    assignments?.forEach((assignment) => {
                      const kit = assignment.kit;
                      if (!kit || !kit.packingRequirements) return;

                      const structure = parsePackingRequirements(kit.packingRequirements);
                      if (structure.packets) {
                        structure.packets.forEach((packet: any) => {
                          const packetName = packet.name.trim();
                          const foundItem = inventory?.find(i => 
                            i.type === "sealed_packet" && 
                            (i.name.toLowerCase().includes(packetName.toLowerCase()) || 
                             packetName.toLowerCase().includes(i.name.toLowerCase()))
                          );

                          if (foundItem) {
                            const required = assignment.quantity;
                            const available = foundItem.quantity || 0;
                            const shortage = Math.max(0, required - available);

                            if (shortage > 0) {
                              const existing = reqs.find(r => r.id === foundItem._id);
                              if (existing) {
                                existing.shortage += shortage;
                              } else {
                                reqs.push({
                                  id: foundItem._id,
                                  name: foundItem.name,
                                  shortage,
                                  unit: foundItem.unit,
                                  components: foundItem.components || []
                                });
                              }
                            }
                          }
                        });
                      }
                    });

                    // Update allRequirements for batch creation
                    if (reqs.length > 0 && allRequirements.length === 0) {
                      setAllRequirements(reqs);
                    }

                    return reqs.map((req) => {
                      const isSelected = selectedItems.has(req.id);
                      const isMissing = typeof req.id === 'string' && req.id.startsWith('missing_');
                      const hasComponents = req.components && req.components.length > 0;

                      return (
                        <div
                          key={req.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                          } ${isMissing || !hasComponents ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => {
                            if (isMissing || !hasComponents) return;
                            setSelectedItems(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(req.id)) {
                                newSet.delete(req.id);
                              } else {
                                newSet.add(req.id);
                              }
                              return newSet;
                            });
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isMissing || !hasComponents}
                                  onChange={() => {}}
                                  className="h-4 w-4"
                                />
                                <h4 className="font-medium">{req.name}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Shortage: {req.shortage} {req.unit}
                              </p>
                              {isMissing && (
                                <Badge variant="destructive" className="mt-2">Missing from Inventory</Badge>
                              )}
                              {!hasComponents && !isMissing && (
                                <Badge variant="destructive" className="mt-2">No BOM Defined</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setGenerateJobsOpen(false);
                  setSelectedItems(new Set());
                }}>
                  Cancel
                </Button>
                <Button onClick={handleBatchCreateJobs} disabled={selectedItems.size === 0}>
                  <Package className="mr-2 h-4 w-4" />
                  Create {selectedItems.size} Job(s)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Quick Add Inventory Dialog */}
          <QuickAddInventoryDialog
            open={createItemOpen}
            onOpenChange={setCreateItemOpen}
            defaultName={newItemName}
            defaultType="sealed_packet"
            defaultSubcategory="sealed_packet"
            onSuccess={() => {
              setCreateItemOpen(false);
              toast.success("Item created. You can now start the job.");
            }}
          />
        </motion.div>
      </div>
    </Layout>
  );
}