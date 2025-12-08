import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Package, Plus, RefreshCw, ChevronsUpDown } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  const [sealingJobOpen, setSealingJobOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [sealingPacketComboboxOpen, setSealingPacketComboboxOpen] = useState(false);
  
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [sealingForm, setSealingForm] = useState({
    name: "",
    targetItemId: "" as Id<"inventory">,
    targetQuantity: 1,
    sources: [] as Array<{ sourceItemId: Id<"inventory">; sourceQuantity: number }>,
    processedBy: "",
    processedByType: "in_house" as "vendor" | "service" | "in_house",
    notes: "",
  });

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

  // Filter processing jobs to show only sealed packet jobs
  const sealingJobs = processingJobs?.filter(job => {
    return job.targets.some(target => {
      const item = inventory.find(i => i._id === target.targetItemId);
      return item?.type === "sealed_packet";
    });
  }) || [];

  const handleOpenSealingJobDialog = () => {
    const nextJobNumber = (sealingJobs?.length || 0) + 1;
    setSealingForm(prev => ({ ...prev, name: `Sealing ${nextJobNumber}` }));
    setSealingJobOpen(true);
  };

  const handleCreateItem = (name: string) => {
    setNewItemName(name);
    setCreateItemOpen(true);
  };

  const handleSealingPacketSelection = (itemId: Id<"inventory">) => {
    const selectedItem = inventory?.find((i) => i._id === itemId);
    
    if (selectedItem && selectedItem.components && selectedItem.components.length > 0) {
      const autoFilledSources = selectedItem.components.map((component: any) => ({
        sourceItemId: component.rawMaterialId,
        sourceQuantity: component.quantityRequired * sealingForm.targetQuantity,
      }));
      
      setSealingForm({
        ...sealingForm,
        targetItemId: itemId,
        sources: autoFilledSources,
      });
      toast.success(`Source materials auto-filled from sealed packet BOM (${selectedItem.components.length} items)`);
    } else {
      setSealingForm({
        ...sealingForm,
        targetItemId: itemId,
        sources: [],
      });
      const errorMsg = selectedItem 
        ? `Selected sealed packet "${selectedItem.name}" has no BOM defined. Please check the kit's packing requirements.`
        : "Selected sealed packet has no BOM defined";
      toast.error(errorMsg);
    }
    
    setSealingPacketComboboxOpen(false);
  };

  const handleSealingQuantityChange = (quantity: number) => {
    const selectedItem = inventory?.find((i) => i._id === sealingForm.targetItemId);
    
    if (selectedItem && selectedItem.components && selectedItem.components.length > 0) {
      const updatedSources = selectedItem.components.map((component: any) => ({
        sourceItemId: component.rawMaterialId,
        sourceQuantity: component.quantityRequired * quantity,
      }));
      
      setSealingForm({
        ...sealingForm,
        targetQuantity: quantity,
        sources: updatedSources,
      });
    } else {
      setSealingForm({
        ...sealingForm,
        targetQuantity: quantity,
      });
    }
  };

  const handleCreateSealingJob = async () => {
    if (!sealingForm.targetItemId) {
      toast.error("Please select a sealed packet");
      return;
    }
    
    if (sealingForm.sources.length === 0) {
      toast.error("No source materials defined. Please select a sealed packet with BOM.");
      return;
    }

    try {
      const jobData: any = {
        name: sealingForm.name,
        sources: sealingForm.sources,
        targets: [{ targetItemId: sealingForm.targetItemId, targetQuantity: sealingForm.targetQuantity }],
      };
      
      if (sealingForm.processedBy) {
        jobData.processedBy = sealingForm.processedBy;
      }
      if (sealingForm.processedByType) {
        jobData.processedByType = sealingForm.processedByType;
      }
      if (sealingForm.notes) {
        jobData.notes = sealingForm.notes;
      }
      
      await createProcessingJob(jobData);
      toast.success("Sealing packet job created");
      setSealingJobOpen(false);
      setSealingForm({
        name: "",
        targetItemId: "" as Id<"inventory">,
        targetQuantity: 1,
        sources: [],
        processedBy: "",
        processedByType: "in_house",
        notes: "",
      });
      setSealingPacketComboboxOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create sealing packet job");
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
              <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {canEdit && (
                <Button onClick={handleOpenSealingJobDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start Sealing Job
                </Button>
              )}
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

          {/* Sealing Job Creation Dialog */}
          <Dialog open={sealingJobOpen} onOpenChange={setSealingJobOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Sealing Packet Job</DialogTitle>
                <DialogDescription>
                  Seal raw materials into packets
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="jobName">Job Name *</Label>
                  <Input
                    id="jobName"
                    value={sealingForm.name}
                    onChange={(e) => setSealingForm({ ...sealingForm, name: e.target.value })}
                    placeholder="Enter job name"
                  />
                </div>

                <div>
                  <Label>Target Sealed Packet *</Label>
                  <Popover open={sealingPacketComboboxOpen} onOpenChange={setSealingPacketComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {sealingForm.targetItemId
                          ? inventory?.find((i) => i._id === sealingForm.targetItemId)?.name
                          : "Select sealed packet"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search sealed packets..." />
                        <CommandList>
                          <CommandEmpty>No sealed packet found.</CommandEmpty>
                          <CommandGroup>
                            {inventory?.filter(i => i.type === "sealed_packet").map((item) => (
                              <CommandItem
                                key={item._id}
                                onSelect={() => handleSealingPacketSelection(item._id)}
                              >
                                {item.name} ({item.quantity} {item.unit})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="targetQuantity">Target Quantity *</Label>
                  <Input
                    id="targetQuantity"
                    type="number"
                    value={sealingForm.targetQuantity}
                    onChange={(e) => handleSealingQuantityChange(parseFloat(e.target.value) || 1)}
                    min={1}
                  />
                </div>

                {sealingForm.sources.length > 0 && (
                  <div>
                    <Label>Source Materials (Auto-calculated from BOM)</Label>
                    <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                      {sealingForm.sources.map((source, idx) => {
                        const item = inventory?.find(i => i._id === source.sourceItemId);
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="font-medium">{item?.name || "Unknown"}</span>
                            <Badge variant="secondary">
                              {source.sourceQuantity} {item?.unit}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <Label htmlFor="processedByType">Processed By Type *</Label>
                  <Select
                    value={sealingForm.processedByType}
                    onValueChange={(v: any) => setSealingForm({ ...sealingForm, processedByType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_house">In-House</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sealingForm.processedByType === "vendor" && vendors && (
                  <div>
                    <Label htmlFor="vendor">Select Vendor</Label>
                    <Select
                      value={sealingForm.processedBy}
                      onValueChange={(v) => setSealingForm({ ...sealingForm, processedBy: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor._id} value={vendor.name}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {sealingForm.processedByType === "service" && services && (
                  <div>
                    <Label htmlFor="service">Select Service</Label>
                    <Select
                      value={sealingForm.processedBy}
                      onValueChange={(v) => setSealingForm({ ...sealingForm, processedBy: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service._id} value={service.name}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={sealingForm.notes}
                    onChange={(e) => setSealingForm({ ...sealingForm, notes: e.target.value })}
                    placeholder="Add any additional notes"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSealingJobOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSealingJob}>
                  <Package className="mr-2 h-4 w-4" />
                  Create Job
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