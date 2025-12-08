import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export default function UserManagement() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission("userManagement", "view");
  const canApprove = hasPermission("userManagement", "approveUsers");
  const canManageRoles = hasPermission("userManagement", "manageRoles");
  const canDelete = hasPermission("userManagement", "deleteUsers");

  const currentUser = useQuery(api.users.currentUser);
  const pendingUsers = useQuery(api.users.listPending) || [];
  const approvedUsers = useQuery(api.users.listApproved) || [];
  const approveUser = useMutation(api.users.approveUser);
  const updateRole = useMutation(api.users.updateRole);
  const deleteUser = useMutation(api.users.deleteUser);

  if (currentUser === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleApprove = async (userId: any, role: string) => {
    try {
      await approveUser({ id: userId, role });
      toast.success("User approved successfully");
    } catch (error) {
      toast.error("Failed to approve user");
    }
  };

  const handleUpdateRole = async (userId: any, role: string) => {
    try {
      await updateRole({ id: userId, role });
      toast.success("Role updated successfully");
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const handleDelete = async (userId: any) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser({ id: userId });
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-[1600px] mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage user access and permissions.
          </p>
        </div>

        {/* Pending Users Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pending Approvals</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No pending users found
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingUsers.map((user: any) => (
                    <TableRow key={user._id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{new Date(user._creationTime).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select onValueChange={(value) => handleApprove(user._id, value)} disabled={!canApprove}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Approve as..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="operations">Operations</SelectItem>
                              <SelectItem value="content">Content</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(user._id)} disabled={!canDelete}>
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Active Users Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Users</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Date Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedUsers.map((user: any) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.role}</Badge>
                    </TableCell>
                    <TableCell>{new Date(user._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select defaultValue={user.role} onValueChange={(value) => handleUpdateRole(user._id, value)} disabled={!canManageRoles}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="operations">Operations</SelectItem>
                            <SelectItem value="content">Content</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(user._id)} disabled={!canDelete}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}