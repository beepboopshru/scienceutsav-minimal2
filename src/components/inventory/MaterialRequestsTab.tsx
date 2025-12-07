import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, AlertCircle, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Id } from "@/convex/_generated/dataModel";

export function MaterialRequestsTab() {
  const { user } = useAuth();
  const requests = useQuery(api.materialRequests.list);
  const approveRequest = useMutation(api.materialRequests.approve);
  const rejectRequest = useMutation(api.materialRequests.reject);
  
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    requestId: Id<"materialRequests"> | null;
    reason: string;
  }>({ open: false, requestId: null, reason: "" });

  if (!requests) {
    return <div>Loading requests...</div>;
  }

  const handleApprove = async (requestId: Id<"materialRequests">) => {
    try {
      await approveRequest({ requestId });
      toast.success("Request approved");
    } catch (error) {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.requestId) return;
    try {
      await rejectRequest({ 
        requestId: rejectDialog.requestId, 
        reason: rejectDialog.reason 
      });
      toast.success("Request rejected");
      setRejectDialog({ open: false, requestId: null, reason: "" });
    } catch (error) {
      toast.error("Failed to reject request");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Material Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No material requests found
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request._id}>
                    <TableCell>
                      {new Date(request._creationTime).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{request.userName}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {request.items.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.name} - {item.quantity} {item.unit}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{request.purpose || "No purpose specified"}</p>
                        {request.assignmentId && (
                          <Badge variant="outline" className="text-xs">
                            Assignment Linked
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(request._id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setRejectDialog({ 
                              open: true, 
                              requestId: request._id, 
                              reason: "" 
                            })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this material request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog(prev => ({ ...prev, reason: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, requestId: null, reason: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectDialog.reason.trim()}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}