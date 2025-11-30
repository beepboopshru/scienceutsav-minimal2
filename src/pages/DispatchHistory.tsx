import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DispatchHistory() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const customDispatches = useQuery(api.customDispatches.list, {});

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const canView = hasPermission("dispatch", "view");

  if (!canView) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  let filteredDispatches = customDispatches || [];

  if (statusFilter !== "all") {
    filteredDispatches = filteredDispatches.filter((d) => d.status === statusFilter);
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredDispatches = filteredDispatches.filter((d) => {
      const description = d.description?.toLowerCase() || "";
      const recipientName = d.recipientName?.toLowerCase() || "";
      const trackingNumber = d.trackingNumber?.toLowerCase() || "";
      return description.includes(query) || recipientName.includes(query) || trackingNumber.includes(query);
    });
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dispatch History</h1>
            <p className="text-muted-foreground mt-2">
              View all custom dispatch records
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by description, recipient, or tracking number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          {!filteredDispatches ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDispatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No dispatch records found.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">Date</th>
                  <th className="text-left p-4 font-semibold">Description</th>
                  <th className="text-left p-4 font-semibold">Recipient</th>
                  <th className="text-left p-4 font-semibold">Tracking Number</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-left p-4 font-semibold">Created By</th>
                  <th className="text-left p-4 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.map((dispatch) => (
                  <tr key={dispatch._id} className="border-b hover:bg-muted/30">
                    <td className="p-4">
                      {new Date(dispatch._creationTime).toLocaleDateString()}
                    </td>
                    <td className="p-4">{dispatch.description}</td>
                    <td className="p-4">{dispatch.recipientName || "-"}</td>
                    <td className="p-4">{dispatch.trackingNumber || "-"}</td>
                    <td className="p-4">
                      <Badge
                        variant={
                          dispatch.status === "delivered"
                            ? "default"
                            : dispatch.status === "dispatched"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {dispatch.status}
                      </Badge>
                    </td>
                    <td className="p-4">{dispatch.createdByName}</td>
                    <td className="p-4">{dispatch.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
