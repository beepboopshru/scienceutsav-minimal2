import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface NotesDialogProps {
  open: boolean;
  type: "assignment" | "packing" | "dispatch";
  value: string;
  canEdit: boolean;
  onValueChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function NotesDialog({
  open,
  type,
  value,
  canEdit,
  onValueChange,
  onSave,
  onClose,
}: NotesDialogProps) {
  const getTitle = () => {
    switch (type) {
      case "assignment":
        return "Assignment Notes";
      case "packing":
        return "Packing Notes";
      case "dispatch":
        return "Dispatch Notes";
      default:
        return "Notes";
    }
  };

  const getDescription = () => {
    switch (type) {
      case "assignment":
        return "View or edit assignment notes";
      case "packing":
        return "View packing notes (read-only)";
      case "dispatch":
        return "View dispatch notes (read-only)";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={!canEdit || type !== "assignment"}
          rows={6}
          placeholder="Enter notes..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {canEdit && type === "assignment" ? "Cancel" : "Close"}
          </Button>
          {canEdit && type === "assignment" && (
            <Button onClick={onSave}>Save</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
