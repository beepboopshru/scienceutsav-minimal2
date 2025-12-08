import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings } from "lucide-react";

interface UserPermissionsDialogProps {
  userId: Id<"users">;
  userName: string;
}

export function UserPermissionsDialog({ userId, userName }: UserPermissionsDialogProps) {
  const [open, setOpen] = useState(false);
  const effectivePermissions = useQuery(api.userPermissions.getEffective, { userId });
  const updatePermissions = useMutation(api.userPermissions.update);
  const [localPermissions, setLocalPermissions] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    if (effectivePermissions) {
      setLocalPermissions(effectivePermissions);
    }
  }, [effectivePermissions]);

  const handleToggle = (resource: string, action: string, checked: boolean) => {
    setLocalPermissions((prev) => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: checked,
      },
    }));
  };

  const handleSave = async () => {
    try {
      await updatePermissions({
        userId,
        permissions: localPermissions as any,
      });
      toast.success("Permissions updated successfully");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update permissions");
    }
  };

  if (!effectivePermissions) {
    return (
      <Button variant="outline" size="icon" disabled>
        <Settings className="h-4 w-4" />
      </Button>
    );
  }

  const resources = Object.keys(localPermissions).sort();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Manage Permissions">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Permissions for {userName}</DialogTitle>
          <DialogDescription>
            Configure granular permissions. These will override role-based defaults.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
            {resources.map((resource) => (
              <div key={resource} className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold capitalize mb-2">{resource.replace(/([A-Z])/g, ' $1').trim()}</h3>
                <div className="space-y-2">
                  {Object.entries(localPermissions[resource] || {}).map(([action, enabled]) => (
                    <div key={action} className="flex items-center justify-between">
                      <Label htmlFor={`${resource}-${action}`} className="text-sm font-normal capitalize cursor-pointer">
                        {action.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <Switch
                        id={`${resource}-${action}`}
                        checked={enabled}
                        onCheckedChange={(checked) => handleToggle(resource, action, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
