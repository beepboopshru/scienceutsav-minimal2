import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { Loader2, CheckCircle, XCircle, Trash2, Clock, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function DeletionRequests() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const deletionRequests = useQuery(api.deletionRequests.list, {
    status: statusFilter === "all" ? undefined : (statusFilter as "pending" | "approved" | "rejected"),
  });
  
  const approveRequest = useMutation(api.deletionRequests.approve);
  const rejectRequest = useMutation(api.deletionRequests.reject);
  const removeRequest = useMutation(api.deletionRequests.remove);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
    if (!isLoading && isAuthenticated && user && user.role !== "admin") {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !deletionRequests) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const handleApprove = async (requestId: Id<"deletionRequests">) => {
    try {
      await approveRequest({ requestId });
      toast.success("Deletion request approved and item deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve request");
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      await rejectRequest({
        requestId: selectedRequest._id,
        rejectionReason: rejectionReason || undefined,
      });
      toast.success("Deletion request rejected");
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject request");
    }
  };

  const handleRemove = async (requestId: Id<"deletionRequests">) => {
    try {
      await removeRequest({ requestId });
      toast.success("Request removed from list");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove request");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      inventory: "Inventory Item",
      client: "B2B Client",
      b2cClient: "B2C Client",
      kit: "Kit",
      vendor: "Vendor",
      service: "Service",
      assignment: "Assignment",
      processingJob: "Processing Job",
      procurementJob: "Procurement Job",
    };
    return labels[type] || type;
  };

  const pendingCount = deletionRequests.filter(r => r.status === "pending").length;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Deletion Requests</h1>
              <p className="text-muted-foreground mt-2">
                Review and approve deletion requests from users
              </p>
            </div>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-lg px-4 py-2">
                {pendingCount} Pending
              </Badge>
            )}
          </div>

          {/* Info Alert */}
          {pendingCount > 0 && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-600">
                  You have {pendingCount} pending deletion request{pendingCount !== 1 ? "s" : ""} awaiting review.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Requests</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Requests List */}
          <div className="space-y-4">
            {deletionRequests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No deletion requests found</p>
                </CardContent>
              </Card>
            ) : (
              deletionRequests.map((request) => (
                <Card key={request._id} className={request.status === "pending" ? "border-yellow-500/30" : ""}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(request.status)}
                          <Badge variant="secondary">{getEntityTypeLabel(request.entityType)}</Badge>
                        </div>
                        
                        <div>
                          <p className="font-semibold text-lg">{request.entityName}</p>
                          {request.reason && (
                            <p className="text-sm text-muted-foreground mt-1">
                              <strong>Reason:</strong> {request.reason}
                            </p>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <strong>Requested by:</strong> {request.requestedByUser?.email || request.requestedByUser?.name || "Unknown"}
                          </p>
                          <p>
                            <strong>Requested at:</strong> {new Date(request._creationTime).toLocaleString()}
                          </p>
                          {request.reviewedBy && request.reviewedByUser && (
                            <>
                              <p>
                                <strong>Reviewed by:</strong> {request.reviewedByUser.email || request.reviewedByUser.name}
                              </p>
                              <p>
                                <strong>Reviewed at:</strong> {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "N/A"}
                              </p>
                            </>
                          )}
                          {request.rejectionReason && (
                            <p className="text-red-600">
                              <strong>Rejection reason:</strong> {request.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(request._id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                        {request.status !== "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(request._id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deletion Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this deletion request (optional)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
