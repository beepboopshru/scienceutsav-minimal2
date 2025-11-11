import React from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Edit2, Loader2, Plus, Trash2, CalendarIcon, Check, X, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { BatchAssignmentDialog } from "@/components/assignments/BatchAssignmentDialog";

export default function Assignments() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const assignments = useQuery(api.assignments.list);
  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const clients = useQuery(api.clients.list);
  const batches = useQuery(api.batches.list);

  const createAssignment = useMutation(api.assignments.create);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const updateNotes = useMutation(api.assignments.updateNotes);
  const deleteAssignment = useMutation(api.assignments.deleteAssignment);
  const createBatch = useMutation(api.batches.create);
  const deleteBatch = useMutation(api.batches.deleteBatch);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [packingDialogOpen, setPackingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Form states for dialog
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedKit, setSelectedKit] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [grade, setGrade] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>(undefined);
  const [productionMonth, setProductionMonth] = useState<string>("");

  // Packing checklist states
  const [checkPouches, setCheckPouches] = useState(false);
  const [checkSpareKits, setCheckSpareKits] = useState(false);
  const [checkBulkMaterial, setCheckBulkMaterial] = useState(false);
  const [checkTools, setCheckTools] = useState(false);

  // Filter states
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);

  // Inline editing states
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesValue, setEditNotesValue] = useState<string>("");

  // Inline row creation states
  const [isAddingNewRow, setIsAddingNewRow] = useState(false);
  const [newRowProgram, setNewRowProgram] = useState<string>("");
  const [newRowKit, setNewRowKit] = useState<string>("");
  const [newRowClient, setNewRowClient] = useState<string>("");
  const [newRowQuantity, setNewRowQuantity] = useState<string>("1");
  const [newRowGrade, setNewRowGrade] = useState<string>("");
  const [newRowDispatchDate, setNewRowDispatchDate] = useState<Date | undefined>(undefined);
  const [newRowNotes, setNewRowNotes] = useState<string>("");
  const [newRowProductionMonth, setNewRowProductionMonth] = useState<string>("");

  // Batch creation states
  type BatchRow = {
    id: string;
    program: string;
    kit: string;
    quantity: string;
    grade: string;
    notes: string;
  };

  type BatchInProgress = {
    id: string;
    batchId: string;
    client: string;
    batchName: string;
    dispatchDate: Date | undefined;
    productionMonth: string;
    batchNotes: string;
    rows: BatchRow[];
  };

  const [batchesInProgress, setBatchesInProgress] = useState<BatchInProgress[]>([]);

  // Popover states for inline editing
  const [programPopoverOpen, setProgramPopoverOpen] = useState(false);
  const [kitPopoverOpen, setKitPopoverOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [dispatchDatePopoverOpen, setDispatchDatePopoverOpen] = useState(false);
  
  // Popover states for batch creation
  const [batchClientPopoverOpen, setBatchClientPopoverOpen] = useState<Record<string, boolean>>({});

  // Edit mode states
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editRowProgram, setEditRowProgram] = useState<string>("");
  const [editRowKit, setEditRowKit] = useState<string>("");
  const [editRowClient, setEditRowClient] = useState<string>("");
  const [editRowQuantity, setEditRowQuantity] = useState<string>("1");
  const [editRowGrade, setEditRowGrade] = useState<string>("");
  const [editRowDispatchDate, setEditRowDispatchDate] = useState<Date | undefined>(undefined);
  const [editRowNotes, setEditRowNotes] = useState<string>("");
  const [editRowProductionMonth, setEditRowProductionMonth] = useState<string>("");

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
    // Program filter
    if (selectedPrograms.length > 0) {
      const kit = kits.find((k) => k._id === assignment.kitId);
      if (!kit || !selectedPrograms.includes(kit.programId)) return false;
    }

    // Category filter
    if (selectedCategories.length > 0) {
      const kit = kits.find((k) => k._id === assignment.kitId);
      if (!kit || !kit.category || !selectedCategories.includes(kit.category)) return false;
    }

    // Kit filter
    if (selectedKits.length > 0 && !selectedKits.includes(assignment.kitId)) return false;

    // Client filter
    if (selectedClients.length > 0 && !selectedClients.includes(assignment.clientId)) return false;

    // Dispatch month filter
    if (selectedDispatchMonths.length > 0) {
      const assignmentDate = assignment.dispatchedAt || assignment._creationTime;
      const assignmentMonth = format(new Date(assignmentDate), "yyyy-MM");
      if (!selectedDispatchMonths.includes(assignmentMonth)) return false;
    }

    // Status filter
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(assignment.status)) return false;

    // Production month filter
    if (selectedProductionMonths.length > 0) {
      if (!assignment.productionMonth || !selectedProductionMonths.includes(assignment.productionMonth)) return false;
    }

    return true;
  });

  const uniqueMonths = Array.from(
    new Set(
      assignments.map((a) => {
        const date = a.dispatchedAt || a._creationTime;
        return format(new Date(date), "yyyy-MM");
      })
    )
  ).sort().reverse();

  const uniqueProductionMonths = Array.from(
    new Set(
      assignments
        .filter((a) => a.productionMonth)
        .map((a) => a.productionMonth!)
    )
  ).sort().reverse();

  const filteredKits = selectedProgram
    ? kits.filter((kit) => kit.programId === selectedProgram)
    : [];

  const selectedKitData = kits.find((k) => k._id === selectedKit);

  // Get filtered kits for new row
  const newRowFilteredKits = newRowProgram
    ? kits.filter((kit) => kit.programId === newRowProgram)
    : [];

  const newRowSelectedKit = kits.find((k) => k._id === newRowKit);

  // Get filtered kits for edit row
  const editRowFilteredKits = editRowProgram
    ? kits.filter((kit) => kit.programId === editRowProgram)
    : [];

  const editRowSelectedKit = kits.find((k) => k._id === editRowKit);

  // Group assignments by batch
  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    const batchId = assignment.batchId || "standalone";
    if (!acc[batchId]) {
      acc[batchId] = [];
    }
    acc[batchId].push(assignment);
    return acc;
  }, {} as Record<string, typeof filteredAssignments>);

  const handleCreateAssignment = async () => {
    if (!selectedKit || !selectedClient || !quantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate production month vs dispatch date
    if (productionMonth && dispatchDate) {
      const prodMonth = new Date(productionMonth + "-01");
      const dispMonth = new Date(dispatchDate.getFullYear(), dispatchDate.getMonth(), 1);
      if (prodMonth > dispMonth) {
        toast.error("Production month must be before or same as dispatch month");
        return;
      }
    }

    try {
      await createAssignment({
        kitId: selectedKit as Id<"kits">,
        clientId: selectedClient as Id<"clients">,
        quantity: parseInt(quantity),
        grade: grade && grade !== "none" ? grade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" : undefined,
        notes: notes || undefined,
        dispatchedAt: dispatchDate ? dispatchDate.getTime() : undefined,
        productionMonth: productionMonth || undefined,
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
    setProductionMonth("");
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

  const handleAddNewRow = () => {
    setIsAddingNewRow(true);
    setNewRowProgram("");
    setNewRowKit("");
    setNewRowClient("");
    setNewRowQuantity("1");
    setNewRowGrade("");
    setNewRowDispatchDate(undefined);
    setNewRowNotes("");
    setNewRowProductionMonth("");
  };

  const handleStartBatch = () => {
    const newBatchId = `BATCH-${Date.now()}`;
    const newBatch: BatchInProgress = {
      id: newBatchId,
      batchId: "", // Will be generated after client selection
      client: "",
      batchName: "",
      dispatchDate: undefined,
      productionMonth: "",
      batchNotes: "",
      rows: [
        {
          id: `row-${Date.now()}`,
          program: "",
          kit: "",
          quantity: "1",
          grade: "",
          notes: "",
        },
      ],
    };
    setBatchesInProgress([...batchesInProgress, newBatch]);
  };

  const handleCancelBatch = (batchId: string) => {
    if (confirm("Discard this batch? All unsaved assignments will be lost.")) {
      setBatchesInProgress(batchesInProgress.filter((b) => b.id !== batchId));
    }
  };

  const handleAddRowToBatch = (batchId: string) => {
    setBatchesInProgress(
      batchesInProgress.map((batch) =>
        batch.id === batchId
          ? {
              ...batch,
              rows: [
                ...batch.rows,
                {
                  id: `row-${Date.now()}`,
                  program: "",
                  kit: "",
                  quantity: "1",
                  grade: "",
                  notes: "",
                },
              ],
            }
          : batch
      )
    );
  };

  const handleRemoveRowFromBatch = (batchId: string, rowId: string) => {
    setBatchesInProgress(
      batchesInProgress.map((batch) =>
        batch.id === batchId
          ? {
              ...batch,
              rows: batch.rows.filter((r) => r.id !== rowId),
            }
          : batch
      )
    );
  };

  const handleUpdateBatchRow = (batchId: string, rowId: string, field: keyof BatchRow, value: string) => {
    setBatchesInProgress(
      batchesInProgress.map((batch) =>
        batch.id === batchId
          ? {
              ...batch,
              rows: batch.rows.map((row) =>
                row.id === rowId ? { ...row, [field]: value } : row
              ),
            }
          : batch
      )
    );
  };

  const handleUpdateBatchMetadata = (batchId: string, field: string, value: any) => {
    setBatchesInProgress(
      batchesInProgress.map((batch) =>
        batch.id === batchId ? { ...batch, [field]: value } : batch
      )
    );
  };

  const generateBatchId = (clientId: string) => {
    const client = clients?.find((c) => c._id === clientId);
    if (!client) return "";

    const organization = client.organization || client.name;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Extract initials
    const words = organization.trim().split(/\s+/);
    let initials = "";
    if (words.length === 1) {
      initials = words[0].charAt(0).toUpperCase();
    } else {
      initials = words
        .map((word) => word.charAt(0).toUpperCase())
        .filter((char) => /[A-Z]/.test(char))
        .join("");
    }

    // Find existing batches with same base
    const baseBatchId = `${initials}-${year}-${month.toString().padStart(2, "0")}`;
    const existingBatches = batches?.filter((b) => b.batchId.startsWith(baseBatchId)) || [];
    
    const sequenceNumbers = existingBatches
      .map((b) => {
        const parts = b.batchId.split("-");
        if (parts.length === 4) {
          return parseInt(parts[3]);
        }
        return 0;
      })
      .filter((num) => !isNaN(num));

    const maxSequence = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0;
    const nextSequence = maxSequence + 1;

    return `${baseBatchId}-${nextSequence.toString().padStart(3, "0")}`;
  };

  const handleSaveBatch = async (batchId: string) => {
    const batch = batchesInProgress.find((b) => b.id === batchId);
    if (!batch) return;

    if (!batch.client) {
      toast.error("Please select a client for this batch");
      return;
    }

    const validRows = batch.rows.filter((row) => row.kit && row.quantity);
    if (validRows.length === 0) {
      toast.error("Please add at least one kit to this batch");
      return;
    }

    try {
      await createBatch({
        clientId: batch.client as Id<"clients">,
        batchName: batch.batchName || batch.batchId,
        notes: batch.batchNotes || undefined,
        dispatchDate: batch.dispatchDate ? batch.dispatchDate.getTime() : undefined,
        productionMonth: batch.productionMonth || undefined,
        assignments: validRows.map((row) => ({
          kitId: row.kit as Id<"kits">,
          quantity: parseInt(row.quantity),
          grade: row.grade && row.grade !== "none" ? row.grade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" : undefined,
          notes: row.notes || undefined,
        })),
      });

      toast.success("Batch created successfully");
      setBatchesInProgress(batchesInProgress.filter((b) => b.id !== batchId));
    } catch (error) {
      toast.error("Failed to create batch");
      console.error(error);
    }
  };

  const handleSaveNewRow = async () => {
    if (!newRowKit || !newRowClient || !newRowQuantity) {
      toast.error("Please fill in Program, Kit, Client, and Quantity");
      return;
    }

    // Validate production month vs dispatch date
    if (newRowProductionMonth && newRowDispatchDate) {
      const prodMonth = new Date(newRowProductionMonth + "-01");
      const dispMonth = new Date(newRowDispatchDate.getFullYear(), newRowDispatchDate.getMonth(), 1);
      if (prodMonth > dispMonth) {
        toast.error("Production month must be before or same as dispatch month");
        return;
      }
    }

    try {
      await createAssignment({
        kitId: newRowKit as Id<"kits">,
        clientId: newRowClient as Id<"clients">,
        quantity: parseInt(newRowQuantity),
        grade: newRowGrade && newRowGrade !== "none" ? newRowGrade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" : undefined,
        notes: newRowNotes || undefined,
        dispatchedAt: newRowDispatchDate ? newRowDispatchDate.getTime() : undefined,
        productionMonth: newRowProductionMonth || undefined,
      });

      toast.success("Assignment created successfully");
      setIsAddingNewRow(false);
    } catch (error) {
      toast.error("Failed to create assignment");
      console.error(error);
    }
  };

  const handleCancelNewRow = () => {
    setIsAddingNewRow(false);
  };

  const handleStartEditRow = (assignment: any) => {
    setEditingAssignmentId(assignment._id);
    setEditRowProgram(assignment.kit?.programId || "");
    setEditRowKit(assignment.kitId);
    setEditRowClient(assignment.clientId);
    setEditRowQuantity(assignment.quantity.toString());
    setEditRowGrade(assignment.grade || "");
    setEditRowDispatchDate(assignment.dispatchedAt ? new Date(assignment.dispatchedAt) : undefined);
    setEditRowNotes(assignment.notes || "");
    setEditRowProductionMonth(assignment.productionMonth || "");
  };

  const handleSaveEditRow = async (assignmentId: Id<"assignments">) => {
    if (!editRowKit || !editRowClient || !editRowQuantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate production month vs dispatch date
    if (editRowProductionMonth && editRowDispatchDate) {
      const prodMonth = new Date(editRowProductionMonth + "-01");
      const dispMonth = new Date(editRowDispatchDate.getFullYear(), editRowDispatchDate.getMonth(), 1);
      if (prodMonth > dispMonth) {
        toast.error("Production month must be before or same as dispatch month");
        return;
      }
    }

    try {
      // Note: You'll need to create an update mutation in assignments.ts
      // For now, we'll delete and recreate
      await deleteAssignment({ id: assignmentId });
      await createAssignment({
        kitId: editRowKit as Id<"kits">,
        clientId: editRowClient as Id<"clients">,
        quantity: parseInt(editRowQuantity),
        grade: editRowGrade && editRowGrade !== "none" ? editRowGrade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" : undefined,
        notes: editRowNotes || undefined,
        dispatchedAt: editRowDispatchDate ? editRowDispatchDate.getTime() : undefined,
        productionMonth: editRowProductionMonth || undefined,
      });

      toast.success("Assignment updated successfully");
      setEditingAssignmentId(null);
    } catch (error) {
      toast.error("Failed to update assignment");
      console.error(error);
    }
  };

  const handleCancelEditRow = () => {
    setEditingAssignmentId(null);
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

  const handleClearAllFilters = () => {
    setSelectedPrograms([]);
    setSelectedCategories([]);
    setSelectedKits([]);
    setSelectedClients([]);
    setSelectedDispatchMonths([]);
    setSelectedStatuses([]);
    setSelectedProductionMonths([]);
  };

  const handleCreateBatch = async (data: any) => {
    await createBatch(data);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to delete this entire batch?")) return;
    try {
      await deleteBatch({ id: batchId as Id<"batches"> });
      toast.success("Batch deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete batch");
    }
  };

  const toggleBatchExpand = (batchId: string) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedBatches(newExpanded);
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
          <div className="flex gap-2">
            <Button 
              onClick={handleAddNewRow} 
              variant="outline" 
              disabled={isAddingNewRow || batchesInProgress.length > 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Assignment
            </Button>
            <Button onClick={handleStartBatch} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Start Batch
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Assignment
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <AssignmentFilters
          programs={programs}
          kits={kits}
          clients={clients}
          assignments={filteredAssignments}
          selectedPrograms={selectedPrograms}
          selectedCategories={selectedCategories}
          selectedKits={selectedKits}
          selectedClients={selectedClients}
          selectedDispatchMonths={selectedDispatchMonths}
          selectedStatuses={selectedStatuses}
          selectedProductionMonths={selectedProductionMonths}
          onProgramsChange={setSelectedPrograms}
          onCategoriesChange={setSelectedCategories}
          onKitsChange={setSelectedKits}
          onClientsChange={setSelectedClients}
          onDispatchMonthsChange={setSelectedDispatchMonths}
          onStatusesChange={setSelectedStatuses}
          onProductionMonthsChange={setSelectedProductionMonths}
          onClearAll={handleClearAllFilters}
        />

        {/* Assignments Table with Batch Grouping */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispatch Date</TableHead>
                <TableHead>Production Month</TableHead>
                <TableHead>Order Created On</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Batch Creation Rows */}
              {batchesInProgress.map((batch) => (
                <React.Fragment key={batch.id}>
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
                              Batch Creation Mode
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveBatch(batch.id)}
                              disabled={!batch.client || batch.rows.length === 0}
                            >
                              Save Batch
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelBatch(batch.id)}
                            >
                              Cancel Batch
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Client *</Label>
                            <Popover 
                              open={batchClientPopoverOpen[batch.id] || false}
                              onOpenChange={(open) => 
                                setBatchClientPopoverOpen({ ...batchClientPopoverOpen, [batch.id]: open })
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
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
                                            handleUpdateBatchMetadata(batch.id, "client", client._id);
                                            const generatedBatchId = generateBatchId(client._id);
                                            handleUpdateBatchMetadata(batch.id, "batchId", generatedBatchId);
                                            handleUpdateBatchMetadata(batch.id, "batchName", generatedBatchId);
                                            setBatchClientPopoverOpen({ ...batchClientPopoverOpen, [batch.id]: false });
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
                              onChange={(e) =>
                                handleUpdateBatchMetadata(batch.id, "batchName", e.target.value)
                              }
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
                                  onSelect={(date) =>
                                    handleUpdateBatchMetadata(batch.id, "dispatchDate", date)
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-2">
                            <Label>Production Month</Label>
                            <Input
                              type="month"
                              value={batch.productionMonth}
                              onChange={(e) =>
                                handleUpdateBatchMetadata(batch.id, "productionMonth", e.target.value)
                              }
                              disabled={!batch.client}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Batch Notes</Label>
                          <Textarea
                            value={batch.batchNotes}
                            onChange={(e) =>
                              handleUpdateBatchMetadata(batch.id, "batchNotes", e.target.value)
                            }
                            placeholder="Notes for this batch..."
                            rows={2}
                            disabled={!batch.client}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Batch Assignment Rows */}
                  {batch.rows.map((row, rowIndex) => (
                    <TableRow key={row.id} className="bg-muted/70">
                      <TableCell>
                        <Badge variant="outline">{batch.batchId || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.program}
                          onValueChange={(val) => {
                            handleUpdateBatchRow(batch.id, row.id, "program", val);
                            handleUpdateBatchRow(batch.id, row.id, "kit", "");
                          }}
                          disabled={!batch.client}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Program" />
                          </SelectTrigger>
                          <SelectContent>
                            {programs?.map((program) => (
                              <SelectItem key={program._id} value={program._id}>
                                {program.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.kit}
                          onValueChange={(val) => handleUpdateBatchRow(batch.id, row.id, "kit", val)}
                          disabled={!row.program || !batch.client}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Kit" />
                          </SelectTrigger>
                          <SelectContent>
                            {kits
                              ?.filter((kit) => kit.programId === row.program)
                              .map((kit) => (
                                <SelectItem key={kit._id} value={kit._id}>
                                  {kit.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {kits?.find((k) => k._id === row.kit)?.category || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {batch.client
                            ? clients?.find((c) => c._id === batch.client)?.organization ||
                              clients?.find((c) => c._id === batch.client)?.name
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdateBatchRow(batch.id, row.id, "quantity", e.target.value)
                          }
                          className="w-20"
                          disabled={!batch.client}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.grade}
                          onValueChange={(val) => handleUpdateBatchRow(batch.id, row.id, "grade", val)}
                          disabled={!batch.client}
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
                        <Badge variant="secondary">Assigned</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {batch.dispatchDate ? format(batch.dispatchDate, "MMM dd, yyyy") : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {batch.productionMonth
                            ? format(new Date(batch.productionMonth + "-01"), "MMM yyyy")
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">-</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.notes}
                          onChange={(e) =>
                            handleUpdateBatchRow(batch.id, row.id, "notes", e.target.value)
                          }
                          placeholder="Notes..."
                          disabled={!batch.client}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveRowFromBatch(batch.id, row.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Add Another Kit Row */}
                  <TableRow className="bg-muted/70">
                    <TableCell colSpan={13} className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddRowToBatch(batch.id)}
                        disabled={!batch.client}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Another Kit
                      </Button>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}

              {/* New Row for inline creation */}
              {isAddingNewRow && (
                <TableRow className="bg-muted/50">
                  <TableCell>
                    <Popover open={programPopoverOpen} onOpenChange={setProgramPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {newRowProgram ? programs.find(p => p._id === newRowProgram)?.name : "Select Program"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search program..." />
                          <CommandList>
                            <CommandEmpty>No program found.</CommandEmpty>
                            <CommandGroup>
                              {programs.map((program) => (
                                <CommandItem
                                  key={program._id}
                                  value={program.name}
                                  onSelect={() => {
                                    setNewRowProgram(program._id);
                                    setNewRowKit("");
                                    setProgramPopoverOpen(false);
                                  }}
                                >
                                  {program.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Popover open={kitPopoverOpen} onOpenChange={setKitPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={!newRowProgram}>
                          {newRowKit ? kits.find(k => k._id === newRowKit)?.name : "Select Kit"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search kit..." />
                          <CommandList>
                            <CommandEmpty>No kit found.</CommandEmpty>
                            <CommandGroup>
                              {newRowFilteredKits.map((kit) => (
                                <CommandItem
                                  key={kit._id}
                                  value={kit.name}
                                  onSelect={() => {
                                    setNewRowKit(kit._id);
                                    setKitPopoverOpen(false);
                                  }}
                                >
                                  {kit.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {newRowSelectedKit?.category || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {newRowClient ? clients.find(c => c._id === newRowClient)?.name : "Select Client"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
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
                                    setNewRowClient(client._id);
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
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={newRowQuantity}
                      onChange={(e) => setNewRowQuantity(e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={newRowGrade} onValueChange={setNewRowGrade}>
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
                    <Badge variant="secondary">Assigned</Badge>
                  </TableCell>
                  <TableCell>
                    <Popover open={dispatchDatePopoverOpen} onOpenChange={setDispatchDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newRowDispatchDate ? format(newRowDispatchDate, "MMM dd, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newRowDispatchDate}
                          onSelect={(date) => {
                            setNewRowDispatchDate(date);
                            setDispatchDatePopoverOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="month"
                      value={newRowProductionMonth}
                      onChange={(e) => setNewRowProductionMonth(e.target.value)}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newRowNotes}
                      onChange={(e) => setNewRowNotes(e.target.value)}
                      placeholder="Notes..."
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="ghost" onClick={handleSaveNewRow}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleCancelNewRow}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {filteredAssignments.length === 0 && !isAddingNewRow ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground">
                    No assignments found
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedAssignments).map(([batchId, batchAssignments]) => {
                  const batch = batches?.find((b) => b._id === batchId);
                  const isExpanded = expandedBatches.has(batchId);
                  const isBatch = batchId !== "standalone";

                  if (isBatch && batch) {
                    const statusCounts = batchAssignments.reduce((acc, a) => {
                      acc[a.status] = (acc[a.status] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    const statusSummary = Object.entries(statusCounts)
                      .map(([status, count]) => `${count} ${status}`)
                      .join(", ");

                    return (
                      <React.Fragment key={`batch-group-${batchId}`}>
                        {/* Batch Header Row */}
                        <TableRow key={`batch-${batchId}`} className="bg-muted/50 font-semibold">
                          <TableCell colSpan={13}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleBatchExpand(batchId)}
                                >
                                  {isExpanded ? "▼" : "▶"}
                                </Button>
                                <Badge variant="outline">{batch.batchId}</Badge>
                                <span>{batch.client?.organization || batch.client?.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  ({batchAssignments.length} assignments: {statusSummary})
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBatch(batchId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Batch Assignment Rows */}
                        {isExpanded &&
                          batchAssignments.map((assignment, index) => (
                            <motion.tr
                              key={assignment._id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className="hover:bg-muted/50"
                            >
                              <TableCell></TableCell>
                              {editingAssignmentId === assignment._id ? (
                                <>
                                  {/* Edit mode */}
                                  <TableCell>
                                    <Select value={editRowProgram} onValueChange={(val) => {
                                      setEditRowProgram(val);
                                      setEditRowKit("");
                                    }}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {programs.map((program) => (
                                          <SelectItem key={program._id} value={program._id}>
                                            {program.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select value={editRowKit} onValueChange={setEditRowKit} disabled={!editRowProgram}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {editRowFilteredKits.map((kit) => (
                                          <SelectItem key={kit._id} value={kit._id}>
                                            {kit.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-muted-foreground">
                                      {editRowSelectedKit?.category || "-"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Select value={editRowClient} onValueChange={setEditRowClient}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {clients.map((client) => (
                                          <SelectItem key={client._id} value={client._id}>
                                            {client.organization || client.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={editRowQuantity}
                                      onChange={(e) => setEditRowQuantity(e.target.value)}
                                      className="w-20"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Select value={editRowGrade} onValueChange={setEditRowGrade}>
                                      <SelectTrigger className="w-24">
                                        <SelectValue />
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
                                  <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                                  <TableCell>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {editRowDispatchDate ? format(editRowDispatchDate, "MMM dd, yyyy") : "Pick date"}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={editRowDispatchDate}
                                          onSelect={setEditRowDispatchDate}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="month"
                                      value={editRowProductionMonth}
                                      onChange={(e) => setEditRowProductionMonth(e.target.value)}
                                      className="w-full"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(assignment._creationTime), "MMM dd, yyyy")}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editRowNotes}
                                      onChange={(e) => setEditRowNotes(e.target.value)}
                                      placeholder="Notes..."
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button size="icon" variant="ghost" onClick={() => handleSaveEditRow(assignment._id)}>
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={handleCancelEditRow}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  {/* View mode */}
                                  <TableCell className="font-medium">
                                    {assignment.program?.name || "Unknown"}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {assignment.kit?.name || "Unknown Kit"}
                                  </TableCell>
                                  <TableCell>
                                    {assignment.kit?.category || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">
                                      {assignment.client?.organization || assignment.client?.name || "Unknown"}
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
                                    {assignment.productionMonth
                                      ? format(new Date(assignment.productionMonth + "-01"), "MMM yyyy")
                                      : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(assignment._creationTime), "MMM dd, yyyy")}
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
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleStartEditRow(assignment)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
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
                                </>
                              )}
                            </motion.tr>
                          ))}
                      </React.Fragment>
                    );
                  }

                  // Standalone assignments
                  return batchAssignments.map((assignment, index) => (
                    <motion.tr
                      key={assignment._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>-</TableCell>
                      {editingAssignmentId === assignment._id ? (
                        <>
                          {/* Edit mode */}
                          <TableCell>
                            <Select value={editRowProgram} onValueChange={(val) => {
                              setEditRowProgram(val);
                              setEditRowKit("");
                            }}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {programs.map((program) => (
                                  <SelectItem key={program._id} value={program._id}>
                                    {program.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={editRowKit} onValueChange={setEditRowKit} disabled={!editRowProgram}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {editRowFilteredKits.map((kit) => (
                                  <SelectItem key={kit._id} value={kit._id}>
                                    {kit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {editRowSelectedKit?.category || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select value={editRowClient} onValueChange={setEditRowClient}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client._id} value={client._id}>
                                    {client.organization || client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={editRowQuantity}
                              onChange={(e) => setEditRowQuantity(e.target.value)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={editRowGrade} onValueChange={setEditRowGrade}>
                              <SelectTrigger className="w-24">
                                <SelectValue />
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
                          <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {editRowDispatchDate ? format(editRowDispatchDate, "MMM dd, yyyy") : "Pick date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={editRowDispatchDate}
                                  onSelect={setEditRowDispatchDate}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="month"
                              value={editRowProductionMonth}
                              onChange={(e) => setEditRowProductionMonth(e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            {format(new Date(assignment._creationTime), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editRowNotes}
                              onChange={(e) => setEditRowNotes(e.target.value)}
                              placeholder="Notes..."
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="icon" variant="ghost" onClick={() => handleSaveEditRow(assignment._id)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={handleCancelEditRow}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          {/* View mode */}
                          <TableCell className="font-medium">
                            {assignment.program?.name || "Unknown"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {assignment.kit?.name || "Unknown Kit"}
                          </TableCell>
                          <TableCell>
                            {assignment.kit?.category || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {assignment.client?.organization || assignment.client?.name || "Unknown"}
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
                            {assignment.productionMonth
                              ? format(new Date(assignment.productionMonth + "-01"), "MMM yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(assignment._creationTime), "MMM dd, yyyy")}
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
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditRow(assignment)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
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
                        </>
                      )}
                    </motion.tr>
                  ));
                })
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
                        {client.organization || client.name}
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
                <Label>Production Month (Optional)</Label>
                <Input
                  type="month"
                  value={productionMonth}
                  onChange={(e) => setProductionMonth(e.target.value)}
                  placeholder="Select production month"
                />
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

        {/* Batch Assignment Dialog */}
        <BatchAssignmentDialog
          open={batchDialogOpen}
          onOpenChange={setBatchDialogOpen}
          clients={clients}
          programs={programs}
          kits={kits}
          onCreateBatch={handleCreateBatch}
        />
      </div>
    </Layout>
  );
}