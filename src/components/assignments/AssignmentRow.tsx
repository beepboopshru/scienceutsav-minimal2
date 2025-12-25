import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit2, Trash2, FileText, MessageSquare, Truck } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface AssignmentRowProps {
  assignment: any;
  batch: any;
  programs: any[];
  kits: any[];
  clients: any[];
  columnVisibility: Record<string, boolean>;
  canEdit: boolean;
  index: number;
  onEdit: (assignment: any) => void;
  onDelete: (assignment: any) => void;
  onOpenNotes: (id: string, type: string, notes: string, editable: boolean) => void;
}

export function AssignmentRow({
  assignment,
  batch,
  programs,
  kits,
  clients,
  columnVisibility,
  canEdit,
  index,
  onEdit,
  onDelete,
  onOpenNotes,
}: AssignmentRowProps) {
  return (
    <motion.tr
      key={assignment._id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="hover:bg-muted/50"
    >
      <TableCell>
        <Badge variant="outline">{batch?.batchId || "-"}</Badge>
      </TableCell>
      {columnVisibility.program && (
        <TableCell>
          <span className="text-sm">
            {programs?.find((p) => p._id === assignment.kit?.programId)?.name}
          </span>
        </TableCell>
      )}
      {columnVisibility.kit && (
        <TableCell>
          <span className="text-sm">
            {kits?.find((k) => k._id === assignment.kitId)?.name}
          </span>
        </TableCell>
      )}
      {columnVisibility.category && (
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {kits?.find((k) => k._id === assignment.kitId)?.category || "-"}
          </span>
        </TableCell>
      )}
      {columnVisibility.client && (
        <TableCell>
          <span className="text-sm">
            {clients?.find((c) => c._id === assignment.clientId)?.buyerName}
          </span>
        </TableCell>
      )}
      {columnVisibility.quantity && (
        <TableCell>
          <span className="text-sm">{assignment.quantity}</span>
        </TableCell>
      )}
      {columnVisibility.grade && (
        <TableCell>
          <span className="text-sm">{assignment.grade || "-"}</span>
        </TableCell>
      )}
      {columnVisibility.status && (
        <TableCell>
          <Badge
            variant={
              assignment.status === "dispatched" ? "default" : "secondary"
            }
          >
            {assignment.status}
          </Badge>
        </TableCell>
      )}
      {columnVisibility.dispatchDate && (
        <TableCell>
          <span className="text-sm">
            {assignment.dispatchedAt
              ? format(assignment.dispatchedAt, "MMM dd, yyyy")
              : "-"}
          </span>
        </TableCell>
      )}
      {columnVisibility.productionMonth && (
        <TableCell>
          <span className="text-sm">
            {assignment.productionMonth
              ? format(
                  new Date(assignment.productionMonth + "-01"),
                  "MMM yyyy"
                )
              : "-"}
          </span>
        </TableCell>
      )}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {format(assignment._creationTime, "MMM dd, yyyy")}
        </span>
      </TableCell>
      {columnVisibility.notes && (
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      onOpenNotes(
                        assignment._id,
                        "assignment",
                        assignment.notes || "",
                        canEdit
                      )
                    }
                    className="h-8 w-8"
                  >
                    <FileText className="h-4 w-4 text-blue-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Assignment Notes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      onOpenNotes(
                        assignment._id,
                        "packing",
                        assignment.packingNotes || "",
                        false
                      )
                    }
                    className="h-8 w-8"
                  >
                    <MessageSquare className="h-4 w-4 text-green-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Packing Notes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      onOpenNotes(
                        assignment._id,
                        "dispatch",
                        assignment.dispatchNotes || "",
                        false
                      )
                    }
                    className="h-8 w-8"
                  >
                    <Truck className="h-4 w-4 text-orange-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Dispatch Notes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>
      )}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {canEdit && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEdit(assignment)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDelete(assignment)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </motion.tr>
  );
}