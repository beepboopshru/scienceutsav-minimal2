import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface QuickAddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSubcategory?: string;
  onSuccess: () => void;
}

export function QuickAddInventoryDialog({ 
  open, 
  onOpenChange, 
  defaultSubcategory, 
  onSuccess 
}: QuickAddInventoryDialogProps) {
  const createInventoryItem = useMutation(api.inventory.create);
  const inventory = useQuery(api.inventory.list);
  const categories = useQuery(api.inventoryCategories.list, {});

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "raw" as "raw" | "pre_processed" | "finished" | "sealed_packet",
    unit: "",
    subcategory: defaultSubcategory || "",
    notes: "",
  });

  const [bom, setBom] = useState<Array<{
    rawMaterialId: string; // temporary string, will be cast to Id
    name: string;
    quantityRequired: number;
    unit: string;
  }>>([]);

  const [openComboboxIdx, setOpenComboboxIdx] = useState<number | null>(null);

  const handleSave = async () => {
    if (!form.name || !form.unit || !form.subcategory) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const components = bom.map(item => ({
        rawMaterialId: item.rawMaterialId as Id<"inventory">,
        quantityRequired: item.quantityRequired,
        unit: item.unit
      }));

      await createInventoryItem({
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        quantity: 0,
        unit: form.unit,
        subcategory: form.subcategory,
        notes: form.notes || undefined,
        components: components.length > 0 ? components : undefined,
      });

      toast.success("Inventory item created successfully");
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setForm({
        name: "",
        description: "",
        type: "raw",
        unit: "",
        subcategory: defaultSubcategory || "",
        notes: "",
      });
      setBom([]);
    } catch (error) {
      toast.error("Failed to create inventory item");
      console.error(error);
    }
  };

  const addBomItem = () => {
    setBom([...bom, { rawMaterialId: "", name: "", quantityRequired: 1, unit: "" }]);
  };

  const removeBomItem = (index: number) => {
    setBom(bom.filter((_, i) => i !== index));
  };

  const updateBomItem = (index: number, field: keyof typeof bom[0], value: any) => {
    const newBom = [...bom];
    newBom[index] = { ...newBom[index], [field]: value };
    setBom(newBom);
  };

  const showBom = ["pre_processed", "finished", "sealed_packet"].includes(form.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Inventory Item</DialogTitle>
          <DialogDescription>
            Create a new inventory item. For processed items, you can define a Bill of Materials.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter item name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(value: any) => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw Material</SelectItem>
                  <SelectItem value="pre_processed">Pre-Processed</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                  <SelectItem value="sealed_packet">Sealed Packet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="e.g., kg, pcs, meters"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subcategory *</Label>
            <Select
              value={form.subcategory}
              onValueChange={(value) => setForm({ ...form, subcategory: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.filter(cat => cat.value && cat.value.trim() !== "").map((cat) => (
                  <SelectItem key={cat._id} value={cat.value}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes"
            />
          </div>

          {showBom && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Bill of Materials (Components)</Label>
                <Button size="sm" variant="outline" onClick={addBomItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Component
                </Button>
              </div>
              
              {bom.length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground mb-2 px-2">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-3">Quantity</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-1"></div>
                </div>
              )}

              <div className="space-y-2">
                {bom.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <Popover
                        open={openComboboxIdx === idx}
                        onOpenChange={(open) => setOpenComboboxIdx(open ? idx : null)}
                        modal={true}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {item.name || "Select material"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search inventory..." />
                            <CommandList>
                              <CommandEmpty>No item found.</CommandEmpty>
                              <CommandGroup>
                                {inventory?.map((invItem) => (
                                  <CommandItem
                                    key={invItem._id}
                                    value={invItem.name}
                                    onSelect={() => {
                                      const newBom = [...bom];
                                      newBom[idx] = {
                                        ...newBom[idx],
                                        rawMaterialId: invItem._id,
                                        name: invItem.name,
                                        unit: invItem.unit
                                      };
                                      setBom(newBom);
                                      setOpenComboboxIdx(null);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.rawMaterialId === invItem._id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {invItem.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.quantityRequired}
                        onChange={(e) => updateBomItem(idx, "quantityRequired", parseFloat(e.target.value))}
                        min={0}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.unit}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeBomItem(idx)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {bom.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                    No components added. Click "Add Component" to define the BOM.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!form.name || !form.unit || !form.subcategory}
          >
            Create Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}