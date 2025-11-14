import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Plus, FileText, Download, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BillTracking() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentRequestsStatusFilter, setPaymentRequestsStatusFilter] = useState<string>("all");
  const [vendorBillsStatusFilter, setVendorBillsStatusFilter] = useState<string>("all");

  const bills = useQuery(api.billTracking.list);
  const vendorImports = useQuery(api.vendorImports.list);
  const createBill = useMutation(api.billTracking.create);
  const updateStatus = useMutation(api.billTracking.updateStatus);
  const updateVendorPaymentStatus = useMutation(api.vendorImports.updatePaymentStatus);
  const generateUploadUrl = useMutation(api.billTracking.generateUploadUrl);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const canCreate = ["admin", "operations", "manager"].includes(user.role || "");
  const canUpdateStatus = ["admin", "finance"].includes(user.role || "");

  const handleCreateBill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      let billFileId: Id<"_storage"> | undefined;

      if (selectedFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        const { storageId } = await result.json();
        billFileId = storageId;
      }

      await createBill({
        companyName: formData.get("companyName") as string,
        projectName: formData.get("projectName") as string,
        requirement: formData.get("requirement") as string,
        priority: formData.get("priority") as "low" | "medium" | "high" | "urgent",
        billFileId,
        notes: formData.get("notes") as string || undefined,
      });

      toast.success("Bill created successfully");
      setCreateDialogOpen(false);
      setSelectedFile(null);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error("Error creating bill:", error);
      toast.error("Failed to create bill");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (billId: Id<"billTracking">, newStatus: string) => {
    try {
      await updateStatus({
        id: billId,
        status: newStatus as "requested" | "acknowledged" | "in_progress" | "done",
      });
      toast.success("Status updated successfully");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleVendorPaymentStatusChange = async (vendorImportId: Id<"vendorImports">, newStatus: string) => {
    try {
      await updateVendorPaymentStatus({
        id: vendorImportId,
        status: newStatus as "requested" | "acknowledged" | "in_progress" | "done",
      });
      toast.success("Payment status updated successfully");
    } catch (error) {
      console.error("Error updating payment status:", error);
      toast.error("Failed to update payment status");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": return "default";
      case "in_progress": return "secondary";
      case "acknowledged": return "outline";
      case "requested": return "outline";
      default: return "secondary";
    }
  };

  // Filter bills based on status
  const filteredBills = bills?.filter(bill => 
    paymentRequestsStatusFilter === "all" || bill.status === paymentRequestsStatusFilter
  );

  const filteredVendorImports = vendorImports?.filter(vendorImport => 
    vendorBillsStatusFilter === "all" || (vendorImport.paymentStatus || "requested") === vendorBillsStatusFilter
  );

  return (
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Bill Tracking</h1>
              <p className="text-muted-foreground mt-2">
                Track payment requests and vendor bills
              </p>
            </div>
            {canCreate && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Bill
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Bill</DialogTitle>
                    <DialogDescription>
                      Submit a new bill for payment processing
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateBill}>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Company Name *</Label>
                          <Input id="companyName" name="companyName" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="projectName">Project Name *</Label>
                          <Input id="projectName" name="projectName" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="requirement">Requirement *</Label>
                        <Textarea id="requirement" name="requirement" required rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority *</Label>
                        <Select name="priority" defaultValue="medium" required>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billFile">Upload Bill (Optional)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="billFile"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="cursor-pointer"
                          />
                          {selectedFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedFile(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea id="notes" name="notes" rows={2} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Bill"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Tabs defaultValue="payment-requests" className="space-y-4">
            <TabsList>
              <TabsTrigger value="payment-requests">Payment Requests</TabsTrigger>
              <TabsTrigger value="vendor-bills">Vendor Bills (Inventory)</TabsTrigger>
            </TabsList>

            <TabsContent value="payment-requests" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Payment Requests</CardTitle>
                      <CardDescription>Bills submitted for payment processing</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="payment-status-filter" className="text-sm">Filter by Status:</Label>
                      <Select value={paymentRequestsStatusFilter} onValueChange={setPaymentRequestsStatusFilter}>
                        <SelectTrigger id="payment-status-filter" className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="requested">Requested</SelectItem>
                          <SelectItem value="acknowledged">Acknowledged</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!bills ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredBills && filteredBills.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No bills found for the selected filter
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Requirement</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Bill</TableHead>
                          {canUpdateStatus && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBills?.map((bill) => (
                          <TableRow key={bill._id}>
                            <TableCell className="font-medium">{bill.companyName}</TableCell>
                            <TableCell>{bill.projectName}</TableCell>
                            <TableCell className="max-w-xs truncate">{bill.requirement}</TableCell>
                            <TableCell>
                              <Badge variant={getPriorityColor(bill.priority)}>
                                {bill.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(bill.status)}>
                                {bill.status.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {bill.billFileId && (
                                <BillFileDownload storageId={bill.billFileId} />
                              )}
                            </TableCell>
                            {canUpdateStatus && (
                              <TableCell>
                                <Select
                                  value={bill.status}
                                  onValueChange={(value) => handleStatusChange(bill._id, value)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="requested">Requested</SelectItem>
                                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendor-bills" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Vendor Bills from Inventory</CardTitle>
                      <CardDescription>Bills imported through inventory management</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="vendor-status-filter" className="text-sm">Filter by Status:</Label>
                      <Select value={vendorBillsStatusFilter} onValueChange={setVendorBillsStatusFilter}>
                        <SelectTrigger id="vendor-status-filter" className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="requested">Requested</SelectItem>
                          <SelectItem value="acknowledged">Acknowledged</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!vendorImports ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredVendorImports && filteredVendorImports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No vendor bills found for the selected filter
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill Number</TableHead>
                          <TableHead>Bill Date</TableHead>
                          <TableHead>Total Amount</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Payment Status</TableHead>
                          <TableHead>Bill Image</TableHead>
                          {canUpdateStatus && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVendorImports?.map((vendorImport) => (
                          <TableRow key={vendorImport._id}>
                            <TableCell className="font-medium">{vendorImport.billNumber}</TableCell>
                            <TableCell>{vendorImport.billDate}</TableCell>
                            <TableCell>₹{vendorImport.totalAmount.toLocaleString()}</TableCell>
                            <TableCell>{vendorImport.items.length} items</TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(vendorImport.paymentStatus || "requested")}>
                                {(vendorImport.paymentStatus || "requested").replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {vendorImport.billImageId && (
                                <VendorBillDownload storageId={vendorImport.billImageId} />
                              )}
                            </TableCell>
                            {canUpdateStatus && (
                              <TableCell>
                                <Select
                                  value={vendorImport.paymentStatus || "requested"}
                                  onValueChange={(value) => handleVendorPaymentStatusChange(vendorImport._id, value)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="requested">Requested</SelectItem>
                                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}

function BillFileDownload({ storageId }: { storageId: Id<"_storage"> }) {
  const fileUrl = useQuery(api.billTracking.getBillFileUrl, { storageId });

  if (!fileUrl) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <Button variant="ghost" size="sm" asChild>
      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
        <Download className="h-4 w-4" />
      </a>
    </Button>
  );
}

function VendorBillDownload({ storageId }: { storageId: Id<"_storage"> }) {
  const fileUrl = useQuery(api.vendorImports.getBillImageUrl, { storageId });

  if (!fileUrl) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <Button variant="ghost" size="sm" asChild>
      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
        <Download className="h-4 w-4" />
      </a>
    </Button>
  );
}