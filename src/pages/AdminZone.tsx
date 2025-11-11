import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { Loader2, AlertTriangle, Trash2, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function AdminZone() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });
  
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;
  const activityLogs = useQuery(api.activityLogs.list, {
    limit: 50,
    actionType: actionTypeFilter,
    userId: userFilter !== "all" ? (userFilter as Id<"users">) : undefined,
    dateRange: dateRangeFilter,
  });
  const allAssignments = useQuery(api.assignments.list);
  
  const clearPendingAssignments = useMutation(api.users.clearPendingAssignments);
  const clearAllAssignments = useMutation(api.users.clearAllAssignments);
  const deleteAllLogs = useMutation(api.activityLogs.deleteAll);

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

  if (isLoading || !user || !activityLogs || !allAssignments) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const handleClearPendingAssignments = () => {
    const pendingCount = allAssignments.filter(
      a => a.status === "assigned" || a.status === "packed"
    ).length;
    
    setConfirmDialog({
      open: true,
      title: "Clear Pending Assignments",
      description: `This will delete ${pendingCount} pending assignments and restore stock. Dispatched assignments will not be affected. Continue?`,
      action: async () => {
        try {
          const count = await clearPendingAssignments({});
          toast.success(`Cleared ${count} pending assignments`);
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error) {
          toast.error("Failed to clear assignments");
        }
      },
    });
  };

  const handleClearAllAssignments = () => {
    setConfirmDialog({
      open: true,
      title: "⚠️ Clear ALL Assignments",
      description: `This will permanently delete ALL ${allAssignments.length} assignments including dispatched ones. This action CANNOT be undone. Are you absolutely sure?`,
      action: () => {
        setConfirmDialog({
          open: true,
          title: "⚠️ FINAL CONFIRMATION",
          description: "This is your last chance. Type 'DELETE' to confirm complete data wipe.",
          action: async () => {
            try {
              const count = await clearAllAssignments({});
              toast.success(`Cleared all ${count} assignments`);
              setConfirmDialog({ ...confirmDialog, open: false });
            } catch (error) {
              toast.error("Failed to clear assignments");
            }
          },
        });
      },
    });
  };

  const handleDeleteAllLogs = () => {
    setConfirmDialog({
      open: true,
      title: "Delete All Activity Logs",
      description: "This will permanently delete all activity logs. This action cannot be undone.",
      action: async () => {
        try {
          const count = await deleteAllLogs({});
          toast.success(`Deleted ${count} activity logs`);
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error) {
          toast.error("Failed to delete logs");
        }
      },
    });
  };

  const handleExportLogs = () => {
    const csv = [
      ["User", "Action", "Details", "Performed By", "Timestamp"],
      ...activityLogs.map(log => [
        log.user?.email || log.user?.name || "Unknown",
        log.actionType,
        log.details,
        log.performedByUser?.email || log.performedByUser?.name || "System",
        new Date(log._creationTime).toLocaleString(),
      ]),
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported successfully");
  };

  const paginatedLogs = activityLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );
  const totalPages = Math.ceil(activityLogs.length / logsPerPage);

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Zone</h1>
            <p className="text-muted-foreground mt-2">
              System administration and user management
            </p>
          </div>

          {/* Danger Warning */}
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="ml-2">
              <strong>Danger Zone:</strong> Actions performed here are powerful and often irreversible. Proceed with caution.
            </AlertDescription>
          </Alert>

          {/* Assignment Management */}
          <Card className="border-red-500/50">
            <CardHeader>
              <CardTitle className="text-red-600">Assignment Management</CardTitle>
              <CardDescription>Clear assignment data (use with extreme caution)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Clear Pending Assignments</p>
                  <p className="text-sm text-muted-foreground">
                    Delete all non-dispatched assignments ({allAssignments.filter(a => a.status !== "dispatched").length} total)
                  </p>
                </div>
                <Button variant="destructive" onClick={handleClearPendingAssignments}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Pending
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border-2 border-red-500 rounded-lg bg-red-500/5">
                <div>
                  <p className="font-medium text-red-600">Clear ALL Assignments</p>
                  <p className="text-sm text-muted-foreground">
                    Delete every assignment including dispatched ({allAssignments.length} total)
                  </p>
                </div>
                <Button variant="destructive" onClick={handleClearAllAssignments}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity Logs */}
          <Card>
            <CardHeader>
              <CardTitle>User Activity Logs</CardTitle>
              <CardDescription>Monitor system activity and user actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 flex-wrap">
                <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="user_login">User Login</SelectItem>
                    <SelectItem value="user_approved">User Approved</SelectItem>
                    <SelectItem value="role_changed">Role Changed</SelectItem>
                    <SelectItem value="user_deleted">User Deleted</SelectItem>
                    <SelectItem value="assignments_cleared">Assignments Cleared</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="outline" onClick={handleExportLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                
                <Button variant="destructive" onClick={handleDeleteAllLogs}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Logs
                </Button>
              </div>

              {/* Logs List */}
              <div className="space-y-2">
                {paginatedLogs.map((log) => (
                  <Card key={log._id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.actionType}</Badge>
                            <p className="text-sm font-medium">{log.user?.email || log.user?.name || "Unknown"}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                          {log.performedByUser && (
                            <p className="text-xs text-muted-foreground">
                              By: {log.performedByUser.email || log.performedByUser.name}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log._creationTime).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * logsPerPage + 1}-{Math.min(currentPage * logsPerPage, activityLogs.length)} of {activityLogs.length} logs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDialog.action}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}