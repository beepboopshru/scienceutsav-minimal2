import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

export function MaterialRequestsTab() {
  const requests = useQuery(api.materialRequests.list);
  const updateStatus = useMutation(api.materialRequests.updateStatus);
  const fulfillRequest = useMutation(api.materialRequests.fulfillRequest);
  const { hasPermission } = usePermissions();
  
  const canApprove = hasPermission("materialRequests", "approve");
  const canFulfill = hasPermission("inventory", "editStock");

  const handleApprove = async (id: any) => {
    try {
      await updateStatus({ id, status: "approved" });
      toast.success("Request approved");
    } catch (error) {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (id: any) => {
    try {
      await updateStatus({ id, status: "rejected" });
      toast.success("Request rejected");
    } catch (error) {
      toast.error("Failed to reject request");
    }
  };
  
  const handleFulfill = async (id: any) => {
    try {
      await fulfillRequest({ id });
      toast.success("Request fulfilled - Inventory reduced");
    } catch (error: any) {
      toast.error(error.message || "Failed to fulfill request");
    }
  };

  if (!requests) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requester</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request._id}>
              <TableCell>
                <span className="text-sm">{request.requesterEmail}</span>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {request.items.map((item: any, index: number) => (
                    <div key={index} className="text-sm">
                      {item.name} - {item.quantity} {item.unit}
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell>{request.purpose || "-"}</TableCell>
              <TableCell>
                <Badge variant={
                  request.status === "approved" ? "default" :
                  request.status === "rejected" ? "destructive" : "secondary"
                }>
                  {request.status}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(request._creationTime).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {request.status === "pending" && canApprove && (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleApprove(request._id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleReject(request._id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {request.status === "approved" && canFulfill && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8"
                      onClick={() => handleFulfill(request._id)}
                    >
                      <PackageCheck className="h-4 w-4 mr-2" />
                      Fulfill & Reduce Stock
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}