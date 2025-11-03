import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, Download, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ResearchFileManagerProps {
  kitId: Id<"kits">;
  fileType: "kitImage" | "laser" | "component" | "workbook";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFiles?: string[];
  currentFileIds?: Id<"_storage">[];
}

export function ResearchFileManager({ 
  kitId, 
  fileType, 
  open, 
  onOpenChange,
  currentFiles = [],
  currentFileIds = []
}: ResearchFileManagerProps) {
  const [externalLink, setExternalLink] = useState("");
  const [externalLinkName, setExternalLinkName] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const updateKit = useMutation(api.kits.update);
  const generateUploadUrl = useMutation(api.kits.generateUploadUrl);

  const fileTypeLabels = {
    kitImage: "Kit Image",
    laser: "Laser Files",
    component: "Component Pictures",
    workbook: "Workbooks & Misc"
  };

  const fileTypeAccepts = {
    kitImage: "image/*",
    laser: ".dxf,.pdf,.cdr",
    component: "image/*",
    workbook: ".pdf,.doc,.docx,.xls,.xlsx"
  };

  const fileTypeDescriptions = {
    kitImage: "Primary visual for the kit (PNG, JPG)",
    laser: "DXF, PDF, CDR files for laser cutting",
    component: "Photos of parts and assemblies",
    workbook: "Instruction manuals, BOMs, spec sheets"
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      const { storageId } = await result.json();
      
      // Update kit with new file ID
      const updatedFileIds = [...currentFileIds, storageId];
      await updateKit({ id: kitId, fileIds: updatedFileIds });
      
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleAddExternalLink = async () => {
    if (!externalLink.trim() || !externalLinkName.trim()) {
      toast.error("Please provide both file name and URL");
      return;
    }
    
    try {
      const linkWithName = `${externalLinkName}|${externalLink}`;
      const updatedFiles = [...currentFiles, linkWithName];
      
      if (fileType === "kitImage") {
        await updateKit({ id: kitId, images: updatedFiles });
      } else {
        await updateKit({ id: kitId, images: updatedFiles });
      }
      
      toast.success("Link added successfully");
      setExternalLink("");
      setExternalLinkName("");
    } catch (error) {
      toast.error("Failed to add link");
    }
  };

  const handleDeleteFile = async (index: number, isStorageFile: boolean) => {
    try {
      if (isStorageFile) {
        const updatedFileIds = currentFileIds.filter((_, i) => i !== index);
        await updateKit({ id: kitId, fileIds: updatedFileIds });
      } else {
        const updatedFiles = currentFiles.filter((_, i) => i !== index);
        await updateKit({ id: kitId, images: updatedFiles });
      }
      toast.success("File removed");
    } catch (error) {
      toast.error("Failed to remove file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage {fileTypeLabels[fileType]}</DialogTitle>
          <DialogDescription>{fileTypeDescriptions[fileType]}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="link">External Link</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm font-medium">Click to upload</span>
                <Input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept={fileTypeAccepts[fileType]}
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-2">
                {uploading ? "Uploading..." : fileTypeDescriptions[fileType]}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <Label>File Name</Label>
              <Input
                placeholder="e.g., Main Assembly Drawing"
                value={externalLinkName}
                onChange={(e) => setExternalLinkName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>External Link URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://drive.google.com/..."
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                />
                <Button onClick={handleAddExternalLink}>
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Current Files List */}
        {(currentFiles.length > 0 || currentFileIds.length > 0) && (
          <div className="space-y-2">
            <Label>Current Files</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentFiles.map((file, idx) => {
                const [name, url] = file.includes("|") ? file.split("|") : [file, file];
                return (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm truncate flex-1">{name}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => window.open(url, "_blank")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteFile(idx, false)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {currentFileIds.map((fileId, idx) => (
                <div key={fileId} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm truncate flex-1">Uploaded file {idx + 1}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteFile(idx, true)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}