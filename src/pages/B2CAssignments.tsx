import React from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel";
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { InlineBatchEditor, type InlineBatchData, type BatchRow } from "@/components/assignments/InlineBatchEditor";
import { B2CAssignmentRow } from "@/components/assignments/B2CAssignmentRow";
import { B2CBatchHeader } from "@/components/assignments/B2CBatchHeader";
import { NotesDialog } from "@/components/assignments/NotesDialog";
import { useB2CAssignments } from "@/hooks/use-b2c-assignments";
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
import { ColumnVisibility } from "@/components/ui/column-visibility";

export default function Assignments() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const {
    assignments,
    programs,
    kits,
    clients,
    batches,
    updateAssignment,
    updateNotes,
    updatePackingNotes,
    updateDispatchNotes,
    createBatch,
    requestDeleteBatch,
    updateBatchWithAssignments,
    selectedPrograms,
    setSelectedPrograms,
    selectedCategories,
    setSelectedCategories,
    selectedKits,
    setSelectedKits,
    selectedClients,
    setSelectedClients,
    selectedDispatchMonths,
    setSelectedDispatchMonths,
    selectedStatuses,
    setSelectedStatuses,
    selectedProductionMonths,
    setSelectedProductionMonths,
    expandedBatches,
    toggleBatchExpansion,
    deleteDialogOpen,
    setDeleteDialogOpen,
    selectedAssignment,
    handleDeleteClick,
    handleConfirmDelete,
    handleDispatch,
    columnVisibility,
    toggleColumn,
  } = useB2CAssignments();

  const canEdit = hasPermission("assignments", "edit");
  const canView = hasPermission("assignments", "view");

  // Batch management states
  type BatchInProgress = {
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
    originalBatchId?: Id<"batches">;
  };

  const [batchesInProgress, setBatchesInProgress] = useState<BatchInProgress[]>([]);

  // Notes dialog state
  const [notesDialog, setNotesDialog] = useState<{
    open: boolean;
    assignmentId: Id<"assignments"> | null;
    type: "assignment" | "packing" | "dispatch";
    value: string;
    canEdit: boolean;
  }>({
    open: false,
    assignmentId: null,
    type: "assignment",
    value: "",
    canEdit: false,
  });

  // Inline row creation states
  const [isAddingNewRow, setIsAddingNewRow] = useState(false);

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

  // Group assignments by batch
  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    const batchId = assignment.batchId || "standalone";
    if (!acc[batchId]) {
      acc[batchId] = [];
    }
    acc[batchId].push(assignment);
    return acc;
  }, {} as Record<string, typeof filteredAssignments>);

  const handleStartBatch = () => {
    const newBatchId = `BATCH-${Date.now()}`;
    const newBatch: BatchInProgress = {
      id: newBatchId,
      batchId: "", // Will be generated after client selection
      client: "",
      clientName: "",
      batchName: "",
      dispatchDate: undefined,
      productionMonth: "",
      batchNotes: "",
      mode: "create",
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

  const handleUpdateBatchRow = (batchId: string, rowId: string, field: string, value: any) => {
    setBatchesInProgress((prevBatches) =>
      prevBatches.map((batch) =>
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

    const organization = client.buyerName;
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

    // Validate production month vs dispatch date
    if (batch.productionMonth && batch.dispatchDate) {
      const prodMonth = new Date(batch.productionMonth + "-01");
      const dispMonth = new Date(batch.dispatchDate.getFullYear(), batch.dispatchDate.getMonth(), 1);
      if (prodMonth > dispMonth) {
        toast.error("Production month must be before or same as dispatch month");
        return;
      }
    }

    try {
      if (batch.mode === "edit" && batch.originalBatchId) {
        // Update existing batch
        await updateBatchWithAssignments({
          batchId: batch.originalBatchId,
          batchName: batch.batchName || undefined,
          notes: batch.batchNotes || undefined,
          dispatchDate: batch.dispatchDate ? batch.dispatchDate.getTime() : undefined,
          productionMonth: batch.productionMonth || undefined,
          assignments: batch.rows.map((r) => ({
            assignmentId: r.assignmentId,
            kitId: r.kit as Id<"kits">,
            quantity: parseInt(r.quantity),
            grade: r.grade && r.grade !== "" ? (r.grade as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10") : undefined,
            notes: r.notes || undefined,
          })),
        });
        toast.success("Batch updated successfully");
      } else {
        // Create new batch
        await createBatch({
          clientId: batch.client as Id<"b2cClients">,
          clientType: "b2c",
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
      }

      // Remove batch from in-progress list
      setBatchesInProgress((prev) => prev.filter((b) => b.id !== batchId));
    } catch (error) {
      console.error("Failed to save batch:", error);
      toast.error(batch.mode === "edit" ? "Failed to update batch" : "Failed to create batch");
    }
  };

  const handleEditBatch = (batch: any) => {
    // Check if this batch is already being edited
    const alreadyEditing = batchesInProgress.some(
      b => b.mode === "edit" && b.originalBatchId === batch._id
    );
    
    if (alreadyEditing) {
      return; // Don't add duplicate
    }

    const batchAssignments = assignments?.filter(a => a.batchId === batch._id) || [];
    
    // Convert existing batch to InlineBatchData format
    const editBatchData: InlineBatchData = {
      id: Math.random().toString(),
      batchId: batch.batchId,
      client: batch.clientId,
      clientName: batch.client?.buyerName || "",
      batchName: batch.batchId,
      dispatchDate: batch.dispatchDate ? new Date(batch.dispatchDate) : undefined,
      productionMonth: batch.productionMonth || "",
      batchNotes: batch.notes || "",
      mode: "edit",
      originalBatchId: batch._id,
      rows: batchAssignments.map(a => {
        const kit = kits?.find(k => k._id === a.kitId);
        return {
          id: Math.random().toString(),
          assignmentId: a._id,
          program: kit?.programId || "",
          kit: a.kitId,
          quantity: a.quantity.toString(),
          grade: a.grade || "",
          notes: a.notes || "",
        };
      }),
    };

    setBatchesInProgress(prev => [...prev, editBatchData]);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to request deletion for this entire batch?")) return;
    try {
      await requestDeleteBatch({ id: batchId as Id<"batches"> });
      toast.success("Batch deletion requested successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request batch deletion");
    }
  };

  const handleOpenNotesDialog = (
    assignmentId: Id<"assignments">,
    type: "assignment" | "packing" | "dispatch",
    value: string
  ) => {
    setNotesDialog({
      open: true,
      assignmentId,
      type,
      value,
      canEdit: type === "assignment" && canEdit,
    });
  };

  const handleSaveNotesDialog = async () => {
    if (!notesDialog.assignmentId) return;

    try {
      if (notesDialog.type === "assignment") {
        await updateNotes({
          id: notesDialog.assignmentId,
          notes: notesDialog.value,
        });
      } else if (notesDialog.type === "packing") {
        await updatePackingNotes({
          id: notesDialog.assignmentId,
          packingNotes: notesDialog.value,
        });
      } else if (notesDialog.type === "dispatch") {
        await updateDispatchNotes({
          id: notesDialog.assignmentId,
          dispatchNotes: notesDialog.value,
        });
      }
      toast.success("Notes updated successfully");
      setNotesDialog({ ...notesDialog, open: false });
    } catch (error) {
      console.error("Error updating notes:", error);
      toast.error("Failed to update notes");
    }
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

    try {
      await updateAssignment({
        id: assignmentId,
        kitId: editRowKit as Id<"kits">,
        b2cClientId: editRowClient as Id<"b2cClients">,
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

  const columns = [
    { id: "program", label: "Program", visible: columnVisibility.program },
    { id: "kit", label: "Kit", visible: columnVisibility.kit },
    { id: "category", label: "Category", visible: columnVisibility.category },
    { id: "client", label: "Client", visible: columnVisibility.client },
    { id: "quantity", label: "Quantity", visible: columnVisibility.quantity },
    { id: "grade", label: "Grade", visible: columnVisibility.grade },
    { id: "status", label: "Status", visible: columnVisibility.status },
    { id: "dispatchDate", label: "Dispatch Date", visible: columnVisibility.dispatchDate },
    { id: "productionMonth", label: "Production Month", visible: columnVisibility.productionMonth },
    { id: "notes", label: "Notes", visible: columnVisibility.notes },
  ];

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">B2C Assignments</h1>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button onClick={() => setIsAddingNewRow(true)} disabled={isAddingNewRow || batchesInProgress.length > 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Assignment
                </Button>
                <Button onClick={handleStartBatch} disabled={batchesInProgress.length > 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start Batch
                </Button>
              </>
            )}
            <ColumnVisibility columns={columns} onToggle={toggleColumn} />
          </div>
        </div>

        <AssignmentFilters
          programs={programs}
          kits={kits}
          clients={clients}
          assignments={assignments}
          selectedPrograms={selectedPrograms}
          onProgramsChange={setSelectedPrograms}
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          selectedKits={selectedKits}
          onKitsChange={setSelectedKits}
          selectedClients={selectedClients}
          onClientsChange={setSelectedClients}
          selectedDispatchMonths={selectedDispatchMonths}
          onDispatchMonthsChange={setSelectedDispatchMonths}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
          selectedProductionMonths={selectedProductionMonths}
          onProductionMonthsChange={setSelectedProductionMonths}
          onClearAll={() => {
            setSelectedPrograms([]);
            setSelectedCategories([]);
            setSelectedKits([]);
            setSelectedClients([]);
            setSelectedDispatchMonths([]);
            setSelectedStatuses([]);
            setSelectedProductionMonths([]);
          }}
        />

        <Table>
          <TableHeader>
            <TableRow>
              {columnVisibility.program && <TableHead>Program</TableHead>}
              {columnVisibility.kit && <TableHead>Kit</TableHead>}
              {columnVisibility.category && <TableHead>Category</TableHead>}
              {columnVisibility.client && <TableHead>Client</TableHead>}
              {columnVisibility.quantity && <TableHead>Quantity</TableHead>}
              {columnVisibility.grade && <TableHead>Grade</TableHead>}
              {columnVisibility.status && <TableHead>Status</TableHead>}
              {columnVisibility.dispatchDate && <TableHead>Dispatch Date</TableHead>}
              {columnVisibility.productionMonth && <TableHead>Production Month</TableHead>}
              {columnVisibility.notes && <TableHead>Notes</TableHead>}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Render batches in progress */}
            {batchesInProgress.map((batch) => (
              <InlineBatchEditor
                key={batch.id}
                batch={batch}
                clients={clients}
                programs={programs}
                kits={kits}
                columnVisibility={columnVisibility}
                onUpdateMetadata={handleUpdateBatchMetadata}
                onUpdateRow={handleUpdateBatchRow}
                onAddRow={handleAddRowToBatch}
                onRemoveRow={handleRemoveRowFromBatch}
                onSave={handleSaveBatch}
                onCancel={handleCancelBatch}
              />
            ))}

            {filteredAssignments.length === 0 ? (
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

                const isBeingEdited = batchesInProgress.some(
                  (b) => b.mode === "edit" && b.originalBatchId === batch?._id
                );

                if (isBatch && batch && !isBeingEdited) {
                  const client = clients?.find((c) => c._id === batch.clientId);
                  const statusCounts = batchAssignments.reduce((acc, a) => {
                    acc[a.status] = (acc[a.status] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  const statusSummary = Object.entries(statusCounts)
                    .map(([status, count]) => `${count} ${status}`)
                    .join(", ");

                  return (
                    <React.Fragment key={`batch-group-${batchId}`}>
                      <B2CBatchHeader
                        batch={batch}
                        client={client}
                        statusSummary={statusSummary}
                        isExpanded={isExpanded}
                        canEdit={canEdit}
                        onToggleExpand={() => toggleBatchExpansion(batchId)}
                        onEdit={handleEditBatch}
                        onDelete={handleDeleteBatch}
                      />
                      {isExpanded &&
                        batchAssignments.map((assignment) => {
                          const kit = kits?.find((k) => k._id === assignment.kitId);
                          const program = programs?.find((p) => p._id === kit?.programId);
                          const client = clients?.find((c) => c._id === assignment.clientId);

                          return (
                            <B2CAssignmentRow
                              key={assignment._id}
                              assignment={assignment}
                              kit={kit}
                              program={program}
                              client={client}
                              columnVisibility={columnVisibility}
                              canEdit={canEdit}
                              onEdit={handleStartEditRow}
                              onDelete={handleDeleteClick}
                              onOpenNotes={handleOpenNotesDialog}
                            />
                          );
                        })}
                    </React.Fragment>
                  );
                }

                if (!isBatch) {
                  return batchAssignments.map((assignment) => {
                    const kit = kits?.find((k) => k._id === assignment.kitId);
                    const program = programs?.find((p) => p._id === kit?.programId);
                    const client = clients?.find((c) => c._id === assignment.clientId);

                    return (
                      <B2CAssignmentRow
                        key={assignment._id}
                        assignment={assignment}
                        kit={kit}
                        program={program}
                        client={client}
                        columnVisibility={columnVisibility}
                        canEdit={canEdit}
                        onEdit={handleStartEditRow}
                        onDelete={handleDeleteClick}
                        onOpenNotes={handleOpenNotesDialog}
                      />
                    );
                  });
                }

                return null;
              })
            )}
          </TableBody>
        </Table>

        <NotesDialog
          open={notesDialog.open}
          type={notesDialog.type}
          value={notesDialog.value}
          canEdit={notesDialog.canEdit}
          onValueChange={(value) => setNotesDialog({ ...notesDialog, value })}
          onSave={handleSaveNotesDialog}
          onClose={() => setNotesDialog({ ...notesDialog, open: false })}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this assignment? This action will create a deletion request.
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