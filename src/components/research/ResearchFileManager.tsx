import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { FileListItem } from "./FileListItem";

interface FileItem {
  type: "storage" | "link";
  storageId?: Id<"_storage">;
  name?: string;
  url?: string;
}

interface ResearchFileManagerProps {
  kitId: Id<"kits">;
  fileType: "kitImage" | "laser" | "component" | "workbook" | "misc";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFiles?: FileItem[];
}

export function ResearchFileManager({ 
  kitId, 
  fileType, 
  open, 
  onOpenChange,
  currentFiles = []
}: ResearchFileManagerProps) {
  const [externalLink, setExternalLink] = useState("");
  const [externalLinkName, setExternalLinkName] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const updateKit = useMutation(api.kits.update);
  const generateUploadUrl = useMutation(api.kits.generateUploadUrl);

  const fileTypeLabels = {
    kitImage: "Kit Image",
    laser: "Laser Files & Printable",
    component: "Component Pictures",
    workbook: "Workbook/Sheet",
    misc: "Miscellaneous"
  };

  const fileTypeAccepts = {
    kitImage: "image/*",
    laser: ".dxf,.pdf,.cdr",
    component: "image/*",
    workbook: ".pdf,.doc,.docx,.xls,.xlsx",
    misc: "*"
  };

  const fileTypeDescriptions = {
    kitImage: "Primary visual for the kit (PNG, JPG, WebP)",
    laser: "DXF, PDF, CDR files for laser cutting and printable materials",
    component: "Photos of parts and assemblies (auto-converted to WebP)",
    workbook: "Instruction manuals and worksheets",
    misc: "Any other files related to this kit"
  };

  // Helper function to convert image to WebP
  const convertToWebP = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert image to WebP'));
            }
          },
          'image/webp',
          0.9 // Quality setting (0-1)
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      let fileToUpload: File | Blob = file;
      let contentType = file.type;

      // Convert to WebP if it's an image for kitImage or component types
      if ((fileType === 'kitImage' || fileType === 'component') && file.type.startsWith('image/')) {
        if (file.type !== 'image/webp') {
          toast.info("Converting image to WebP format...");
          fileToUpload = await convertToWebP(file);
          contentType = 'image/webp';
        }
      }

      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: fileToUpload,
      });
      
      const { storageId } = await result.json();
      
      // Update kit with new file in the appropriate field
      const newFile = { type: "storage" as const, storageId };
      const updatedFiles = [...currentFiles, newFile];
      
      const fieldMap = {
        kitImage: "kitImageFiles",
        laser: "laserFiles",
        component: "componentFiles",
        workbook: "workbookFiles",
        misc: "miscFiles"
      };
      
      await updateKit({ id: kitId, [fieldMap[fileType]]: updatedFiles });
      
      toast.success(fileType === 'kitImage' || fileType === 'component' ? "Image uploaded and converted to WebP" : "File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
      console.error(error);
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
      const newFile = { type: "link" as const, name: externalLinkName, url: externalLink };
      const updatedFiles = [...currentFiles, newFile];
      
      const fieldMap = {
        kitImage: "kitImageFiles",
        laser: "laserFiles",
        component: "componentFiles",
        workbook: "workbookFiles",
        misc: "miscFiles"
      };
      
      await updateKit({ id: kitId, [fieldMap[fileType]]: updatedFiles });
      
      toast.success("Link added successfully");
      setExternalLink("");
      setExternalLinkName("");
    } catch (error) {
      toast.error("Failed to add link");
    }
  };

  const handleDeleteFile = async (index: number) => {
    try {
      const updatedFiles = currentFiles.filter((_, i) => i !== index);
      
      const fieldMap = {
        kitImage: "kitImageFiles",
        laser: "laserFiles",
        component: "componentFiles",
        workbook: "workbookFiles",
        misc: "miscFiles"
      };
      
      await updateKit({ id: kitId, [fieldMap[fileType]]: updatedFiles });
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
        {currentFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Current Files</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentFiles.map((file, idx) => (
                <FileListItem
                  key={idx}
                  file={file}
                  index={idx}
                  onDelete={handleDeleteFile}
                />
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