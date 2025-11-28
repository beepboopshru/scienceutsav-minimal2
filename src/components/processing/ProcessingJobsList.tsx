import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Play, CheckCircle, XCircle, Trash2, ArrowRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface ProcessingJobsListProps {
  jobs: any[];
  inventory: any[];
  vendors: any[];
  services: any[];
  canEdit: boolean;
  onStartJob: (id: Id<"processingJobs">) => void;
  onCompleteJob: (id: Id<"processingJobs">) => void;
  onCancelJob: (id: Id<"processingJobs">, status: string) => void;
  onDeleteJob: (id: Id<"processingJobs">) => void;
}

export function ProcessingJobsList({
  jobs,
  inventory,
  vendors,
  services,
  canEdit,
  onStartJob,
  onCompleteJob,
  onCancelJob,
  onDeleteJob
}: ProcessingJobsListProps) {
  const [activeTab, setActiveTab] = useState<"assigned" | "in_progress" | "completed">("assigned");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const filteredJobs = jobs.filter((job) => job.status === activeTab);

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

  return (
    <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="assigned">Assigned ({jobs.filter(j => j.status === "assigned").length})</TabsTrigger>
        <TabsTrigger value="in_progress">In Progress ({jobs.filter(j => j.status === "in_progress").length})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({jobs.filter(j => j.status === "completed").length})</TabsTrigger>
      </TabsList>

      {["assigned", "in_progress", "completed"].map((status) => (
        <TabsContent key={status} value={status} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="capitalize">{status.replace("_", " ")} Jobs ({filteredJobs.length})</CardTitle>
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
                        No {status.replace("_", " ")} jobs found
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
                            {canEdit && activeTab === "assigned" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => onStartJob(job._id)}>
                                  <Play className="mr-2 h-4 w-4" />
                                  Start Job
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => onCancelJob(job._id, job.status)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                            {canEdit && activeTab === "in_progress" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => onCompleteJob(job._id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Complete
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => onCancelJob(job._id, job.status)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                            {canEdit && activeTab === "completed" && (
                              <Button size="sm" variant="destructive" onClick={() => onDeleteJob(job._id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
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
                                      <p className=\"text-sm text-muted-foreground\">{job.notes}</p>
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
        </TabsContent>
      ))}
    </Tabs>
  );
}
