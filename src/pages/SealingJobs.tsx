import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  
  const [viewMode, setViewMode] = useState<"requirements" | "jobs">("requirements");
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{ id: Id<"inventory">; quantity: number } | null>(null);
  
  const [jobName, setJobName] = useState("");
  const [processedBy, setProcessedBy] = useState("");
  const [processedByType, setProcessedByType] = useState<"in_house" | "vendor" | "service">("in_house");
  const [notes, setNotes] = useState("");

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

  const handleStartRequirementJob = (targetItemId: Id<"inventory"> | string, quantity: number) => {
    setSelectedTarget({ id: targetItemId as Id<"inventory">, quantity });
    const targetItem = inventory.find(i => i._id === targetItemId);
    const packetName = targetItem?.name || "Packet";
    setJobName(`Seal ${packetName} - ${quantity} units`);
    setCreateJobOpen(true);
  };

  const handleCreateJob = async () => {
    if (!selectedTarget || !jobName) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Check if target is a placeholder (missing from inventory)
      if (typeof selectedTarget.id === 'string' && selectedTarget.id.startsWith('missing_')) {
        toast.error("Please create the sealed packet item in inventory first with its BOM components");
        return;
      }

      const targetItem = inventory.find(i => i._id === selectedTarget.id);
      if (!targetItem) {
        toast.error("Target sealed packet not found in inventory");
        return;
      }
      
      // Sealed packets MUST have BOM components defined in inventory
      if (!targetItem.components || !Array.isArray(targetItem.components) || targetItem.components.length === 0) {
        toast.error(`Sealed packet "${targetItem.name}" must have BOM components defined in inventory before creating a sealing job`);
        return;
      }

      // Use inventory BOM to calculate sources
      const sources = targetItem.components.map(comp => ({
        sourceItemId: comp.rawMaterialId,
        sourceQuantity: comp.quantityRequired * selectedTarget.quantity,
      }));

      // Validate all source materials have sufficient stock
      for (const source of sources) {
        const sourceItem = inventory.find(i => i._id === source.sourceItemId);
        if (!sourceItem) {
          toast.error(`Source material not found in inventory`);
          return;
        }
        if (sourceItem.quantity < source.sourceQuantity) {
          toast.error(`Insufficient stock for ${sourceItem.name}. Required: ${source.sourceQuantity} ${sourceItem.unit}, Available: ${sourceItem.quantity} ${sourceItem.unit}`);
          return;
        }
      }

      await createProcessingJob({
        name: jobName,
        sources,
        targets: [{
          targetItemId: selectedTarget.id,
          targetQuantity: selectedTarget.quantity,
        }],
        processedBy: processedBy || undefined,
        processedByType: processedByType,
        notes: notes || undefined,
      });

      toast.success("Sealing job created successfully");
      setCreateJobOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to create sealing job");
    }
  };

  const resetForm = () => {
    setJobName("");
    setProcessedBy("");
    setProcessedByType("in_house");
    setNotes("");
    setSelectedTarget(null);
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
                onStartJob={handleStartRequirementJob}
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
          </Tabs>

          {/* Create Sealing Job Dialog */}
          <Dialog open={createJobOpen} onOpenChange={setCreateJobOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Sealing Job</DialogTitle>
                <DialogDescription>
                  Create a new job to seal packets. Source materials will be auto-calculated based on the packet's BOM.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="jobName">Job Name *</Label>
                  <Input
                    id="jobName"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Enter job name"
                  />
                </div>

                <div>
                  <Label htmlFor="processedByType">Processed By Type *</Label>
                  <Select value={processedByType} onValueChange={(v: any) => setProcessedByType(v)}>
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

                {processedByType === "vendor" && vendors && (
                  <div>
                    <Label htmlFor="vendor">Select Vendor</Label>
                    <Select value={processedBy} onValueChange={setProcessedBy}>
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

                {processedByType === "service" && services && (
                  <div>
                    <Label htmlFor="service">Select Service</Label>
                    <Select value={processedBy} onValueChange={setProcessedBy}>
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
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateJobOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateJob}>
                  <Package className="mr-2 h-4 w-4" />
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