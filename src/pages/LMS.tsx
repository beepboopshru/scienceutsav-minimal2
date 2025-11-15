import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePermissions } from "@/hooks/use-permissions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, Copy, Upload, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function LMS() {
  const { hasPermission } = usePermissions();
  const programs = useQuery(api.programs.list);
  const allKits = useQuery(api.kits.list);
  const updateLmsLink = useMutation(api.kits.updateLmsLink);

  const [selectedProgramId, setSelectedProgramId] = useState<Id<"programs"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [lmsUrl, setLmsUrl] = useState("");
  const [lmsNotes, setLmsNotes] = useState("");

  // Check permissions
  if (!hasPermission("programs", "view")) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const canUpload = hasPermission("kits", "edit");

  // Get selected program
  const selectedProgram = programs?.find((p) => p._id === selectedProgramId);

  // Filter kits
  const filteredKits = allKits?.filter((kit) => {
    if (selectedProgramId && kit.programId !== selectedProgramId) return false;
    if (categoryFilter !== "all" && kit.category !== categoryFilter) return false;
    if (programFilter !== "all" && kit.programId !== programFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        kit.name.toLowerCase().includes(query) ||
        kit.serialNumber?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Get unique categories
  const categories = Array.from(new Set(allKits?.map((k) => k.category).filter(Boolean)));

  const handleOpenDialog = (kit: any) => {
    setSelectedKit(kit);
    setLmsUrl(kit.lmsLink || "");
    setLmsNotes(kit.lmsNotes || "");
    setDialogOpen(true);
  };

  const handleSaveLink = async () => {
    if (!selectedKit) return;

    // Validate URL
    if (lmsUrl && !isValidUrl(lmsUrl)) {
      toast.error("Please enter a valid URL");
      return;
    }

    try {
      await updateLmsLink({
        kitId: selectedKit._id,
        lmsLink: lmsUrl || undefined,
        lmsNotes: lmsNotes || undefined,
      });
      toast.success("LMS link updated successfully");
      setDialogOpen(false);
      setSelectedKit(null);
      setLmsUrl("");
      setLmsNotes("");
    } catch (error) {
      toast.error("Failed to update LMS link");
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const handleOpenLink = (link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // Program Selection View
  if (!selectedProgramId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LMS Link Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage Learning Management System links for kits
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs?.map((program) => {
            const kitCount = allKits?.filter((k) => k.programId === program._id).length || 0;
            const linkedCount = allKits?.filter((k) => k.programId === program._id && k.lmsLink).length || 0;

            return (
              <Card
                key={program._id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedProgramId(program._id)}
              >
                <CardHeader>
                  <CardTitle>{program.name}</CardTitle>
                  <CardDescription>{program.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Kits:</span>
                    <Badge variant="secondary">{kitCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Linked:</span>
                    <Badge variant={linkedCount === kitCount ? "default" : "outline"}>
                      {linkedCount}/{kitCount}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Table View
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedProgramId(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {selectedProgram?.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage LMS links for kits in this program
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Search kits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat!}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs?.map((prog) => (
              <SelectItem key={prog._id} value={prog._id}>
                {prog.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kit No.</TableHead>
              <TableHead>Kit Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKits?.map((kit) => {
              const program = programs?.find((p) => p._id === kit.programId);
              const hasLink = !!kit.lmsLink;

              return (
                <TableRow key={kit._id}>
                  <TableCell className="font-medium">
                    {kit.serialNumber || "-"}
                  </TableCell>
                  <TableCell>{kit.name}</TableCell>
                  <TableCell>{kit.category || "-"}</TableCell>
                  <TableCell>{program?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={hasLink ? "default" : "secondary"}>
                      {hasLink ? "Uploaded" : "Not Uploaded"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(kit)}
                      disabled={!canUpload && !hasLink}
                    >
                      {hasLink ? (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          View Link
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Link
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Upload/View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedKit?.lmsLink ? "View/Edit LMS Link" : "Upload LMS Link"}
            </DialogTitle>
            <DialogDescription>
              {selectedKit?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lms-url">LMS Link URL</Label>
              <Input
                id="lms-url"
                placeholder="https://..."
                value={lmsUrl}
                onChange={(e) => setLmsUrl(e.target.value)}
                disabled={!canUpload}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lms-notes">Notes</Label>
              <Textarea
                id="lms-notes"
                placeholder="Add any notes about this LMS link..."
                value={lmsNotes}
                onChange={(e) => setLmsNotes(e.target.value)}
                disabled={!canUpload}
                rows={3}
              />
            </div>

            {selectedKit?.lmsLink && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenLink(selectedKit.lmsLink)}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(selectedKit.lmsLink)}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            {canUpload && (
              <Button onClick={handleSaveLink}>
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
