import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Edit2, Trash2, Save, X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface BatchRowProps {
  batch: any;
  isExpanded: boolean;
  canEdit: boolean;
  onToggleExpand: (batchId: string) => void;
  onEdit: (batch: any) => void;
  onDelete: (batchId: Id<"batches">) => void;
  onSaveInlineEdit?: (batchId: Id<"batches">, updates: { batchId?: string; notes?: string }) => void;
}

export function BatchRow({
  batch,
  isExpanded,
  canEdit,
  onToggleExpand,
  onEdit,
  onDelete,
  onSaveInlineEdit,
}: BatchRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBatchId, setEditedBatchId] = useState(batch.batchId);
  const [editedNotes, setEditedNotes] = useState(batch.notes || "");

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedBatchId(batch.batchId);
    setEditedNotes(batch.notes || "");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedBatchId(batch.batchId);
    setEditedNotes(batch.notes || "");
  };

  const handleSaveEdit = () => {
    if (onSaveInlineEdit) {
      const updates: { batchId?: string; notes?: string } = {};
      if (editedBatchId !== batch.batchId) {
        updates.batchId = editedBatchId;
      }
      if (editedNotes !== (batch.notes || "")) {
        updates.notes = editedNotes;
      }
      onSaveInlineEdit(batch._id, updates);
    }
    setIsEditing(false);
  };

  return (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell colSpan={13}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <span className="text-sm">Batch:</span>
                <Input
                  value={editedBatchId}
                  onChange={(e) => setEditedBatchId(e.target.value)}
                  className="h-8 w-32"
                />
                <Input
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Notes..."
                  className="h-8 w-64"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                >
                  <Save className="h-4 w-4" />
                  <span className="sr-only">Save</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cancel</span>
                </Button>
              </>
            ) : (
              <>
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
                {canEdit && onSaveInlineEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEdit}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="sr-only">Edit Inline</span>
                  </Button>
                )}
                {canEdit && !onSaveInlineEdit && (
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
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpand(batch._id)}
              disabled={isEditing}
            >
              {isExpanded ? "▼" : "▶"}
            </Button>
            {canEdit && !isEditing && (
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