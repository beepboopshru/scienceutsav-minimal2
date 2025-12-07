import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export function MaterialRequestsTab() {
  const requests = useQuery(api.materialRequests.list);
  const updateStatus = useMutation(api.materialRequests.updateStatus);

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
                <div className="flex flex-col">
                  <span className="font-medium">{request.requesterName}</span>
                  <span className="text-xs text-muted-foreground">{request.requesterEmail}</span>
                </div>
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
                {request.status === "pending" && (
                  <div className="flex justify-end gap-2">
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
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}