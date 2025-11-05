import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Download, ExternalLink, MoreVertical, FileText, BookOpen, Image as ImageIcon, Search } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ViewKitFiles() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const laserFilesData = useQuery(api.laserFiles.listWithKitDetails, {
    fileType: filterType === "all" ? undefined : filterType as any,
  });
  const kits = useQuery(api.kits.list);

  // Aggregate files from both laserFiles table and kit fields (excluding laser files)
  const files = useMemo(() => {
    if (!laserFilesData || !kits) return undefined;

    const aggregatedFiles: any[] = [];

    // Only include non-laser files from laserFiles table
    for (const file of laserFilesData) {
      if (file.fileType !== "laser") {
        aggregatedFiles.push(file);
      }
    }

    // Extract files from kit fields (excluding laser files)
    for (const kit of kits) {
      const fileFields = [
        { field: kit.kitImageFiles, type: "kitImage" },
        { field: kit.componentFiles, type: "component" },
        { field: kit.workbookFiles, type: "workbook" },
      ];

      for (const { field, type } of fileFields) {
        if (field && Array.isArray(field)) {
          for (let i = 0; i < field.length; i++) {
            const file = field[i];
            if (filterType === "all" || filterType === type) {
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "component": return <FileText className="h-4 w-4" />;
      case "workbook": return <BookOpen className="h-4 w-4" />;
      case "kitImage": return <ImageIcon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getFileTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      component: "secondary",
      workbook: "outline",
      kitImage: "outline",
    };
    return variants[type] || "default";
  };

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
            <h1 className="text-3xl font-bold tracking-tight">View Kit Files</h1>
            <p className="text-muted-foreground mt-2">
              Browse component specs, workbooks, and kit images
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
          >
            All Files
          </Button>
          <Button
            variant={filterType === "component" ? "default" : "outline"}
            onClick={() => setFilterType("component")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Component
          </Button>
          <Button
            variant={filterType === "workbook" ? "default" : "outline"}
            onClick={() => setFilterType("workbook")}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Workbook
          </Button>
          <Button
            variant={filterType === "kitImage" ? "default" : "outline"}
            onClick={() => setFilterType("kitImage")}
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            Images
          </Button>
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