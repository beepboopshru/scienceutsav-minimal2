import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Edit2, Loader2, Plus, Trash2, CalendarIcon, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

export default function Assignments() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const assignments = useQuery(api.assignments.list);
  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);

  const createAssignment = useMutation(api.assignments.create);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const updateNotes = useMutation(api.assignments.updateNotes);
  const deleteAssignment = useMutation(api.assignments.deleteAssignment);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [packingDialogOpen, setPackingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

  // Form states
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedKit, setSelectedKit] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [grade, setGrade] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>(undefined);

  // Packing checklist states
  const [checkPouches, setCheckPouches] = useState(false);
  const [checkSpareKits, setCheckSpareKits] = useState(false);
  const [checkBulkMaterial, setCheckBulkMaterial] = useState(false);
  const [checkTools, setCheckTools] = useState(false);

  // Filter states
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterKit, setFilterKit] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");

  // Inline editing states
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesValue, setEditNotesValue] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !assignments || !programs || !kits || !clients) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  // Filter logic
  const filteredAssignments = assignments.filter((assignment) => {
    // Month filter
    if (filterMonth !== "all") {
      const assignmentDate = assignment.dispatchedAt || assignment._creationTime;
      const assignmentMonth = format(new Date(assignmentDate), "yyyy-MM");
      if (assignmentMonth !== filterMonth) return false;
    }

    // Status filter
    if (filterStatus !== "all" && assignment.status !== filterStatus) return false;

    // Kit filter
    if (filterKit !== "all" && assignment.kitId !== filterKit) return false;

    // Client filter
    if (filterClient !== "all" && assignment.clientId !== filterClient) return false;

    return true;
  });

  // Get unique months from assignments
  const uniqueMonths = Array.from(
    new Set(
      assignments.map((a) => {
        const date = a.dispatchedAt || a._creationTime;
        return format(new Date(date), "yyyy-MM");
      })
    )
  ).sort().reverse();

  // Get filtered kits by program
  const filteredKits = selectedProgram
    ? kits.filter((kit) => kit.programId === selectedProgram)
    : [];

  const selectedKitData = kits.find((k) => k._id === selectedKit);

  const handleCreateAssignment = async () => {
    if (!selectedKit || !selectedClient || !quantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createAssignment({
        kitId: selectedKit as Id<"kits">,
        clientId: selectedClient as Id<"clients">,
        quantity: parseInt(quantity),
        grade: grade && grade !== "none" ? grade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" : undefined,
        notes: notes || undefined,
        dispatchedAt: dispatchDate ? dispatchDate.getTime() : undefined,
      });

      toast.success("Assignment created successfully");
      setCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to create assignment");
      console.error(error);
    }
  };

  const resetForm = () => {
    setSelectedProgram("");
    setSelectedKit("");
    setSelectedClient("");
    setQuantity("1");
    setGrade("");
    setNotes("");
    setDispatchDate(undefined);
  };

  const handleOpenPackingDialog = (assignment: any) => {
    setSelectedAssignment(assignment);
    setCheckPouches(false);
    setCheckSpareKits(false);
    setCheckBulkMaterial(false);
    setCheckTools(false);
    setPackingDialogOpen(true);
  };

  const handleMarkAsPacked = async () => {
    if (!checkPouches || !checkSpareKits || !checkBulkMaterial || !checkTools) {
      toast.error("Please check all items before packing");
      return;
    }

    try {
      await updateStatus({
        id: selectedAssignment._id,
        status: "packed",
      });
      toast.success("Marked as packed");
      setPackingDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const handleDispatch = async (assignmentId: Id<"assignments">) => {
    try {
      await updateStatus({
        id: assignmentId,
        status: "dispatched",
      });
      toast.success("Assignment dispatched and inventory updated");
    } catch (error) {
      toast.error("Failed to dispatch assignment");
      console.error(error);
    }
  };

  const handleDeleteClick = (assignment: any) => {
    setSelectedAssignment(assignment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteAssignment({ id: selectedAssignment._id });
      toast.success(
        selectedAssignment.status === "dispatched"
          ? "Assignment deleted (stock not restored)"
          : "Assignment deleted and stock restored"
      );
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Failed to delete assignment");
      console.error(error);
    }
  };

  const handleStartEditNotes = (assignmentId: string, currentNotes: string) => {
    setEditingNotes(assignmentId);
    setEditNotesValue(currentNotes || "");
  };

  const handleSaveNotes = async (assignmentId: Id<"assignments">) => {
    try {
      await updateNotes({
        id: assignmentId,
        notes: editNotesValue,
      });
      setEditingNotes(null);
      toast.success("Notes updated");
    } catch (error) {
      toast.error("Failed to update notes");
      console.error(error);
    }
  };

  const handleCancelEditNotes = () => {
    setEditingNotes(null);
    setEditNotesValue("");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      assigned: "secondary",
      packed: "default",
      dispatched: "outline",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
            <p className="text-muted-foreground mt-2">
              Manage kit assignments, track packing status, and monitor material shortages
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {uniqueMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {format(new Date(month + "-01"), "MMMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="packed">Packed</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kit</Label>
              <Select value={filterKit} onValueChange={setFilterKit}>
                <SelectTrigger>
                  <SelectValue placeholder="All Kits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Kits</SelectItem>
                  {kits.map((kit) => (
                    <SelectItem key={kit._id} value={kit._id}>
                      {kit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger>
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Results</Label>
              <div className="h-10 flex items-center text-sm text-muted-foreground">
                Showing {filteredAssignments.length} of {assignments.length}
              </div>
            </div>
          </div>
        </Card>

        {/* Assignments Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kit</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispatch Date</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No assignments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment, index) => (
                  <motion.tr
                    key={assignment._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      {assignment.kit?.name || "Unknown Kit"}
                    </TableCell>
                    <TableCell>
                      <div>
                        {assignment.client?.organization && (
                          <div className="text-sm text-muted-foreground">
                            {assignment.client.organization}
                          </div>
                        )}
                        <div className="font-medium">{assignment.client?.name || "Unknown"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{assignment.quantity}</TableCell>
                    <TableCell>{assignment.grade || "-"}</TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                    <TableCell>
                      {assignment.dispatchedAt
                        ? format(new Date(assignment.dispatchedAt), "MMM dd, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {editingNotes === assignment._id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editNotesValue}
                            onChange={(e) => setEditNotesValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveNotes(assignment._id);
                              if (e.key === "Escape") handleCancelEditNotes();
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSaveNotes(assignment._id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={handleCancelEditNotes}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => handleStartEditNotes(assignment._id, assignment.notes || "")}
                        >
                          <span className="text-sm">{assignment.notes || "Add notes..."}</span>
                          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {assignment.status === "packed" && (
                          <Button
                            size="sm"
                            onClick={() => handleDispatch(assignment._id)}
                          >
                            Dispatch
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteClick(assignment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Create Assignment Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
              <DialogDescription>
                Assign a kit to a client. Stock will be deducted immediately.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Program *</Label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program._id} value={program._id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kit *</Label>
                <Select
                  value={selectedKit}
                  onValueChange={setSelectedKit}
                  disabled={!selectedProgram}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select kit" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredKits.map((kit) => (
                      <SelectItem key={kit._id} value={kit._id}>
                        {kit.name} (Stock: {kit.stockCount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedKitData && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {selectedKitData.spareKits && selectedKitData.spareKits.length > 0 && (
                      <div>Spare Kits: {selectedKitData.spareKits.length} items</div>
                    )}
                    {selectedKitData.bulkMaterials && selectedKitData.bulkMaterials.length > 0 && (
                      <div>Bulk Materials: {selectedKitData.bulkMaterials.length} items</div>
                    )}
                    {selectedKitData.miscellaneous && selectedKitData.miscellaneous.length > 0 && (
                      <div>Miscellaneous: {selectedKitData.miscellaneous.length} items</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client._id} value={client._id}>
                        {client.organization && `${client.organization} - `}
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Grade (Optional)</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="No Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grade</SelectItem>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        Grade {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <Calendar
                      mode="single"
                      selected={dispatchDate}
                      onSelect={setDispatchDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Packing instructions, delivery notes, etc."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment}>Create Assignment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Packing Checklist Dialog */}
        <Dialog open={packingDialogOpen} onOpenChange={setPackingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Packing Checklist</DialogTitle>
              <DialogDescription>
                Check off all items before marking as packed
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pouches"
                  checked={checkPouches}
                  onCheckedChange={(checked) => setCheckPouches(checked as boolean)}
                />
                <label
                  htmlFor="pouches"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Pouches
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="spareKits"
                  checked={checkSpareKits}
                  onCheckedChange={(checked) => setCheckSpareKits(checked as boolean)}
                />
                <label
                  htmlFor="spareKits"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Spare Kits
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bulkMaterial"
                  checked={checkBulkMaterial}
                  onCheckedChange={(checked) => setCheckBulkMaterial(checked as boolean)}
                />
                <label
                  htmlFor="bulkMaterial"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Bulk Material
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tools"
                  checked={checkTools}
                  onCheckedChange={(checked) => setCheckTools(checked as boolean)}
                />
                <label
                  htmlFor="tools"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Tools
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPackingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleMarkAsPacked}
                disabled={!checkPouches || !checkSpareKits || !checkBulkMaterial || !checkTools}
              >
                Mark as Packed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedAssignment?.status === "dispatched"
                  ? "This assignment is dispatched. Stock will NOT be restored. Delete anyway?"
                  : "Delete this assignment? Stock will be restored to the kit."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}