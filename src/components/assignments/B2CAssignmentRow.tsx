import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, FileText, MessageSquare, Truck } from "lucide-react";
import { format } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel";

interface B2CAssignmentRowProps {
  assignment: any;
  kit: any;
  program: any;
  client: any;
  columnVisibility: Record<string, boolean>;
  canEdit: boolean;
  onEdit: (assignment: any) => void;
  onDelete: (assignment: any) => void;
  onOpenNotes: (assignmentId: Id<"assignments">, type: "assignment" | "packing" | "dispatch", value: string) => void;
}

export function B2CAssignmentRow({
  assignment,
  kit,
  program,
  client,
  columnVisibility,
  canEdit,
  onEdit,
  onDelete,
  onOpenNotes,
}: B2CAssignmentRowProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "processing":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "packed":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "dispatched":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <TableRow>
      {columnVisibility.program && (
        <TableCell>{program?.name || "N/A"}</TableCell>
      )}
      {columnVisibility.kit && (
        <TableCell>{kit?.name || "N/A"}</TableCell>
      )}
      {columnVisibility.category && (
        <TableCell>{kit?.category || "N/A"}</TableCell>
      )}
      {columnVisibility.client && (
        <TableCell>{client?.name || "N/A"}</TableCell>
      )}
      {columnVisibility.quantity && (
        <TableCell>{assignment.quantity}</TableCell>
      )}
      {columnVisibility.grade && (
        <TableCell>{assignment.grade || "N/A"}</TableCell>
      )}
      {columnVisibility.status && (
        <TableCell>
          <Badge className={getStatusColor(assignment.status)}>
            {assignment.status}
          </Badge>
        </TableCell>
      )}
      {columnVisibility.dispatchDate && (
        <TableCell>
          {assignment.dispatchedAt
            ? format(new Date(assignment.dispatchedAt), "MMM dd, yyyy")
            : "Not dispatched"}
        </TableCell>
      )}
      {columnVisibility.productionMonth && (
        <TableCell>{assignment.productionMonth || "N/A"}</TableCell>
      )}
      {columnVisibility.notes && (
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onOpenNotes(
                  assignment._id,
                  "assignment",
                  assignment.notes || ""
                )
              }
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onOpenNotes(
                  assignment._id,
                  "packing",
                  assignment.packingNotes || ""
                )
              }
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onOpenNotes(
                  assignment._id,
                  "dispatch",
                  assignment.dispatchNotes || ""
                )
              }
            >
              <Truck className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
      <TableCell>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(assignment)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(assignment)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
