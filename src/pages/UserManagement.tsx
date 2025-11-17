import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Users, Settings, UserCheck, UserX, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function UserManagement() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });
  
  const [permissionsDialog, setPermissionsDialog] = useState<{
    open: boolean;
    userId: Id<"users"> | null;
    userName: string;
  }>({ open: false, userId: null, userName: "" });
  
  const [permissions, setPermissions] = useState<any>({});
  
  const pendingUsers = useQuery(api.users.listPending);
  const approvedUsers = useQuery(api.users.listApproved);
  const existingPermissions = useQuery(
    api.userPermissions.get,
    permissionsDialog.userId ? { userId: permissionsDialog.userId } : "skip"
  );
  
  const approveUser = useMutation(api.users.approveUser);
  const updateRole = useMutation(api.users.updateRole);
  const deleteUser = useMutation(api.users.deleteUser);
  const updatePermissions = useMutation(api.userPermissions.update);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
    if (!isLoading && isAuthenticated && user && user.role !== "admin") {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Load existing permissions when dialog opens
  useEffect(() => {
    if (permissionsDialog.open && permissionsDialog.userId) {
      // Default structure with all permissions
      const defaultPermissions = {
        dashboard: { view: true },
        programs: { view: false, create: false, edit: false, delete: false, archive: false },
        kits: { view: false, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
        clients: { view: false, create: false, edit: false, delete: false },
        b2cClients: { view: false, create: false, edit: false, delete: false },
        batches: { view: false, create: false, edit: false, delete: false },
        assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
        inventory: { view: false, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
        vendors: { view: false, create: false, edit: false, delete: false },
        services: { view: false, create: false, edit: false, delete: false },
        processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
        procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
        packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
        dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
        discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
        billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
        vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
        orderHistory: { view: false, edit: false, export: false },
        laserFiles: { view: false, edit: false, upload: false, delete: false },
        reports: { view: false, download: false },
        adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
        userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
        kitStatistics: { view: false, viewStock: false, editStock: false, viewFiles: false, viewCapacityPricing: false },
        lms: { view: false, edit: false },
      };

      if (existingPermissions?.permissions) {
        // Merge existing permissions with defaults to ensure new fields are present
        const merged: any = { ...defaultPermissions };
        const existing = existingPermissions.permissions as any;
        
        // Merge each resource, preserving existing values and adding missing ones
        Object.keys(merged).forEach((resource) => {
          if (existing[resource]) {
            merged[resource] = { ...merged[resource], ...existing[resource] };
          }
        });
        
        setPermissions(merged);
      } else {
        // No existing permissions, use defaults
        setPermissions(defaultPermissions);
      }
    }
  }, [permissionsDialog.open, permissionsDialog.userId, existingPermissions]);

  if (isLoading || !user || !pendingUsers || !approvedUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const handleApproveUser = async (userId: Id<"users">, role: string) => {
    try {
      await approveUser({ userId, role: role as any });
      toast.success("User approved successfully");
    } catch (error) {
      toast.error("Failed to approve user");
    }
  };

  const handleUpdateRole = async (userId: Id<"users">, role: string) => {
    try {
      await updateRole({ userId, role: role as any });
      toast.success("Role updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId: Id<"users">) => {
    setConfirmDialog({
      open: true,
      title: "Delete User",
      description: "Are you sure you want to delete this user? This action cannot be undone.",
      action: async () => {
        try {
          await deleteUser({ userId });
          toast.success("User deleted successfully");
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error: any) {
          toast.error(error.message || "Failed to delete user");
        }
      },
    });
  };

  const openPermissionsDialog = (userId: Id<"users">, userName: string) => {
    setPermissionsDialog({ open: true, userId, userName });
  };

  const handleSavePermissions = async () => {
    if (!permissionsDialog.userId) return;
    
    try {
      await updatePermissions({
        userId: permissionsDialog.userId,
        permissions,
      });
      toast.success("Permissions updated successfully");
      setPermissionsDialog({ open: false, userId: null, userName: "" });
    } catch (error: any) {
      console.error("Permission update error:", error);
      toast.error(error?.message || "Failed to update permissions");
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Shield className="h-4 w-4 text-red-500" />;
      case "manager": return <Shield className="h-4 w-4 text-orange-500" />;
      case "sales": return <Shield className="h-4 w-4 text-yellow-500" />;
      case "finance": return <Shield className="h-4 w-4 text-emerald-500" />;
      case "laser_operator": return <Shield className="h-4 w-4 text-cyan-500" />;
      case "research_head": return <Shield className="h-4 w-4 text-indigo-500" />;
      case "research_development": return <Shield className="h-4 w-4 text-blue-500" />;
      case "operations": return <Shield className="h-4 w-4 text-green-500" />;
      case "inventory": return <Shield className="h-4 w-4 text-purple-500" />;
      case "content": return <Shield className="h-4 w-4 text-pink-500" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

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
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-2">
              Approve new users and manage existing user roles and permissions
            </p>
          </div>

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Approve new users and manage existing user roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pending Approvals */}
              {pendingUsers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Pending Approvals</h3>
                    <Badge variant="secondary">{pendingUsers.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {pendingUsers.map((pendingUser) => (
                      <Card key={pendingUser._id} className="border-orange-500/50 bg-orange-500/5">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{pendingUser.name || pendingUser.email}</p>
                              <p className="text-sm text-muted-foreground">{pendingUser.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={selectedRole[pendingUser._id] || "inventory"}
                                onValueChange={(value) => setSelectedRole({ ...selectedRole, [pendingUser._id]: value })}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="sales">Sales</SelectItem>
                                  <SelectItem value="finance">Finance</SelectItem>
                                  <SelectItem value="laser_operator">Laser Operator</SelectItem>
                                  <SelectItem value="research_head">Research Head</SelectItem>
                                  <SelectItem value="research_development">Research & Development</SelectItem>
                                  <SelectItem value="operations">Operations</SelectItem>
                                  <SelectItem value="inventory">Inventory</SelectItem>
                                  <SelectItem value="content">Content</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleApproveUser(pendingUser._id, selectedRole[pendingUser._id] || "inventory")}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteUser(pendingUser._id)}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Approved Users */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="approved-users">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Approved Users</span>
                      <Badge variant="secondary">{approvedUsers.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {approvedUsers.map((approvedUser) => (
                        <Card key={approvedUser._id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getRoleIcon(approvedUser.role || "")}
                                <div>
                                  <p className="font-medium">{approvedUser.name || approvedUser.email}</p>
                                  <p className="text-sm text-muted-foreground">{approvedUser.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={approvedUser.role || "inventory"}
                                  onValueChange={(value) => handleUpdateRole(approvedUser._id, value)}
                                  disabled={approvedUser._id === user._id}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="sales">Sales</SelectItem>
                                    <SelectItem value="finance">Finance</SelectItem>
                                    <SelectItem value="laser_operator">Laser Operator</SelectItem>
                                    <SelectItem value="research_head">Research Head</SelectItem>
                                    <SelectItem value="research_development">Research & Development</SelectItem>
                                    <SelectItem value="operations">Operations</SelectItem>
                                    <SelectItem value="inventory">Inventory</SelectItem>
                                    <SelectItem value="content">Content</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openPermissionsDialog(approvedUser._id, approvedUser.name || approvedUser.email || "User")}
                                  disabled={approvedUser._id === user._id}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteUser(approvedUser._id)}
                                  disabled={approvedUser._id === user._id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Role Descriptions */}
          <Card>
            <CardHeader>
              <CardTitle>Role Descriptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <strong>Admin:</strong> Full system access including user management
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <strong>Manager:</strong> Same as admin but cannot manage users
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <strong>Sales:</strong> Manage B2B/B2C clients and assignments
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div>
                  <strong>Finance:</strong> Bill tracking and vendor payment management
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-cyan-500 mt-0.5" />
                <div>
                  <strong>Laser Operator:</strong> View and access laser files only
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <strong>Research Head:</strong> Create and manage programs and kits
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>Research & Development:</strong> Manage kits within programs (cannot create programs)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <strong>Operations:</strong> Inventory, packing, dispatch, and operations management
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-purple-500 mt-0.5" />
                <div>
                  <strong>Inventory:</strong> Inventory and vendor management only
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-pink-500 mt-0.5" />
                <div>
                  <strong>Content:</strong> View programs/kits and upload kit images only
                </div>
              </div>
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

      {/* Permissions Dialog */}
      <Dialog open={permissionsDialog.open} onOpenChange={(open) => setPermissionsDialog({ ...permissionsDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions: {permissionsDialog.userName}</DialogTitle>
            <DialogDescription>Configure granular permissions for this user</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {Object.entries(permissions).sort(([a], [b]) => a.localeCompare(b)).map(([section, perms]: [string, any]) => (
              <div key={section} className="space-y-3">
                <h4 className="font-semibold capitalize text-base">
                  {section === 'kitStatistics' ? 'Kit Statistics' : 
                   section === 'lms' ? 'LMS' :
                   section.replace(/([A-Z])/g, ' $1').trim()}
                </h4>
                <div className="grid grid-cols-2 gap-3 pl-4">
                  {Object.entries(perms).map(([perm, value]: [string, any]) => (
                    <div key={perm} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${section}-${perm}`}
                        checked={value}
                        onCheckedChange={(checked) => {
                          setPermissions({
                            ...permissions,
                            [section]: { ...permissions[section], [perm]: checked },
                          });
                        }}
                      />
                      <Label htmlFor={`${section}-${perm}`} className="text-sm capitalize cursor-pointer">
                        {perm.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialog({ open: false, userId: null, userName: "" })}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions}>
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}