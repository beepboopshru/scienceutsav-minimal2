import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Send,
  ChevronDown,
  ChevronRight,
  CalendarIcon,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

export default function B2BAssignments() {
  const { user } = useAuth();
  const assignments = useQuery(api.assignments.list, { clientType: "b2b" });
  const batches = useQuery(api.batches.list, { clientType: "b2b" });
  const clients = useQuery(api.clients.list);
  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);

  const createAssignment = useMutation(api.assignments.create);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const updateNotes = useMutation(api.assignments.updateNotes);
  const deleteAssignment = useMutation(api.assignments.deleteAssignment);
  const createBatch = useMutation(api.batches.create);
  const updateBatch = useMutation(api.batches.update);
  const deleteBatch = useMutation(api.batches.deleteBatch);
  const addAssignmentToBatch = useMutation(api.batches.addAssignment);
  const removeAssignmentFromBatch = useMutation(api.batches.removeAssignment);

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">B2B Assignments</h1>
        </div>
        <p className="text-muted-foreground">B2B assignment management coming soon...</p>
      </div>
    </Layout>
  );
}