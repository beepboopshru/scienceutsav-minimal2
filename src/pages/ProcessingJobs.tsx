import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, ArrowRight, Plus, Scissors, Check, ChevronsUpDown, ChevronDown, ChevronRight, Play, Edit, Trash2, Package, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ProcessingRequirements } from "@/components/processing/ProcessingRequirements";
import { ProcessingJobsList } from "@/components/processing/ProcessingJobsList";

export default function ProcessingJobs() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  
  const canView = hasPermission("processingJobs", "view");
  const canEdit = hasPermission("processingJobs", "edit");
  const canEditBOM = hasPermission("processingJobs", "editBOM");
  const canEditTargets = hasPermission("processingJobs", "editTargets");
  
  const jobs = useQuery(api.processingJobs.list);
  const inventory = useQuery(api.inventory.list);
  const vendors = useQuery(api.vendors.list);
  const services = useQuery(api.services.list);
  const kits = useQuery(api.kits.list);
  const assignments = useQuery(api.assignments.list, {});
  const clients = useQuery(api.clients.list);
  const b2cClients = useQuery(api.b2cClients.list);

  const createProcessingJob = useMutation(api.processingJobs.create);
  const completeJob = useMutation(api.processingJobs.complete);
  const startJob = useMutation(api.processingJobs.startJob);
  const cancelJob = useMutation(api.processingJobs.cancel);
  const deleteJob = useMutation(api.processingJobs.remove);
  const createInventoryItem = useMutation(api.inventory.create);

  // Create virtual packet items from kits
  const virtualPackets: any[] = [];
  if (kits && inventory) {
    kits.forEach((kit) => {
      if (kit.packingRequirements) {
        try {
          const packingData = JSON.parse(kit.packingRequirements);
          if (packingData.packets && Array.isArray(packingData.packets)) {
            packingData.packets.forEach((packet: any, index: number) => {
              virtualPackets.push({
                _id: `${kit._id}_packet_${index}`,
                name: `[${kit.name}] ${packet.name}`,
                description: `Sealed packet from ${kit.name}`,
                type: "sealed_packet",
                quantity: kit.stockCount,
                unit: "packet",
                isKitPacket: true,
                sourceKit: kit,
                componentData: packet,
                components: packet.materials?.map((material: any) => ({
                  rawMaterialId: inventory.find((inv: any) => inv.name === material.name)?._id || ("" as any),
                  quantityRequired: material.quantity,
                  unit: material.unit,
                })).filter((comp: any) => comp.rawMaterialId) || [],
              });
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    });
  }

  // Combine real inventory with virtual packets for sealed packet selection
  const combinedInventory = inventory ? [...inventory, ...virtualPackets] : [];

  const [preProcessingOpen, setPreProcessingOpen] = useState(false);
  const [sealingPacketOpen, setSealingPacketOpen] = useState(false);
  const [sourceComboboxOpen, setSourceComboboxOpen] = useState<Record<number, boolean>>({});
  const [targetComboboxOpen, setTargetComboboxOpen] = useState<Record<number, boolean>>({});
  const [processingForm, setProcessingForm] = useState({
    name: "",
    sources: [{ sourceItemId: "" as Id<"inventory">, sourceQuantity: 0 }],
    targets: [{ targetItemId: "" as Id<"inventory">, targetQuantity: 0 }],
    processedBy: "",
    processedByType: "in_house" as "vendor" | "service" | "in_house",
    notes: "",
  });

  const [sealingForm, setSealingForm] = useState({
    name: "",
    targetItemId: "" as Id<"inventory">,
    targetQuantity: 1,
    sources: [] as Array<{ sourceItemId: Id<"inventory">; sourceQuantity: number }>,
    processedBy: "",
    processedByType: "in_house" as "vendor" | "service" | "in_house",
    notes: "",
  });

  const [sealingPacketComboboxOpen, setSealingPacketComboboxOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"requirements" | "jobs">("requirements");
  const [isFromRequirements, setIsFromRequirements] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  if (isLoading || !user || !jobs || !inventory || !assignments) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const handleTargetSelection = (targetIndex: number, itemId: Id<"inventory">) => {
    const selectedItem = inventory.find((i) => i._id === itemId);
    const newTargets = [...processingForm.targets];
    newTargets[targetIndex].targetItemId = itemId;
    
    // If the selected item has BOM components, auto-fill sources
    if (selectedItem && selectedItem.components && selectedItem.components.length > 0) {
      const newSources = selectedItem.components.map((component) => ({
        sourceItemId: component.rawMaterialId,
        sourceQuantity: component.quantityRequired * (newTargets[targetIndex].targetQuantity || 1),
      }));
      
      setProcessingForm({ 
        ...processingForm, 
        targets: newTargets,
        sources: newSources.length > 0 ? newSources : processingForm.sources
      });
      toast.success("BOM materials auto-filled in sources");
    } else {
      setProcessingForm({ ...processingForm, targets: newTargets });
    }
    
    setTargetComboboxOpen({ ...targetComboboxOpen, [targetIndex]: false });
  };

  const handleTargetQuantityChange = (targetIndex: number, quantity: number) => {
    const newTargets = [...processingForm.targets];
    newTargets[targetIndex].targetQuantity = quantity;
    
    // Update source quantities based on BOM if applicable
    const selectedItem = inventory.find((i) => i._id === newTargets[targetIndex].targetItemId);
    if (selectedItem && selectedItem.components && selectedItem.components.length > 0) {
      const newSources = selectedItem.components.map((component) => ({
        sourceItemId: component.rawMaterialId,
        sourceQuantity: component.quantityRequired * quantity,
      }));
      
      setProcessingForm({ 
        ...processingForm, 
        targets: newTargets,
        sources: newSources
      });
    } else {
      setProcessingForm({ ...processingForm, targets: newTargets });
    }
  };

  const handleSealingPacketSelection = (itemId: Id<"inventory">) => {
    // Check both real inventory and virtual packets
    const selectedItem = combinedInventory.find((i) => i._id === itemId);
    
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
      console.error("Selected item:", selectedItem);
    }
    
    setSealingPacketComboboxOpen(false);
  };

  const handleSealingQuantityChange = (quantity: number) => {
    const selectedItem = combinedInventory.find((i) => i._id === sealingForm.targetItemId);
    
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

  const validateSealingJobMaterials = (): boolean => {
    for (const source of sealingForm.sources) {
      const inventoryItem = inventory.find((i) => i._id === source.sourceItemId);
      if (!inventoryItem) {
        toast.error(`Source material not found`);
        return false;
      }
      if (inventoryItem.quantity < source.sourceQuantity) {
        toast.error(`Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity} ${inventoryItem.unit}, Required: ${source.sourceQuantity} ${inventoryItem.unit}`);
        return false;
      }
    }
    return true;
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

    if (!validateSealingJobMaterials()) {
      return;
    }

    try {
      // Check if the target is a virtual packet (from kit)
      const selectedItem = combinedInventory.find((i) => i._id === sealingForm.targetItemId);
      let targetInventoryId = sealingForm.targetItemId;
      
      // If it's a virtual packet, create a real inventory item for it
      if (selectedItem && selectedItem.isKitPacket) {
        const existingInventoryItem = inventory?.find(
          (inv) => inv.name === selectedItem.name && inv.type === "sealed_packet"
        );
        
        if (existingInventoryItem) {
          targetInventoryId = existingInventoryItem._id;
        } else {
          // Create the sealed packet inventory item
          const newItemId = await createInventoryItem({
            name: selectedItem.name,
            description: selectedItem.description || `Sealed packet from ${selectedItem.sourceKit?.name}`,
            type: "sealed_packet",
            quantity: 0,
            unit: selectedItem.unit || "packet",
            components: selectedItem.components || [],
          });
          targetInventoryId = newItemId;
          toast.success(`Created inventory item for ${selectedItem.name}`);
        }
      }
      
      const jobData: any = {
        name: sealingForm.name,
        sources: sealingForm.sources,
        targets: [{ targetItemId: targetInventoryId, targetQuantity: sealingForm.targetQuantity }],
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
      setSealingPacketOpen(false);
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

  const handleComplete = async (jobId: string) => {
    try {
      await completeJob({ id: jobId as any });
      toast.success("Job completed and materials checked in");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete job");
    }
  };

  const handleStartJob = async (jobId: Id<"processingJobs">) => {
    console.log("handleStartJob called with jobId:", jobId);
    console.log("All jobs:", jobs);
    console.log("Jobs length:", jobs?.length);
    
    if (!jobs || jobs.length === 0) {
      toast.error("No jobs data available. Please refresh the page.");
      return;
    }
    
    try {
      const job = jobs.find(j => j._id === jobId);
      console.log("Found job:", job);
      console.log("Job ID match check:", jobs.map(j => ({ id: j._id, matches: j._id === jobId })));
      
      if (!job) {
        console.error("Job not found. JobId:", jobId, "Available job IDs:", jobs.map(j => j._id));
        toast.error(`Job not found. Please refresh the page and try again.`);
        return;
      }

      // Only check materials if sources exist
      if (job.sources && job.sources.length > 0) {
        const insufficientMaterials: string[] = [];
        for (const source of job.sources) {
          const sourceItem = inventory?.find(i => i._id === source.sourceItemId);
          if (!sourceItem) {
            insufficientMaterials.push(`Material not found: ${source.sourceItemId}`);
          } else if (sourceItem.quantity < source.sourceQuantity) {
            insufficientMaterials.push(
              `${sourceItem.name}: Need ${source.sourceQuantity} ${sourceItem.unit}, Have ${sourceItem.quantity} ${sourceItem.unit}`
            );
          }
        }

        if (insufficientMaterials.length > 0) {
          console.log("Insufficient materials:", insufficientMaterials);
          toast.error(
            `Cannot start job - Insufficient materials: ${insufficientMaterials.join(", ")}`,
            { duration: 5000 }
          );
          return;
        }
      } else {
        // No source materials - this is allowed
        toast.info("Starting job without source materials - only target quantity will be increased");
      }

      console.log("Starting job with id:", jobId);
      await startJob({ id: jobId });
      toast.success("Job started successfully");
    } catch (error: any) {
      console.error("Error starting job:", error);
      toast.error(error.message || "Failed to start job");
    }
  };

  const handleCancel = async (jobId: string, status: string) => {
    const message = status === "in_progress" 
      ? "Cancel this job? Source materials will be returned to inventory."
      : "Cancel this job?";
    if (!confirm(message)) return;
    try {
      await cancelJob({ id: jobId as any });
      const successMessage = status === "in_progress"
        ? "Job cancelled and materials returned"
        : "Job cancelled";
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel job");
    }
  };

  const handleDelete = async (id: Id<"processingJobs">) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      const result = await deleteJob({ id });
      if (result && 'requestCreated' in result && result.requestCreated) {
        toast.success("Deletion request submitted for admin approval");
      } else {
        toast.success("Job deleted");
      }
    } catch (err) {
      toast.error("Failed to delete job");
    }
  };

  const handleCreateProcessingJob = async () => {
    try {
      // Filter out invalid sources (empty sourceItemId)
      const validSources = processingForm.sources.filter(
        (source) => source.sourceItemId && source.sourceItemId !== ""
      );
      
      const jobData: any = {
        name: processingForm.name,
        sources: validSources.length > 0 ? validSources : [],
        targets: processingForm.targets,
      };
      
      if (processingForm.processedBy) {
        jobData.processedBy = processingForm.processedBy;
      }
      if (processingForm.processedByType) {
        jobData.processedByType = processingForm.processedByType;
      }
      if (processingForm.notes) {
        jobData.notes = processingForm.notes;
      }
      
      await createProcessingJob(jobData);
      toast.success("Processing job created");
      setPreProcessingOpen(false);
      setProcessingForm({
        name: "",
        sources: [{ sourceItemId: "" as Id<"inventory">, sourceQuantity: 0 }],
        targets: [{ targetItemId: "" as Id<"inventory">, targetQuantity: 0 }],
        processedBy: "",
        processedByType: "in_house",
        notes: "",
      });
      setSourceComboboxOpen({});
      setTargetComboboxOpen({});
    } catch (error: any) {
      toast.error(error.message || "Failed to create processing job");
    }
  };

  const handleStartRequirementJob = (targetItemId: Id<"inventory">, quantity: number) => {
    const item = inventory.find(i => i._id === targetItemId);
    if (!item) return;

    // Calculate sources immediately
    let sources: any[] = [{ sourceItemId: "" as Id<"inventory">, sourceQuantity: 0 }];
    if (item.components && item.components.length > 0) {
      sources = item.components.map((component) => ({
        sourceItemId: component.rawMaterialId,
        sourceQuantity: component.quantityRequired * quantity,
      }));
    }

    setProcessingForm({
      name: `Process ${item.name}`,
      sources: sources,
      targets: [{ targetItemId, targetQuantity: quantity }],
      processedBy: "",
      processedByType: "in_house",
      notes: "Auto-generated from requirements",
    });
    
    setIsFromRequirements(true);
    setPreProcessingOpen(true);
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
              <h1 className="text-3xl font-bold tracking-tight">Pre-Processing Jobs</h1>
              <p className="text-muted-foreground mt-2">
                Track material transformation and processing
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {canEdit && (
                <Button onClick={() => setPreProcessingOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start Pre-Processing
                </Button>
              )}
            </div>
          </div>

          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
              <TabsTrigger value="requirements">Requirements & Planning</TabsTrigger>
              <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
              <TabsTrigger value="assignment">Assignment Wise</TabsTrigger>
            </TabsList>

            <TabsContent value="requirements" className="space-y-4">
              <ProcessingRequirements 
                assignments={assignments} 
                inventory={inventory} 
                onStartJob={handleStartRequirementJob}
                activeJobs={jobs}
                refreshTrigger={lastRefresh}
              />
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <ProcessingJobsList
                jobs={jobs}
                inventory={inventory}
                vendors={vendors || []}
                services={services || []}
                canEdit={canEdit}
                onStartJob={handleStartJob}
                onCompleteJob={handleComplete}
                onCancelJob={handleCancel}
                onDeleteJob={handleDelete}
              />
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Wise Pre-Processing</CardTitle>
                  <CardDescription>
                    Processing jobs grouped by assignment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Group jobs by assignment
                    const assignmentGroups = new Map<string, {
                      assignment: any;
                      jobs: any[];
                    }>();

                    jobs?.forEach((job) => {
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
                          No processing jobs linked to assignments yet.
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
                                onCompleteJob={handleComplete}
                                onCancelJob={handleCancel}
                                onDeleteJob={handleDelete}
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

          {/* Pre-Processing Job Creation Dialog */}
          <Dialog open={preProcessingOpen} onOpenChange={setPreProcessingOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Pre-Processing Job</DialogTitle>
                <DialogDescription>
                  Transform raw materials into pre-processed items
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="jobName">Job Name *</Label>
                  <Input
                    id="jobName"
                    value={processingForm.name}
                    onChange={(e) => setProcessingForm({ ...processingForm, name: e.target.value })}
                    placeholder="Enter job name"
                  />
                </div>

                <div>
                  <Label>Source Materials (Input)</Label>
                  <div className="space-y-2">
                    {processingForm.sources.map((source, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label>Material</Label>
                          <Popover
                            open={sourceComboboxOpen[index]}
                            onOpenChange={(open) =>
                              setSourceComboboxOpen({ ...sourceComboboxOpen, [index]: open })
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" disabled={!canEditBOM}>
                                {source.sourceItemId
                                  ? inventory?.find((i) => i._id === source.sourceItemId)?.name
                                  : "Select material"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search materials..." />
                                <CommandList>
                                  <CommandEmpty>No material found.</CommandEmpty>
                                  <CommandGroup>
                                    {inventory?.filter(i => i.type === "raw").map((item) => (
                                      <CommandItem
                                        key={item._id}
                                        onSelect={() => {
                                          const newSources = [...processingForm.sources];
                                          newSources[index].sourceItemId = item._id;
                                          setProcessingForm({ ...processingForm, sources: newSources });
                                          setSourceComboboxOpen({ ...sourceComboboxOpen, [index]: false });
                                        }}
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
                        <div className="w-32">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={source.sourceQuantity}
                            onChange={(e) => {
                              const newSources = [...processingForm.sources];
                              newSources[index].sourceQuantity = parseFloat(e.target.value) || 0;
                              setProcessingForm({ ...processingForm, sources: newSources });
                            }}
                            disabled={!canEditBOM}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newSources = processingForm.sources.filter((_, i) => i !== index);
                            setProcessingForm({ ...processingForm, sources: newSources });
                          }}
                          disabled={!canEditBOM}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProcessingForm({
                          ...processingForm,
                          sources: [
                            ...processingForm.sources,
                            { sourceItemId: "" as Id<"inventory">, sourceQuantity: 0 },
                          ],
                        })
                      }
                      disabled={!canEditBOM}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Source Material
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Target Materials (Output)</Label>
                  <div className="space-y-2">
                    {processingForm.targets.map((target, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label>Material</Label>
                          <Popover
                            open={targetComboboxOpen[index]}
                            onOpenChange={(open) =>
                              setTargetComboboxOpen({ ...targetComboboxOpen, [index]: open })
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" disabled={!canEditTargets}>
                                {target.targetItemId
                                  ? inventory?.find((i) => i._id === target.targetItemId)?.name
                                  : "Select material"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search materials..." />
                                <CommandList>
                                  <CommandEmpty>No material found.</CommandEmpty>
                                  <CommandGroup>
                                    {inventory?.filter(i => i.type === "pre_processed").map((item) => (
                                      <CommandItem
                                        key={item._id}
                                        onSelect={() => handleTargetSelection(index, item._id)}
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
                        <div className="w-32">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={target.targetQuantity}
                            onChange={(e) => handleTargetQuantityChange(index, parseFloat(e.target.value) || 0)}
                            disabled={!canEditTargets}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newTargets = processingForm.targets.filter((_, i) => i !== index);
                            setProcessingForm({ ...processingForm, targets: newTargets });
                          }}
                          disabled={!canEditTargets}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProcessingForm({
                          ...processingForm,
                          targets: [
                            ...processingForm.targets,
                            { targetItemId: "" as Id<"inventory">, targetQuantity: 0 },
                          ],
                        })
                      }
                      disabled={!canEditTargets}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Target Material
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="processedByType">Processed By Type *</Label>
                  <Select
                    value={processingForm.processedByType}
                    onValueChange={(v: any) => setProcessingForm({ ...processingForm, processedByType: v })}
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

                {processingForm.processedByType === "vendor" && vendors && (
                  <div>
                    <Label htmlFor="vendor">Select Vendor</Label>
                    <Select
                      value={processingForm.processedBy}
                      onValueChange={(v) => setProcessingForm({ ...processingForm, processedBy: v })}
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

                {processingForm.processedByType === "service" && services && (
                  <div>
                    <Label htmlFor="service">Select Service</Label>
                    <Select
                      value={processingForm.processedBy}
                      onValueChange={(v) => setProcessingForm({ ...processingForm, processedBy: v })}
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
                    value={processingForm.notes}
                    onChange={(e) => setProcessingForm({ ...processingForm, notes: e.target.value })}
                    placeholder="Add any additional notes"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreProcessingOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProcessingJob}>
                  <Scissors className="mr-2 h-4 w-4" />
                  Create Job
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </Layout>
  );
}