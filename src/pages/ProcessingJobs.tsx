import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, ArrowRight, Plus, Scissors, Check, ChevronsUpDown, ChevronDown, ChevronRight, Play, Edit, Trash2, Package } from "lucide-react";
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

  const handleDelete = async (jobId: string) => {
    if (!confirm("Delete this completed job? This action cannot be undone.")) return;
    try {
      await deleteJob({ id: jobId as any });
      toast.success("Job deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete job");
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
              {canEdit && (
                <Dialog open={preProcessingOpen} onOpenChange={(open) => {
                  setPreProcessingOpen(open);
                  if (!open) setIsFromRequirements(false);
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setIsFromRequirements(false)}>
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
                      <Label>Source Materials {isFromRequirements && !canEditBOM && <span className="text-xs text-muted-foreground">(Auto-filled from BOM - Read Only)</span>}</Label>
                      {processingForm.sources.map((source, index) => {
                        const targetItem = inventory.find(i => i._id === processingForm.targets[0]?.targetItemId);
                        const hasBOM = targetItem?.components && targetItem.components.length > 0;
                        const isLocked = isFromRequirements && hasBOM && !canEditBOM;
                        
                        return (
                        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4">
                          <div className="space-y-2">
                            <Popover 
                              open={!isLocked && sourceComboboxOpen[index]} 
                              onOpenChange={(open) => !isLocked && setSourceComboboxOpen({ ...sourceComboboxOpen, [index]: open })}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={sourceComboboxOpen[index]}
                                  className="w-full justify-between"
                                  disabled={isLocked}
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
                              disabled={isLocked}
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
                            disabled={processingForm.sources.length === 1 || isLocked}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )})}
                      {(!isFromRequirements || canEditBOM || !processingForm.targets[0]?.targetItemId || !inventory.find(i => i._id === processingForm.targets[0]?.targetItemId)?.components?.length) && (
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
                      )}
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
              )}

              <Button onClick={() => navigate("/inventory/sealing-jobs")} variant="secondary">
                <Package className="mr-2 h-4 w-4" />
                Sealing Jobs
              </Button>

              <Button onClick={() => navigate("/inventory")} variant="outline">
                Back to Inventory
              </Button>
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