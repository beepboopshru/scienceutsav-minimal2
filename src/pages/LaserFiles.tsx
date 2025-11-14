import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Upload, Download, ExternalLink, MoreVertical, Trash2, Edit, FileText, Scissors, BookOpen, Image as ImageIcon, Plus, Search } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function LaserFiles() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("laser");
  const [uploadType, setUploadType] = useState<"storage" | "link">("storage");
  const [searchQuery, setSearchQuery] = useState("");

  const canView = hasPermission("laserFiles", "view");
  const canEdit = hasPermission("laserFiles", "edit");

  const laserFilesData = useQuery(api.laserFiles.listWithKitDetails, {
    fileType: filterType === "all" ? undefined : filterType as any,
  });
  const kits = useQuery(api.kits.list);

  // Aggregate files from both laserFiles table and kit fields
  const files = useMemo(() => {
    if (!laserFilesData || !kits) return undefined;

    const aggregatedFiles: any[] = [...laserFilesData];

    // Extract files from kit fields
    for (const kit of kits) {
      // Only include laser files from kits
      const fileFields = [
        { field: kit.laserFiles, type: "laser" },
      ];

      for (const { field, type } of fileFields) {
        if (field && Array.isArray(field)) {
          for (let i = 0; i < field.length; i++) {
            const file = field[i];
            if (filterType === "laser") {
              aggregatedFiles.push({
                _id: `${kit._id}-${type}-${i}`,
                fileName: file.type === "link" ? file.name : `${type} file ${i + 1}`,
                fileType: type,
                kitName: kit.name,
                uploaderName: "Research Team",
                uploadedAt: kit._creationTime,
                storageId: file.type === "storage" ? file.storageId : undefined,
                externalLink: file.type === "link" ? file.url : undefined,
                isFromKitField: true,
              });
            }
          }
        }
      }
    }

    return aggregatedFiles;
  }, [laserFilesData, kits, filterType]);

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!files) return undefined;
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();
    return files.filter(file => 
      file.fileName.toLowerCase().includes(query) ||
      file.kitName.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);
  
  const createFile = useMutation(api.laserFiles.create);
  const removeFile = useMutation(api.laserFiles.remove);
  const generateUploadUrl = useMutation(api.laserFiles.generateUploadUrl);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const kitId = formData.get("kitId") as string;
      const fileName = formData.get("fileName") as string;
      const fileType = formData.get("fileType") as string;
      const notes = formData.get("notes") as string;

      if (!kitId || !fileName || !fileType) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (uploadType === "storage") {
        const file = formData.get("file") as File;
        if (!file) {
          toast.error("Please select a file");
          return;
        }

        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();

        await createFile({
          kitId: kitId as Id<"kits">,
          fileName,
          fileType: fileType as any,
          storageId,
          notes: notes || undefined,
        });
      } else {
        const externalLink = formData.get("externalLink") as string;
        if (!externalLink) {
          toast.error("Please provide an external link");
          return;
        }

        await createFile({
          kitId: kitId as Id<"kits">,
          fileName,
          fileType: fileType as any,
          externalLink,
          notes: notes || undefined,
        });
      }

      toast.success("File uploaded successfully");
      setIsUploadDialogOpen(false);
      e.currentTarget.reset();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    }
  };

  const handleDelete = async (fileId: Id<"laserFiles">) => {
    try {
      await removeFile({ id: fileId });
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "laser": return <Scissors className="h-4 w-4" />;
      case "component": return <FileText className="h-4 w-4" />;
      case "workbook": return <BookOpen className="h-4 w-4" />;
      case "kitImage": return <ImageIcon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getFileTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      laser: "default",
      component: "secondary",
      workbook: "outline",
      kitImage: "outline",
    };
    return variants[type] || "default";
  };

  if (!canView) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Laser Files</h1>
            <p className="text-muted-foreground mt-2">
              Manage laser cutting files
            </p>
          </div>
          {canEdit && (
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload File</DialogTitle>
                  <DialogDescription>
                    Upload a new file or link to external storage
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="kitId">Kit *</Label>
                    <Select name="kitId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select kit" />
                      </SelectTrigger>
                      <SelectContent>
                        {kits?.map((kit) => (
                          <SelectItem key={kit._id} value={kit._id}>
                            {kit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fileName">File Name *</Label>
                    <Input id="fileName" name="fileName" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fileType">File Type *</Label>
                    <Select name="fileType" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="laser">Laser File</SelectItem>
                        <SelectItem value="component">Component File</SelectItem>
                        <SelectItem value="workbook">Workbook</SelectItem>
                        <SelectItem value="kitImage">Kit Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Upload Method</Label>
                    <Select value={uploadType} onValueChange={(v) => setUploadType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="storage">Upload File</SelectItem>
                        <SelectItem value="link">External Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {uploadType === "storage" ? (
                    <div className="space-y-2">
                      <Label htmlFor="file">File *</Label>
                      <Input id="file" name="file" type="file" required />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="externalLink">External Link *</Label>
                      <Input
                        id="externalLink"
                        name="externalLink"
                        type="url"
                        placeholder="https://..."
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" rows={3} />
                  </div>

                  <DialogFooter>
                    <Button type="submit">Upload</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by kit name or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredFiles ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredFiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No files match your search" : "No files found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredFiles.map((file) => (
                  <TableRow key={file._id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getFileTypeIcon(file.fileType)}
                        {file.fileName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getFileTypeBadge(file.fileType)}>
                        {file.fileType}
                      </Badge>
                    </TableCell>
                    <TableCell>{file.kitName}</TableCell>
                    <TableCell>{file.uploaderName}</TableCell>
                    <TableCell>
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {file.externalLink ? (
                            <DropdownMenuItem asChild>
                              <a href={file.externalLink} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Link
                              </a>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={async () => {
                                if (file.storageId) {
                                  const url = await fetch(
                                    `/api/storage/${file.storageId}`
                                  ).then((r) => r.text());
                                  window.open(url, "_blank");
                                }
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                          )}
                          {canEdit && !file.isFromKitField && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(file._id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}