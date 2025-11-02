import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function ProcessingJobs() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const allJobs = useQuery(api.processingJobs.list);
  const inventory = useQuery(api.inventory.list);
  const vendors = useQuery(api.vendors.list);
  const services = useQuery(api.services.list);
  
  const completeJob = useMutation(api.processingJobs.complete);
  const cancelJob = useMutation(api.processingJobs.cancel);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !allJobs || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const activeJobs = allJobs.filter((job) => job.status === "in_progress");
  const completedJobs = allJobs.filter((job) => job.status === "completed");

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

  const handleComplete = async (jobId: string) => {
    try {
      await completeJob({ id: jobId as any });
      toast.success("Job completed and materials checked in");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete job");
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm("Cancel this job? Source materials will be returned to inventory.")) return;
    try {
      await cancelJob({ id: jobId as any });
      toast.success("Job cancelled and materials returned");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel job");
    }
  };

  const JobCard = ({ job }: { job: any }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{job.name}</CardTitle>
            <CardDescription>
              Processed by: {getProcessorName(job)}
            </CardDescription>
          </div>
          <Badge variant={job.status === "completed" ? "secondary" : "default"}>
            {job.status === "in_progress" ? "In Progress" : "Completed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Source Material</p>
          <div className="flex items-center gap-2 text-sm">
            <span>{getItemName(job.sourceItemId)}</span>
            <span className="text-muted-foreground">× {job.sourceQuantity}</span>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <p className="text-sm font-medium mb-2">Target Materials</p>
          <div className="space-y-2">
            {job.targets.map((target: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span>{getItemName(target.targetItemId)}</span>
                <span className="text-muted-foreground">× {target.targetQuantity}</span>
              </div>
            ))}
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

        {job.status === "completed" && job.completedAt && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Completed on {new Date(job.completedAt).toLocaleDateString()}
            </p>
          </>
        )}

        {job.status === "in_progress" && (
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handleComplete(job._id)} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete & Check-In
            </Button>
            <Button onClick={() => handleCancel(job._id)} variant="outline">
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

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
            <Button onClick={() => navigate("/inventory")} variant="outline">
              Back to Inventory
            </Button>
          </div>

          <Tabs defaultValue="active" className="space-y-6">
            <TabsList>
              <TabsTrigger value="active">
                Active Jobs ({activeJobs.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed Jobs ({completedJobs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeJobs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No active processing jobs</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {activeJobs.map((job) => (
                    <JobCard key={job._id} job={job} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedJobs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No completed processing jobs</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {completedJobs.map((job) => (
                    <JobCard key={job._id} job={job} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}
