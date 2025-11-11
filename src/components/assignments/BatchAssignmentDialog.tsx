import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface BatchAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Array<any>;
  programs: Array<any>;
  kits: Array<any>;
  onCreateBatch: (data: any) => Promise<void>;
}

interface BatchKit {
  id: string;
  programId: string;
  kitId: string;
  quantity: number;
  grade: string;
  notes: string;
}

export function BatchAssignmentDialog({
  open,
  onOpenChange,
  clients,
  programs,
  kits,
  onCreateBatch,
}: BatchAssignmentDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [batchName, setBatchName] = useState<string>("");
  const [batchNotes, setBatchNotes] = useState<string>("");
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>(undefined);
  const [productionMonth, setProductionMonth] = useState<string>("");
  const [batchKits, setBatchKits] = useState<BatchKit[]>([]);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  const resetForm = () => {
    setStep(1);
    setSelectedClient("");
    setBatchName("");
    setBatchNotes("");
    setDispatchDate(undefined);
    setProductionMonth("");
    setBatchKits([]);
  };

  const handleAddKit = () => {
    setBatchKits([
      ...batchKits,
      {
        id: Math.random().toString(),
        programId: "",
        kitId: "",
        quantity: 1,
        grade: "",
        notes: "",
      },
    ]);
  };

  const handleRemoveKit = (id: string) => {
    setBatchKits(batchKits.filter((k) => k.id !== id));
  };

  const handleUpdateKit = (id: string, field: keyof BatchKit, value: any) => {
    setBatchKits(
      batchKits.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );
  };

  const handleNext = () => {
    if (step === 1 && !selectedClient) {
      toast.error("Please select a client");
      return;
    }
    if (step === 2 && batchKits.length === 0) {
      toast.error("Please add at least one kit");
      return;
    }
    if (step === 2) {
      const invalidKit = batchKits.find((k) => !k.kitId || k.quantity < 1);
      if (invalidKit) {
        toast.error("Please fill in all kit details");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreate = async () => {
    if (productionMonth && dispatchDate) {
      const prodMonth = new Date(productionMonth + "-01");
      const dispMonth = new Date(dispatchDate.getFullYear(), dispatchDate.getMonth(), 1);
      if (prodMonth > dispMonth) {
        toast.error("Production month must be before or same as dispatch month");
        return;
      }
    }

    try {
      await onCreateBatch({
        clientId: selectedClient as Id<"clients">,
        batchName: batchName || undefined,
        notes: batchNotes || undefined,
        dispatchDate: dispatchDate ? dispatchDate.getTime() : undefined,
        productionMonth: productionMonth || undefined,
        assignments: batchKits.map((k) => ({
          kitId: k.kitId as Id<"kits">,
          quantity: k.quantity,
          grade: k.grade && k.grade !== "none" ? k.grade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" : undefined,
          notes: k.notes || undefined,
        })),
      });
      toast.success("Batch assignment created successfully");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to create batch assignment");
      console.error(error);
    }
  };

  const selectedClientData = clients.find((c) => c._id === selectedClient);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Batch Assignment - Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Select the client for this batch"}
            {step === 2 && "Add kits to the batch"}
            {step === 3 && "Set common fields for all assignments"}
            {step === 4 && "Review and confirm the batch"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label>Client *</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {selectedClient ? selectedClientData?.organization || selectedClientData?.name : "Select Client"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search client..." />
                    <CommandList>
                      <CommandEmpty>No client found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client._id}
                            value={client.organization || client.name}
                            onSelect={() => {
                              setSelectedClient(client._id);
                              setClientPopoverOpen(false);
                            }}
                          >
                            {client.organization || client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Kits in Batch</Label>
                <Button onClick={handleAddKit} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Kit
                </Button>
              </div>

              {batchKits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No kits added yet. Click "Add Kit" to start.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Kit</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchKits.map((batchKit) => {
                      const filteredKits = batchKit.programId
                        ? kits.filter((k) => k.programId === batchKit.programId)
                        : [];
                      const selectedKit = kits.find((k) => k._id === batchKit.kitId);

                      return (
                        <TableRow key={batchKit.id}>
                          <TableCell>
                            <Select
                              value={batchKit.programId}
                              onValueChange={(val) => {
                                handleUpdateKit(batchKit.id, "programId", val);
                                handleUpdateKit(batchKit.id, "kitId", "");
                              }}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Program" />
                              </SelectTrigger>
                              <SelectContent>
                                {programs.map((p) => (
                                  <SelectItem key={p._id} value={p._id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={batchKit.kitId}
                              onValueChange={(val) => handleUpdateKit(batchKit.id, "kitId", val)}
                              disabled={!batchKit.programId}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Kit" />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredKits.map((k) => (
                                  <SelectItem key={k._id} value={k._id}>
                                    {k.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {selectedKit?.category || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={batchKit.quantity}
                              onChange={(e) =>
                                handleUpdateKit(batchKit.id, "quantity", parseInt(e.target.value))
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={batchKit.grade}
                              onValueChange={(val) => handleUpdateKit(batchKit.id, "grade", val)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue placeholder="Grade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                                  <SelectItem key={g} value={g.toString()}>
                                    {g}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={batchKit.notes}
                              onChange={(e) => handleUpdateKit(batchKit.id, "notes", e.target.value)}
                              placeholder="Notes..."
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveKit(batchKit.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Batch Name (Optional)</Label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Auto-generated if left empty"
                />
              </div>

              <div className="space-y-2">
                <Label>Dispatch Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dispatchDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dispatchDate ? format(dispatchDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dispatchDate} onSelect={setDispatchDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Production Month (Optional)</Label>
                <Input
                  type="month"
                  value={productionMonth}
                  onChange={(e) => setProductionMonth(e.target.value)}
                  placeholder="Select production month"
                />
              </div>

              <div className="space-y-2">
                <Label>Batch Notes (Optional)</Label>
                <Textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Notes for the entire batch..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <h4 className="font-semibold">Batch Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Client:</span>{" "}
                    <span className="font-medium">
                      {selectedClientData?.organization || selectedClientData?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Kits:</span>{" "}
                    <span className="font-medium">{batchKits.length}</span>
                  </div>
                  {batchName && (
                    <div>
                      <span className="text-muted-foreground">Batch Name:</span>{" "}
                      <span className="font-medium">{batchName}</span>
                    </div>
                  )}
                  {dispatchDate && (
                    <div>
                      <span className="text-muted-foreground">Dispatch Date:</span>{" "}
                      <span className="font-medium">{format(dispatchDate, "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  {productionMonth && (
                    <div>
                      <span className="text-muted-foreground">Production Month:</span>{" "}
                      <span className="font-medium">
                        {format(new Date(productionMonth + "-01"), "MMM yyyy")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Kit</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchKits.map((batchKit) => {
                    const program = programs.find((p) => p._id === batchKit.programId);
                    const kit = kits.find((k) => k._id === batchKit.kitId);

                    return (
                      <TableRow key={batchKit.id}>
                        <TableCell>{program?.name || "-"}</TableCell>
                        <TableCell>{kit?.name || "-"}</TableCell>
                        <TableCell>{kit?.category || "-"}</TableCell>
                        <TableCell>{batchKit.quantity}</TableCell>
                        <TableCell>{batchKit.grade || "-"}</TableCell>
                        <TableCell>{batchKit.notes || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleCreate}>Create Batch</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
