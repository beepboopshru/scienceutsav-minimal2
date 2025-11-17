import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, Upload, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

export default function LMS() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const programs = useQuery(api.programs.list);
  const kits = useQuery(api.kits.list);
  const updateLmsLink = useMutation(api.kits.updateLmsLink);

  const [selectedProgramId, setSelectedProgramId] = useState<Id<"programs"> | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [lmsLink, setLmsLink] = useState("");
  const [lmsNotes, setLmsNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!authLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const canView = hasPermission("lms", "view");
  const canEdit = hasPermission("lms", "edit");

  if (!canView) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  const filteredKits = kits?.filter((kit) => {
    const matchesProgram = selectedProgramId === "all" || kit.programId === selectedProgramId;
    const matchesCategory = categoryFilter === "all" || kit.category === categoryFilter;
    const hasLink = kit.lmsLink && kit.lmsLink.trim().length > 0;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "uploaded" && hasLink) ||
      (statusFilter === "not_uploaded" && !hasLink);
    const matchesSearch = !searchQuery || 
      kit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kit.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProgram && matchesCategory && matchesStatus && matchesSearch;
  }) || [];

  const categories = Array.from(new Set(kits?.map(k => k.category).filter(Boolean))) as string[];

  const handleOpenDialog = (kit: any) => {
    setSelectedKit(kit);
    setLmsLink(kit.lmsLink || "");
    setLmsNotes(kit.lmsNotes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedKit) return;

    // Validate URL if provided
    if (lmsLink && lmsLink.trim()) {
      try {
        new URL(lmsLink);
      } catch {
        toast.error("Please enter a valid URL");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateLmsLink({
        id: selectedKit._id,
        lmsLink: lmsLink.trim() || undefined,
        lmsNotes: lmsNotes.trim() || undefined,
      });
      toast.success("LMS link updated successfully");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating LMS link:", error);
      toast.error("Failed to update LMS link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProgram = programs?.find(p => p._id === selectedProgramId);

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">LMS Links</h1>
          <p className="text-muted-foreground mt-2">
            Manage Learning Management System links for kits
          </p>
        </motion.div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Select
                value={selectedProgramId}
                onValueChange={(value) => setSelectedProgramId(value as Id<"programs"> | "all")}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs?.map((program) => (
                    <SelectItem key={program._id} value={program._id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="not_uploaded">Not Uploaded</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by kit name or serial number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kits Table */}
        <Card>
          <CardContent className="pt-6">
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
                {filteredKits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No kits found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKits.map((kit) => {
                    const program = programs?.find(p => p._id === kit.programId);
                    const hasLink = kit.lmsLink && kit.lmsLink.trim().length > 0;
                    
                    return (
                      <TableRow key={kit._id}>
                        <TableCell>{kit.serialNumber || "-"}</TableCell>
                        <TableCell className="font-medium">{kit.name}</TableCell>
                        <TableCell>{kit.category || "-"}</TableCell>
                        <TableCell>{program?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={hasLink ? "default" : "secondary"}>
                            {hasLink ? "Uploaded" : "Not Uploaded"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {hasLink && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(kit.lmsLink, "_blank")}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(kit)}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                {hasLink ? "Edit" : "Upload"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Upload/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedKit?.lmsLink ? "Edit" : "Upload"} LMS Link
              </DialogTitle>
              <DialogDescription>
                {selectedKit?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lmsLink">LMS Link</Label>
                <Input
                  id="lmsLink"
                  placeholder="https://..."
                  value={lmsLink}
                  onChange={(e) => setLmsLink(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lmsNotes">Notes</Label>
                <Textarea
                  id="lmsNotes"
                  placeholder="Add any notes about this LMS link..."
                  value={lmsNotes}
                  onChange={(e) => setLmsNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
