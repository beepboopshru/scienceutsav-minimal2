import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit2, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface BatchRowProps {
  batch: any;
  isExpanded: boolean;
  canEdit: boolean;
  onToggleExpand: (batchId: string) => void;
  onEdit: (batch: any) => void;
  onDelete: (batchId: Id<"batches">) => void;
}

export function BatchRow({
  batch,
  isExpanded,
  canEdit,
  onToggleExpand,
  onEdit,
  onDelete,
}: BatchRowProps) {
  return (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell colSpan={13}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">
              Batch: {batch.batchId}
              {batch.notes && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({batch.notes})
                </span>
              )}
            </h3>
            <Badge variant="outline">
              {batch.assignmentCount} items
            </Badge>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(batch)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-4 w-4" />
                <span className="sr-only">Edit Batch</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpand(batch._id)}
            >
              {isExpanded ? "▼" : "▶"}
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(batch._id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}