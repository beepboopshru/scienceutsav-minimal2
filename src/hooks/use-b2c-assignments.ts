import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export function useB2CAssignments() {
  const assignments = useQuery(api.assignments.list, { clientType: "b2c" });
  const programs = useQuery(api.programs.list, {});
  const kits = useQuery(api.kits.list, {});
  const clients = useQuery(api.b2cClients.list, {});
  const batches = useQuery(api.batches.list, { clientType: "b2c" });

  const createAssignment = useMutation(api.assignments.create);
  const updateAssignment = useMutation(api.assignments.update);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const updateNotes = useMutation(api.assignments.updateNotes);
  const updatePackingNotes = useMutation(api.assignments.updatePackingNotes);
  const updateDispatchNotes = useMutation(api.assignments.updateDispatchNotes);
  const deleteAssignment = useMutation(api.assignments.deleteAssignment);
  const createBatch = useMutation(api.batches.create);
  const requestDeleteBatch = useMutation(api.batches.remove);
  const updateBatchWithAssignments = useMutation(api.batches.updateBatchWithAssignments);

  // Filter states
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedDispatchMonths, setSelectedDispatchMonths] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProductionMonths, setSelectedProductionMonths] = useState<string[]>([]);

  // UI states
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState({
    program: true,
    kit: true,
    category: true,
    client: true,
    quantity: true,
    grade: true,
    status: true,
    dispatchDate: true,
    productionMonth: true,
    notes: true,
  });

  const toggleColumn = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId as keyof typeof prev]: !prev[columnId as keyof typeof prev],
    }));
  };

  const handleDeleteClick = (assignment: any) => {
    setSelectedAssignment(assignment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAssignment) return;

    try {
      await deleteAssignment({ id: selectedAssignment._id });
      toast.success("Deletion request created successfully");
      setDeleteDialogOpen(false);
      setSelectedAssignment(null);
    } catch (error) {
      console.error("Error creating deletion request:", error);
      toast.error("Failed to create deletion request");
    }
  };

  const handleDispatch = async (assignmentId: Id<"assignments">) => {
    try {
      await updateStatus({
        id: assignmentId,
        status: "dispatched",
      });
      toast.success("Assignment dispatched successfully");
    } catch (error) {
      console.error("Error dispatching assignment:", error);
      toast.error("Failed to dispatch assignment");
    }
  };

  const toggleBatchExpansion = (batchId: string) => {
    setExpandedBatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
  };

  return {
    // Data
    assignments,
    programs,
    kits,
    clients,
    batches,
    // Mutations
    createAssignment,
    updateAssignment,
    updateStatus,
    updateNotes,
    updatePackingNotes,
    updateDispatchNotes,
    deleteAssignment,
    createBatch,
    requestDeleteBatch,
    updateBatchWithAssignments,
    // Filter states
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
    // UI states
    expandedBatches,
    toggleBatchExpansion,
    deleteDialogOpen,
    setDeleteDialogOpen,
    selectedAssignment,
    handleDeleteClick,
    handleConfirmDelete,
    handleDispatch,
    // Column visibility
    columnVisibility,
    toggleColumn,
  };
}