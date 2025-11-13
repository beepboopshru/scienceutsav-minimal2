import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, ArrowRight, Plus, Scissors, Check, ChevronsUpDown, ChevronDown, ChevronRight, Play, Edit } from "lucide-react";
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
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export default function ProcessingJobs() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const jobs = useQuery(api.processingJobs.list);
  const inventory = useQuery(api.inventory.list);
  const vendors = useQuery(api.vendors.list);
  const services = useQuery(api.services.list);
  const kits = useQuery(api.kits.list);

  const createProcessingJob = useMutation(api.processingJobs.create);
  const completeJob = useMutation(api.processingJobs.complete);
  const startJob = useMutation(api.processingJobs.startJob);
  const cancelJob = useMutation(api.processingJobs.cancel);
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
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "in_progress" | "completed">("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !jobs || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === "all") return true;
    return job.status === statusFilter;
  });

  const getItemName = (itemId: string) => {
    const item = inventory.find((i) => i._id === itemId);
    return item ? `${item.name} (${item.unit})` : "Unknown Item";
  };

  const getProcessorName = (job: any) => {
    if (job.processedByType === "in_house") return "In-House";
    if (job.processedByType === "vendor") {
      const vendor = vendors?.find((v) => v._id === job.processedBy);
      return vendor ? vendor.name : "Unknown Vendor";
    }
    if (job.processedByType === "service") {
      const service = services?.find((s) => s._id === job.processedBy);
      return service ? service.name : "Unknown Service";
    }
    return "Unknown";
  };

  const toggleRowExpansion = (jobId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  };

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
    const selectedItem = inventory.find((i) => i._id === sealingForm.targetItemId);
    
    if (selectedItem && selectedItem.components && selectedItem.components.length > 0) {
      const updatedSources = selectedItem.components.map((component) => ({
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
              <h1 className="text-3xl font-bold tracking-tight">Processing Jobs</h1>
              <p className="text-muted-foreground mt-2">
                Track material transformation and processing
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={preProcessingOpen} onOpenChange={setPreProcessingOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Scissors className="mr-2 h-4 w-4" />
                    Start Pre-Processing
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Processing Job</DialogTitle>
                    <DialogDescription>Transform raw materials into pre-processed items</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Job Name</Label>
                      <Input
                        value={processingForm.name}
                        onChange={(e) => setProcessingForm({ ...processingForm, name: e.target.value })}
                      />
                    </div>
                    <Separator />
                    <Label>Source Materials</Label>
                    {processingForm.sources.map((source, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4">
                        <div className="space-y-2">
                          <Popover 
                            open={sourceComboboxOpen[index]} 
                            onOpenChange={(open) => setSourceComboboxOpen({ ...sourceComboboxOpen, [index]: open })}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={sourceComboboxOpen[index]}
                                className="w-full justify-between"
                              >
                                {source.sourceItemId
                                  ? (() => {
                                      const item = inventory.find((i) => i._id === source.sourceItemId);
                                      return item ? `${item.name} (${item.quantity} ${item.unit})` : "Select source";
                                    })()
                                  : "Select source"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                              <Command>
                                <CommandInput placeholder="Search inventory..." />
                                <CommandList>
                                  <CommandEmpty>No inventory item found.</CommandEmpty>
                                  <CommandGroup>
                                    {inventory?.filter((item) => item.type === "raw").map((item) => (
                                      <CommandItem
                                        key={item._id}
                                        value={`${item.name} ${item._id}`}
                                        onSelect={() => {
                                          const newSources = [...processingForm.sources];
                                          newSources[index].sourceItemId = item._id;
                                          setProcessingForm({ ...processingForm, sources: newSources });
                                          setSourceComboboxOpen({ ...sourceComboboxOpen, [index]: false });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            source.sourceItemId === item._id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {item.name} ({item.quantity} {item.unit})
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Input
                            type="number"
                            placeholder="Quantity"
                            value={source.sourceQuantity}
                            onChange={(e) => {
                              const newSources = [...processingForm.sources];
                              newSources[index].sourceQuantity = Number(e.target.value);
                              setProcessingForm({ ...processingForm, sources: newSources });
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newSources = processingForm.sources.filter((_, i) => i !== index);
                            if (newSources.length > 0) {
                              setProcessingForm({ ...processingForm, sources: newSources });
                            }
                          }}
                          disabled={processingForm.sources.length === 1}
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
                          sources: [...processingForm.sources, { sourceItemId: "" as Id<"inventory">, sourceQuantity: 0 }],
                        })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Source
                    </Button>
                    <Separator />
                    <Label>Target Items</Label>
                    {processingForm.targets.map((target, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4">
                        <div className="space-y-2">
                          <Popover 
                            open={targetComboboxOpen[index]} 
                            onOpenChange={(open) => setTargetComboboxOpen({ ...targetComboboxOpen, [index]: open })}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={targetComboboxOpen[index]}
                                className="w-full justify-between"
                              >
                                {target.targetItemId
                                  ? (() => {
                                      const item = inventory.find((i) => i._id === target.targetItemId);
                                      return item ? item.name : "Select target";
                                    })()
                                  : "Select target"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                              <Command>
                                <CommandInput placeholder="Search inventory..." />
                                <CommandList>
                                  <CommandEmpty>No inventory item found.</CommandEmpty>
                                  <CommandGroup>
                                    {inventory?.filter((item) => item.type === "pre_processed").map((item) => (
                                      <CommandItem
                                        key={item._id}
                                        value={`${item.name} ${item._id}`}
                                        onSelect={() => handleTargetSelection(index, item._id)}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            target.targetItemId === item._id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {item.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Input
                            type="number"
                            placeholder="Quantity"
                            value={target.targetQuantity}
                            onChange={(e) => handleTargetQuantityChange(index, Number(e.target.value))}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newTargets = processingForm.targets.filter((_, i) => i !== index);
                            if (newTargets.length > 0) {
                              setProcessingForm({ ...processingForm, targets: newTargets });
                            }
                          }}
                          disabled={processingForm.targets.length === 1}
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
                          targets: [...processingForm.targets, { targetItemId: "" as Id<"inventory">, targetQuantity: 0 }],
                        })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Target
                    </Button>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Processed By Type</Label>
                        <Select
                          value={processingForm.processedByType}
                          onValueChange={(value: any) => setProcessingForm({ ...processingForm, processedByType: value })}
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
                      {processingForm.processedByType !== "in_house" && (
                        <div className="space-y-2">
                          <Label>Select {processingForm.processedByType === "vendor" ? "Vendor" : "Service"}</Label>
                          <Select
                            value={processingForm.processedBy}
                            onValueChange={(value) => setProcessingForm({ ...processingForm, processedBy: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${processingForm.processedByType}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {(processingForm.processedByType === "vendor" ? vendors : services)?.map((item) => (
                                <SelectItem key={item._id} value={item._id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={processingForm.notes}
                        onChange={(e) => setProcessingForm({ ...processingForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPreProcessingOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateProcessingJob}>Create Job</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={sealingPacketOpen} onOpenChange={setSealingPacketOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <Plus className="mr-2 h-4 w-4" />
                    Start Sealing Packet Job
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Sealing Packet Job</DialogTitle>
                    <DialogDescription>Package materials into sealed packets</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Job Name</Label>
                      <Input
                        value={sealingForm.name}
                        onChange={(e) => setSealingForm({ ...sealingForm, name: e.target.value })}
                      />
                    </div>
                    <Separator />
                    <Label>Target Sealed Packet</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Popover 
                          open={sealingPacketComboboxOpen} 
                          onOpenChange={setSealingPacketComboboxOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={sealingPacketComboboxOpen}
                              className="w-full justify-between"
                            >
                              {sealingForm.targetItemId
                                ? (() => {
                                    const item = inventory.find((i) => i._id === sealingForm.targetItemId);
                                    return item ? item.name : "Select sealed packet";
                                  })()
                                : "Select sealed packet"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Search sealed packets..." />
                              <CommandList>
                                <CommandEmpty>No sealed packet found.</CommandEmpty>
                                <CommandGroup>
                                  {combinedInventory.filter((item) => item.type === "sealed_packet").map((item) => (
                                    <CommandItem
                                      key={item._id}
                                      value={`${item.name} ${item._id}`}
                                      onSelect={() => handleSealingPacketSelection(item._id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          sealingForm.targetItemId === item._id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {item.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="Quantity"
                          value={sealingForm.targetQuantity}
                          onChange={(e) => handleSealingQuantityChange(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <Separator />
                    <Label>Source Materials (Auto-filled from BOM)</Label>
                    {sealingForm.sources.length > 0 ? (
                      <div className="space-y-2">
                        {sealingForm.sources.map((source, index) => {
                          const item = inventory.find((i) => i._id === source.sourceItemId);
                          return (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium">{item?.name || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">
                                  Required: {source.sourceQuantity} {item?.unit || ""} | Available: {item?.quantity || 0} {item?.unit || ""}
                                </p>
                              </div>
                              {item && item.quantity < source.sourceQuantity && (
                                <Badge variant="destructive">Insufficient</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a sealed packet to view required materials</p>
                    )}
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Processed By Type</Label>
                        <Select
                          value={sealingForm.processedByType}
                          onValueChange={(value: any) => setSealingForm({ ...sealingForm, processedByType: value })}
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
                      {sealingForm.processedByType !== "in_house" && (
                        <div className="space-y-2">
                          <Label>Select {sealingForm.processedByType === "vendor" ? "Vendor" : "Service"}</Label>
                          <Select
                            value={sealingForm.processedBy}
                            onValueChange={(value) => setSealingForm({ ...sealingForm, processedBy: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${sealingForm.processedByType}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {(sealingForm.processedByType === "vendor" ? vendors : services)?.map((item) => (
                                <SelectItem key={item._id} value={item._id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={sealingForm.notes}
                        onChange={(e) => setSealingForm({ ...sealingForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSealingPacketOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateSealingJob}>Create Job</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={() => navigate("/inventory")} variant="outline">
                Back to Inventory
              </Button>
            </div>
          </div>

          {/* Status Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Jobs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Jobs ({filteredJobs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Processor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No processing jobs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <>
                        <TableRow key={job._id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleRowExpansion(job._id)}
                            >
                              {expandedRows[job._id] ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{job.name}</TableCell>
                          <TableCell>{getProcessorName(job)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              job.status === "completed" ? "secondary" : 
                              job.status === "in_progress" ? "default" : 
                              "outline"
                            }>
                              {job.status === "assigned" ? "Assigned" : 
                               job.status === "in_progress" ? "In Progress" : 
                               "Completed"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {job.status === "completed" && job.completedAt
                              ? new Date(job.completedAt).toLocaleDateString()
                              : new Date(job._creationTime).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {job.status === "assigned" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleStartJob(job._id)}>
                                  <Play className="mr-2 h-4 w-4" />
                                  Start Job
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCancel(job._id, job.status)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                            {job.status === "in_progress" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleComplete(job._id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Complete
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCancel(job._id, job.status)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedRows[job._id] && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/50">
                              <div className="p-4 space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium mb-2">Source Materials</p>
                                    <div className="space-y-1">
                                      {job.sources.map((source: any, index: number) => (
                                        <div key={index} className="flex items-center gap-2 text-sm">
                                          <span>{getItemName(source.sourceItemId)}</span>
                                          <span className="text-muted-foreground">× {source.sourceQuantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium mb-2">Target Materials</p>
                                    <div className="space-y-1">
                                      {job.targets.map((target: any, index: number) => (
                                        <div key={index} className="flex items-center gap-2 text-sm">
                                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                          <span>{getItemName(target.targetItemId)}</span>
                                          <span className="text-muted-foreground">× {target.targetQuantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                {job.notes && (
                                  <>
                                    <Separator />
                                    <div>
                                      <p className="text-sm font-medium mb-1">Notes</p>
                                      <p className="text-sm text-muted-foreground">{job.notes}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}