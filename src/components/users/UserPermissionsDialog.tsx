import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UserPermissionsDialogProps {
  userId: Id<"users">;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PERMISSION_RESOURCES = [
  { key: "dashboard", label: "Dashboard", actions: ["view"] },
  { key: "programs", label: "Programs", actions: ["view", "create", "edit", "delete", "archive"] },
  { key: "kits", label: "Kits", actions: ["view", "create", "edit", "delete", "editStock", "uploadImages", "clone"] },
  { key: "clients", label: "Clients", actions: ["view", "create", "edit", "delete"] },
  { key: "b2cClients", label: "B2C Clients", actions: ["view", "create", "edit", "delete"] },
  { key: "batches", label: "Batches", actions: ["view", "create", "edit", "delete"] },
  { key: "assignments", label: "Assignments", actions: ["view", "create", "edit", "delete", "updateStatus"] },
  { key: "inventory", label: "Inventory", actions: ["view", "create", "edit", "delete", "editStock", "createCategories", "importData", "editBOM"] },
  { key: "vendors", label: "Vendors", actions: ["view", "create", "edit", "delete"] },
  { key: "services", label: "Services", actions: ["view", "create", "edit", "delete"] },
  { key: "processingJobs", label: "Processing Jobs", actions: ["view", "create", "edit", "complete", "delete", "editBOM", "editTargets"] },
  { key: "packing", label: "Packing", actions: ["view", "initiate", "validate", "transfer", "edit"] },
  { key: "dispatch", label: "Dispatch", actions: ["view", "verify", "dispatch", "updateStatus", "edit"] },
  { key: "discrepancyTickets", label: "Discrepancy Tickets", actions: ["view", "create", "edit", "resolve", "delete"] },
  { key: "billTracking", label: "Bill Tracking", actions: ["view", "create", "edit", "updateStatus", "delete"] },
  { key: "billRecords", label: "Bill Records", actions: ["view", "download"] },
  { key: "vendorImports", label: "Vendor Imports", actions: ["view", "create", "edit", "updatePaymentStatus", "delete"] },
  { key: "orderHistory", label: "Order History", actions: ["view", "export"] },
  { key: "laserFiles", label: "Laser Files", actions: ["view", "upload", "delete"] },
  { key: "reports", label: "Reports", actions: ["view", "download"] },
  { key: "adminZone", label: "Admin Zone", actions: ["view", "clearAssignments", "viewActivityLogs", "deleteActivityLogs"] },
  { key: "userManagement", label: "User Management", actions: ["view", "approveUsers", "manageRoles", "managePermissions", "deleteUsers"] },
  { key: "kitStatistics", label: "Kit Statistics", actions: ["view", "viewStock", "editStock", "viewFiles", "viewCapacityPricing"] },
  { key: "lms", label: "LMS", actions: ["view", "edit"] },
  { key: "deletionRequests", label: "Deletion Requests", actions: ["view", "create", "approve", "reject"] },
  { key: "materialRequests", label: "Material Requests", actions: ["view", "create", "approve", "reject", "fulfill"] },
  { key: "packingRequests", label: "Packing Requests", actions: ["view", "create", "fulfill"] },
  { key: "notifications", label: "Notifications", actions: ["view", "receive"] },
];

export function UserPermissionsDialog({ userId, userName, open, onOpenChange }: UserPermissionsDialogProps) {
  const userPermissions = useQuery(api.userPermissions.get, { userId });
  const updatePermissions = useMutation(api.userPermissions.update);
  const [isSaving, setIsSaving] = useState(false);
  const [localPermissions, setLocalPermissions] = useState<Record<string, Record<string, boolean>>>({});

  // Initialize local permissions when data loads
  useState(() => {
    if (userPermissions?.permissions) {
      setLocalPermissions(userPermissions.permissions as any);
    }
  });

  const handleToggle = (resource: string, action: string, value: boolean) => {
    setLocalPermissions((prev) => ({
      ...prev,
      [resource]: {
        ...(prev[resource] || {}),
        [action]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePermissions({
        userId,
        permissions: localPermissions as any,
      });
      toast.success("Permissions updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update permissions");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!userPermissions) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Permissions for {userName}</DialogTitle>
          <DialogDescription>
            Configure granular permissions for this user. These will override their role-based defaults.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {PERMISSION_RESOURCES.map((resource) => (
              <div key={resource.key} className="space-y-3">
                <h4 className="font-semibold text-sm">{resource.label}</h4>
                <div className="grid grid-cols-2 gap-3 pl-4">
                  {resource.actions.map((action) => {
                    const isChecked = localPermissions[resource.key]?.[action] ?? false;
                    return (
                      <div key={action} className="flex items-center space-x-2">
                        <Switch
                          id={`${resource.key}-${action}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleToggle(resource.key, action, checked)}
                        />
                        <Label
                          htmlFor={`${resource.key}-${action}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {action.replace(/([A-Z])/g, " $1").toLowerCase()}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}