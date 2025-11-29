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
  
  const jobs = useQuery(api.processingJobs.list);
  const inventory = useQuery(api.inventory.list);
  const vendors = useQuery(api.vendors.list);
  const services = useQuery(api.services.list);
  const kits = useQuery(api.kits.list);
  const assignments = useQuery(api.assignments.list, {});

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

  const handleStartJob = async (jobId: string) => {
    try {
      // Validate materials before starting
      const job = jobs?.find(j => j._id === jobId);
      if (!job) {
        toast.error("Job not found");
        return;
      }

      // Check if all source materials have sufficient stock
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
        toast.error(
          `Cannot start job - Insufficient materials:\n${insufficientMaterials.join("\n")}`,
          { duration: 5000 }
        );
        return;
      }

      await startJob({ id: jobId as any });
      toast.success("Job started and materials deducted from inventory");
    } catch (error: any) {
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
      const jobData: any = {
        name: processingForm.name,
        sources: processingForm.sources,
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
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
              <TabsTrigger value="requirements">Requirements & Planning</TabsTrigger>
              <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
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
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}