import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Package, Plus } from "lucide-react";
import { MaterialRequestsTab } from "@/components/inventory/MaterialRequestsTab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function OperationsInventoryRelations() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  
  const canViewMaterialRequests = hasPermission("materialRequests", "view");
  const canCreateMaterialRequests = hasPermission("materialRequests", "create");
  
  const inventory = useQuery(api.inventory.list);
  const createRequest = useMutation(api.materialRequests.create);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<Array<{
    inventoryId: string;
    name: string;
    quantity: number;
    unit: string;
  }>>([{ inventoryId: "", name: "", quantity: 0, unit: "" }]);
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleAddItem = () => {
    setItems([...items, { inventoryId: "", name: "", quantity: 0, unit: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === "inventoryId") {
      const selectedItem = inventory?.find(inv => inv._id === value);
      if (selectedItem) {
        newItems[index] = {
          inventoryId: value,
          name: selectedItem.name,
          quantity: newItems[index].quantity,
          unit: selectedItem.unit,
        };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const handleSubmit = async () => {
    try {
      // Validate items
      const validItems = items.filter(item => item.inventoryId && item.quantity > 0);
      if (validItems.length === 0) {
        toast.error("Please add at least one item with a valid quantity");
        return;
      }

      await createRequest({
        items: validItems.map(item => ({
          inventoryId: item.inventoryId as any,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
        purpose: purpose || undefined,
      });

      toast.success("Material request submitted successfully");
      setIsDialogOpen(false);
      setPurpose("");
      setItems([{ inventoryId: "", name: "", quantity: 0, unit: "" }]);
    } catch (error) {
      toast.error("Failed to submit material request");
      console.error(error);
    }
  };

  if (!canViewMaterialRequests) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Package className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Material Requests</h1>
              <p className="text-muted-foreground mt-2">
                Manage material requests from production
              </p>
            </div>
            
            {canCreateMaterialRequests && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Inventory
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Request Inventory Materials</DialogTitle>
                    <DialogDescription>
                      Submit a request for materials needed from inventory
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="purpose">Purpose (Optional)</Label>
                      <Textarea
                        id="purpose"
                        placeholder="Describe the purpose of this request..."
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Materials</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddItem}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-2">
                            <Label>Material</Label>
                            <Select
                              value={item.inventoryId}
                              onValueChange={(value) => handleItemChange(index, "inventoryId", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select material" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory?.map((inv) => (
                                  <SelectItem key={inv._id} value={inv._id}>
                                    {inv.name} ({inv.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="w-32 space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity || ""}
                              onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>

                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit}>
                        Submit Request
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="mt-6">
            <MaterialRequestsTab />
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}