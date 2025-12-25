import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
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
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel";

export type BatchRow = {
  id: string;
  assignmentId?: Id<"assignments">; // For edit mode
  program: string;
  kit: string;
  quantity: string;
  grade: string;
  notes: string;
};

export type InlineBatchData = {
  id: string;
  batchId: string;
  client: string;
  clientName: string;
  batchName: string;
  dispatchDate: Date | undefined;
  productionMonth: string;
  batchNotes: string;
  rows: BatchRow[];
  mode: "create" | "edit";
  originalBatchId?: Id<"batches">; // For edit mode
};

interface InlineBatchEditorProps {
  batch: InlineBatchData;
  clients: Array<any>;
  programs: Array<any>;
  kits: Array<any>;
  columnVisibility: Record<string, boolean>;
  onUpdateMetadata: (batchId: string, field: string, value: any) => void;
  onUpdateRow: (batchId: string, rowId: string, field: string, value: any) => void;
  onAddRow: (batchId: string) => void;
  onRemoveRow: (batchId: string, rowId: string) => void;
  onSave: (batchId: string) => void;
  onCancel: (batchId: string) => void;
}

export function InlineBatchEditor({
  batch,
  clients,
  programs,
  kits,
  columnVisibility,
  onUpdateMetadata,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onSave,
  onCancel,
}: InlineBatchEditorProps) {
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  return (
    <>
      {/* Batch Info Panel Row */}
      <TableRow className="bg-muted/70 border-b-2 border-border">
        <TableCell colSpan={13}>
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {batch.batchId || "Select client to generate Batch ID"}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {batch.mode === "edit" ? "Batch Edit Mode" : "Batch Creation Mode"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onSave(batch.id)}
                  disabled={!batch.client || batch.rows.length === 0}
                >
                  {batch.mode === "edit" ? "Update Batch" : "Save Batch"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(batch.id)}
                >
                  Cancel
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={batch.mode === "edit"} // Can't change client in edit mode
                    >
                      {batch.client
                        ? (() => {
                            const selectedClient = clients?.find((c) => c._id === batch.client);
                            return selectedClient?.organization || selectedClient?.name || "Unknown Client";
                          })()
                        : "Select Client"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search client..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {clients?.map((client) => (
                            <CommandItem
                              key={client._id}
                              value={client.organization || client.name}
                              onSelect={() => {
                                onUpdateMetadata(batch.id, "client", client._id);
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

              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={batch.batchName}
                  onChange={(e) => onUpdateMetadata(batch.id, "batchName", e.target.value)}
                  placeholder="Auto-generated"
                  disabled={!batch.client}
                />
              </div>

              <div className="space-y-2">
                <Label>Dispatch Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={!batch.client}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {batch.dispatchDate
                        ? format(batch.dispatchDate, "MMM dd, yyyy")
                        : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={batch.dispatchDate}
                      onSelect={(date) => onUpdateMetadata(batch.id, "dispatchDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Production Month</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={!batch.client}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {batch.productionMonth
                        ? format(new Date(batch.productionMonth + "-01"), "MMMM yyyy")
                        : "Pick month"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <div className="p-3 space-y-2">
                      <Select
                        value={batch.productionMonth ? batch.productionMonth.split("-")[1] : ""}
                        onValueChange={(month) => {
                          const year = batch.productionMonth
                            ? batch.productionMonth.split("-")[0]
                            : new Date().getFullYear().toString();
                          onUpdateMetadata(batch.id, "productionMonth", `${year}-${month}`);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={m.toString().padStart(2, "0")}>
                              {format(new Date(2000, m - 1, 1), "MMMM")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={batch.productionMonth ? batch.productionMonth.split("-")[0] : ""}
                        onValueChange={(year) => {
                          const month = batch.productionMonth ? batch.productionMonth.split("-")[1] : "01";
                          onUpdateMetadata(batch.id, "productionMonth", `${year}-${month}`);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Batch Notes</Label>
              <Textarea
                value={batch.batchNotes}
                onChange={(e) => onUpdateMetadata(batch.id, "batchNotes", e.target.value)}
                placeholder="Notes for this batch..."
                rows={2}
                disabled={!batch.client}
              />
            </div>
          </div>
        </TableCell>
      </TableRow>

      {/* Batch Assignment Rows */}
      {batch.rows.map((row) => {
        const filteredKits = row.program ? kits.filter((k) => k.programId === row.program) : [];
        const selectedKit = kits.find((k) => k._id === row.kit);

        return (
          <TableRow key={row.id} className="bg-muted/70">
            <TableCell>
              <Badge variant="outline">{batch.batchId || "-"}</Badge>
            </TableCell>
            {columnVisibility.program && (
              <TableCell>
                <Select
                  value={row.program}
                  onValueChange={(val) => {
                    onUpdateRow(batch.id, row.id, "program", val);
                    onUpdateRow(batch.id, row.id, "kit", "");
                  }}
                  disabled={!batch.client}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs?.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            )}
            {columnVisibility.kit && (
              <TableCell>
                <Select
                  value={row.kit}
                  onValueChange={(val) => onUpdateRow(batch.id, row.id, "kit", val)}
                  disabled={!row.program || !batch.client}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Kit" />
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
            )}
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {selectedKit?.category || "-"}
              </span>
            </TableCell>
            {columnVisibility.client && (
              <TableCell>
                <span className="text-sm">
                  {(() => {
                    const client = clients?.find((c) => c._id === batch.client);
                    return client?.organization || client?.name || "-";
                  })()}
                </span>
              </TableCell>
            )}
            {columnVisibility.quantity && (
              <TableCell>
                <Input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => onUpdateRow(batch.id, row.id, "quantity", e.target.value)}
                  className="w-20"
                  disabled={!batch.client}
                />
              </TableCell>
            )}
            {columnVisibility.grade && (
              <TableCell>
                <Select
                  value={row.grade}
                  onValueChange={(val) => onUpdateRow(batch.id, row.id, "grade", val)}
                  disabled={!batch.client}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            )}
            {columnVisibility.status && (
              <TableCell>
                <Badge variant="outline">Draft</Badge>
              </TableCell>
            )}
            {columnVisibility.dispatchDate && (
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {batch.dispatchDate ? format(batch.dispatchDate, "MMM dd, yyyy") : "-"}
                </span>
              </TableCell>
            )}
            {columnVisibility.productionMonth && (
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {batch.productionMonth
                    ? format(new Date(batch.productionMonth + "-01"), "MMM yyyy")
                    : "-"}
                </span>
              </TableCell>
            )}
            <TableCell>-</TableCell>
            {columnVisibility.notes && (
              <TableCell>
                <Input
                  value={row.notes}
                  onChange={(e) => onUpdateRow(batch.id, row.id, "notes", e.target.value)}
                  placeholder="Notes..."
                  disabled={!batch.client}
                />
              </TableCell>
            )}
            <TableCell className="text-right">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemoveRow(batch.id, row.id)}
                disabled={!batch.client}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        );
      })}

      {/* Add Row Button */}
      <TableRow className="bg-muted/70">
        <TableCell colSpan={13} className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddRow(batch.id)}
            disabled={!batch.client}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Kit to Batch
          </Button>
        </TableCell>
      </TableRow>
    </>
  );
}
