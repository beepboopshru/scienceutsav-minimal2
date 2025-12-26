import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface B2CBatchHeaderProps {
  batch: any;
  client: any;
  statusSummary: string;
  isExpanded: boolean;
  canEdit: boolean;
  onToggleExpand: () => void;
  onEdit: (batch: any) => void;
  onDelete: (batchId: string) => void;
}

export function B2CBatchHeader({
  batch,
  client,
  statusSummary,
  isExpanded,
  canEdit,
  onToggleExpand,
  onEdit,
  onDelete,
}: B2CBatchHeaderProps) {
  return (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell colSpan={13}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            <h3 className="font-semibold text-lg">
              Batch: {batch.batchId}
            </h3>
            {batch.batchName && (
              <span className="text-sm text-muted-foreground">
                ({batch.batchName})
              </span>
            )}
            <Badge variant="outline">{client?.name || "Unknown Client"}</Badge>
            {batch.dispatchDate && (
              <span className="text-sm text-muted-foreground">
                Dispatch: {format(new Date(batch.dispatchDate), "MMM dd, yyyy")}
              </span>
            )}
            {batch.productionMonth && (
              <span className="text-sm text-muted-foreground">
                Production: {batch.productionMonth}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{statusSummary}</span>
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(batch)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(batch._id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
        {batch.batchNotes && (
          <div className="mt-2 text-sm text-muted-foreground">
            Notes: {batch.batchNotes}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
