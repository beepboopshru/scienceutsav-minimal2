import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SealingRequirements } from "@/components/processing/SealingRequirements";
import { ProcessingJobsList } from "@/components/processing/ProcessingJobsList";
import { useState } from "react";

export default function SealingJobs() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  
  const canView = hasPermission("processingJobs", "view");
  const canEdit = hasPermission("processingJobs", "edit");
  
  const assignments = useQuery(api.assignments.list, {});
  const inventory = useQuery(api.inventory.list);
  const [viewMode, setViewMode] = useState<"requirements" | "jobs">("requirements");

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

  const handleStartRequirementJob = (targetItemId: any, quantity: number) => {
    // Navigate to processing jobs with pre-filled data
    navigate("/processing-jobs", { state: { targetItemId, quantity, type: "sealed_packet" } });
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
              <h1 className="text-3xl font-bold tracking-tight">Sealing Jobs</h1>
              <p className="text-muted-foreground mt-2">
                Track sealed packet requirements and production
              </p>
            </div>
            <Button onClick={() => navigate("/processing-jobs")} variant="outline">
              Back to Processing Jobs
            </Button>
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
              {/* Will show sealing jobs filtered from processing jobs */}
              <p className="text-muted-foreground text-center py-8">
                Sealing jobs will be managed through the Processing Jobs page
              </p>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}
