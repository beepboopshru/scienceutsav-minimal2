import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AssignmentFilters } from "@/components/assignments/AssignmentFilters";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Search, ChevronDown, ChevronRight, Eye, Building2, User, Mail, Phone, MapPin, CheckCircle2, MoreVertical, FileText, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Helper function to convert image to WebP
async function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert image"));
        },
        "image/webp",
        0.9
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export default function Dispatch() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const assignments = useQuery(api.assignments.list, {});
  const kits = useQuery(api.kits.list, {});
  const clients = useQuery(api.clients.list, {});
  const b2cClients = useQuery(api.b2cClients.list, {});
  const batches = useQuery(api.batches.list, {});
  const programs = useQuery(api.programs.list);
  const updateStatus = useMutation(api.assignments.updateStatus);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const updateRemarks = useMutation(api.assignments.updateRemarks);

  // Add state for Create Dispatch dialog
  const [showCreateDispatchDialog, setShowCreateDispatchDialog] = useState(false);
  const [createDispatchData, setCreateDispatchData] = useState({
    clientType: "b2b" as "b2b" | "b2c",
    clientId: "",
    customName: "",
    remarks: "",
    dispatchNumber: "",
    ewayNumber: "",
    trackingLink: "",
  });
  const [createDispatchDocFile, setCreateDispatchDocFile] = useState<File | null>(null);
  const [createDispatchEwayFile, setCreateDispatchEwayFile] = useState<File | null>(null);

  // ... keep existing queries and mutations

  const createCustomDispatch = useMutation(api.orderHistory.createCustomDispatch);

  // ... keep existing handlers

  const handleCreateDispatch = async () => {
    if (!createDispatchData.clientId || !createDispatchData.customName) {
      toast.error("Please select a client and enter a name");
      return;
    }

    try {
      let dispatchDocId: Id<"_storage"> | undefined;
      let ewayDocId: Id<"_storage"> | undefined;

      // Upload dispatch document if provided
      if (createDispatchDocFile) {
        const webpBlob = await convertToWebP(createDispatchDocFile);
        dispatchDocId = await generateUploadUrl().then(url => 
          fetch(url, { method: "POST", body: webpBlob }).then(r => r.json()).then(d => d.storageId)
        );
      }

      // Upload e-way document if provided
      if (createDispatchEwayFile) {
        const webpBlob = await convertToWebP(createDispatchEwayFile);
        ewayDocId = await generateUploadUrl().then(url => 
          fetch(url, { method: "POST", body: webpBlob }).then(r => r.json()).then(d => d.storageId)
        );
      }

      await createCustomDispatch({
        clientId: createDispatchData.clientId,
        clientType: createDispatchData.clientType,
        customName: createDispatchData.customName,
        remarks: createDispatchData.remarks || undefined,
        dispatchNumber: createDispatchData.dispatchNumber || undefined,
        dispatchDocumentId: dispatchDocId,
        ewayNumber: createDispatchData.ewayNumber || undefined,
        ewayDocumentId: ewayDocId,
        trackingLink: createDispatchData.trackingLink || undefined,
      });

      toast.success("Custom dispatch created successfully");
      setShowCreateDispatchDialog(false);
      setCreateDispatchData({
        clientType: "b2b",
        clientId: "",
        customName: "",
        remarks: "",
        dispatchNumber: "",
        ewayNumber: "",
        trackingLink: "",
      });
      setCreateDispatchDocFile(null);
      setCreateDispatchEwayFile(null);
    } catch (error) {
      console.error("Error creating custom dispatch:", error);
      toast.error("Failed to create custom dispatch");
    }
  };

  // ... keep existing render logic until the header section

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dispatch Management</h1>
          <p className="text-muted-foreground">
            Manage assignments ready for dispatch
          </p>
        </div>
        <Button onClick={() => setShowCreateDispatchDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Dispatch
        </Button>
      </div>

      {/* ... keep existing summary stats, filters, and table */}

      {/* Create Dispatch Dialog */}
      <Dialog open={showCreateDispatchDialog} onOpenChange={setShowCreateDispatchDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Dispatch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client Type Selection */}
            <div className="space-y-2">
              <Label>Client Type</Label>
              <Select
                value={createDispatchData.clientType}
                onValueChange={(value: "b2b" | "b2c") =>
                  setCreateDispatchData({ ...createDispatchData, clientType: value, clientId: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b">B2B</SelectItem>
                  <SelectItem value="b2c">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={createDispatchData.clientId}
                onValueChange={(value) =>
                  setCreateDispatchData({ ...createDispatchData, clientId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {createDispatchData.clientType === "b2b"
                    ? clients?.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.name}
                        </SelectItem>
                      ))
                    : b2cClients?.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.buyerName}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Name */}
            <div className="space-y-2">
              <Label>Dispatch Name *</Label>
              <Input
                value={createDispatchData.customName}
                onChange={(e) =>
                  setCreateDispatchData({ ...createDispatchData, customName: e.target.value })
                }
                placeholder="Enter dispatch name"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={createDispatchData.remarks}
                onChange={(e) =>
                  setCreateDispatchData({ ...createDispatchData, remarks: e.target.value })
                }
                placeholder="Enter remarks"
                rows={3}
              />
            </div>

            {/* Dispatch Number */}
            <div className="space-y-2">
              <Label>Dispatch Number</Label>
              <Input
                value={createDispatchData.dispatchNumber}
                onChange={(e) =>
                  setCreateDispatchData({ ...createDispatchData, dispatchNumber: e.target.value })
                }
                placeholder="Enter dispatch number"
              />
            </div>

            {/* Dispatch Document */}
            <div className="space-y-2">
              <Label>Dispatch Document (PNG/JPEG/WEBP)</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setCreateDispatchDocFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* E-Way Number */}
            <div className="space-y-2">
              <Label>E-Way Number</Label>
              <Input
                value={createDispatchData.ewayNumber}
                onChange={(e) =>
                  setCreateDispatchData({ ...createDispatchData, ewayNumber: e.target.value })
                }
                placeholder="Enter e-way number"
              />
            </div>

            {/* E-Way Document */}
            <div className="space-y-2">
              <Label>E-Way Document (PNG/JPEG/WEBP)</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setCreateDispatchEwayFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Tracking Link */}
            <div className="space-y-2">
              <Label>Tracking Link</Label>
              <Input
                value={createDispatchData.trackingLink}
                onChange={(e) =>
                  setCreateDispatchData({ ...createDispatchData, trackingLink: e.target.value })
                }
                placeholder="Enter tracking link"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDispatchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDispatch}>Create Dispatch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ... keep all existing dialogs (ready for dispatch, proof photo, client details) */}
    </div>
  );
}