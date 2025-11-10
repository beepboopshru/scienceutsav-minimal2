import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { Building2, Loader2, Mail, Phone, Plus, Pencil, Trash2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function B2CClients() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const clients = useQuery(api.b2cClients.list);
  const createClient = useMutation(api.b2cClients.create);
  const updateClient = useMutation(api.b2cClients.update);
  const removeClient = useMutation(api.b2cClients.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Id<"b2cClients"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewPocDialogOpen, setViewPocDialogOpen] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<any>(null);
  const [formData, setFormData] = useState({
    buyerName: "",
    clientId: "",
    phone: "",
    email: "",
    address: "",
    type: "one_time" as "monthly" | "one_time",
    notes: "",
    salesPerson: "",
    pointsOfContact: [] as Array<{
      name: string;
      designation?: string;
      phone?: string;
      email?: string;
    }>,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const canEdit = user.role === "admin" || user.role === "operations";

  const handleOpenDialog = (clientId?: Id<"b2cClients">) => {
    if (clientId && clients) {
      const client = clients.find((c) => c._id === clientId);
      if (client) {
        setFormData({
          buyerName: client.buyerName,
          clientId: client.clientId || "",
          phone: client.phone || "",
          email: client.email || "",
          address: client.address || "",
          type: client.type || "one_time",
          notes: client.notes || "",
          salesPerson: client.salesPerson || "",
          pointsOfContact: client.pointsOfContact || [],
        });
        setEditingClient(clientId);
      }
    } else {
      setFormData({
        buyerName: "",
        clientId: "",
        phone: "",
        email: "",
        address: "",
        type: "one_time",
        notes: "",
        salesPerson: "",
        pointsOfContact: [],
      });
      setEditingClient(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setFormData({
      buyerName: "",
      clientId: "",
      phone: "",
      email: "",
      address: "",
      type: "one_time",
      notes: "",
      salesPerson: "",
      pointsOfContact: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await updateClient({
          id: editingClient,
          ...formData,
        });
        toast.success("Client updated successfully");
      } else {
        await createClient(formData);
        toast.success("Client created successfully");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save client");
    }
  };

  const handleDelete = async (clientId: Id<"b2cClients">) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    try {
      await removeClient({ id: clientId });
      toast.success("Client deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete client");
    }
  };

  const filteredClients = clients?.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.buyerName.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.clientId?.toLowerCase().includes(query)
    );
  });

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">B2C Client Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage your individual buyer database and contact information
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          )}
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by buyer name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          {!filteredClients ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No clients found matching your search." : "No clients yet. Add your first client to get started."}
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">Buyer Name</th>
                    <th className="text-left p-4 font-semibold">Type</th>
                    <th className="text-left p-4 font-semibold">Sales Person</th>
                    <th className="text-left p-4 font-semibold">Created</th>
                    {canEdit && <th className="text-right p-4 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <AccordionItem key={client._id} value={client._id} className="border-b last:border-b-0" asChild>
                      <>
                        <tr className="hover:bg-muted/30">
                          <td className="p-4">
                            <AccordionTrigger className="hover:no-underline py-0 w-full justify-start">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{client.buyerName}</span>
                                {client.clientId && (
                                  <span className="text-xs text-muted-foreground">{client.clientId}</span>
                                )}
                              </div>
                            </AccordionTrigger>
                          </td>
                          <td className="p-4">
                            <Badge variant={client.type === "monthly" ? "default" : "secondary"}>
                              {client.type === "monthly" ? "Monthly" : "One Time"}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{client.salesPerson || "-"}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-muted-foreground">
                              {new Date(client._creationTime).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClientForView(client);
                                    setViewPocDialogOpen(true);
                                  }}
                                  title="View Points of Contact"
                                >
                                  <Building2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDialog(client._id);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(client._id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                        <tr>
                          <td colSpan={canEdit ? 5 : 4} className="p-0">
                            <AccordionContent className="px-4 pb-4">
                              <div className="text-sm text-muted-foreground">
                                Assignment history will be available once B2C Assignments are implemented.
                              </div>
                            </AccordionContent>
                          </td>
                        </tr>
                      </>
                    </AccordionItem>
                  ))}
                </tbody>
              </table>
            </Accordion>
          )}
        </div>

        {/* View POC Dialog */}
        <Dialog open={viewPocDialogOpen} onOpenChange={setViewPocDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Points of Contact</DialogTitle>
              <DialogDescription>
                {selectedClientForView?.buyerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Buyer Details */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <h4 className="font-semibold text-sm">Buyer Details</h4>
                {selectedClientForView?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClientForView.phone}</span>
                  </div>
                )}
                {selectedClientForView?.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClientForView.email}</span>
                  </div>
                )}
                {selectedClientForView?.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{selectedClientForView.address}</span>
                  </div>
                )}
              </div>
              {selectedClientForView?.pointsOfContact && selectedClientForView.pointsOfContact.length > 0 ? (
                selectedClientForView.pointsOfContact.map((poc: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{poc.name}</span>
                      {poc.designation && (
                        <Badge variant="secondary">{poc.designation}</Badge>
                      )}
                    </div>
                    {poc.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{poc.phone}</span>
                      </div>
                    )}
                    {poc.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{poc.email}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No additional points of contact added for this client.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewPocDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Client Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
              <DialogDescription>
                {editingClient
                  ? "Update client information below."
                  : "Enter client details to add them to your database."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="buyerName">Buyer Name *</Label>
                  <Input
                    id="buyerName"
                    value={formData.buyerName}
                    onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                    required
                  />
                </div>

                {editingClient && (
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      placeholder="Auto-generated on creation"
                    />
                    <p className="text-xs text-muted-foreground">
                      Client ID can be edited after creation if needed
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Buyer Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="buyer@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Buyer Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Buyer address"
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Points of Contact (Optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          pointsOfContact: [
                            ...formData.pointsOfContact,
                            { name: "", designation: "", phone: "", email: "" },
                          ],
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add POC
                    </Button>
                  </div>
                  
                  {formData.pointsOfContact.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No additional points of contact added yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {formData.pointsOfContact.map((poc, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={() => {
                              const newPOCs = formData.pointsOfContact.filter((_, i) => i !== index);
                              setFormData({ ...formData, pointsOfContact: newPOCs });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`poc-name-${index}`}>Name *</Label>
                            <Input
                              id={`poc-name-${index}`}
                              value={poc.name}
                              onChange={(e) => {
                                const newPOCs = [...formData.pointsOfContact];
                                newPOCs[index] = { ...newPOCs[index], name: e.target.value };
                                setFormData({ ...formData, pointsOfContact: newPOCs });
                              }}
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`poc-designation-${index}`}>Designation</Label>
                            <Input
                              id={`poc-designation-${index}`}
                              value={poc.designation || ""}
                              onChange={(e) => {
                                const newPOCs = [...formData.pointsOfContact];
                                newPOCs[index] = { ...newPOCs[index], designation: e.target.value };
                                setFormData({ ...formData, pointsOfContact: newPOCs });
                              }}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`poc-phone-${index}`}>Phone Number</Label>
                            <Input
                              id={`poc-phone-${index}`}
                              value={poc.phone || ""}
                              onChange={(e) => {
                                const newPOCs = [...formData.pointsOfContact];
                                newPOCs[index] = { ...newPOCs[index], phone: e.target.value };
                                setFormData({ ...formData, pointsOfContact: newPOCs });
                              }}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`poc-email-${index}`}>Email</Label>
                            <Input
                              id={`poc-email-${index}`}
                              type="email"
                              value={poc.email || ""}
                              onChange={(e) => {
                                const newPOCs = [...formData.pointsOfContact];
                                newPOCs[index] = { ...newPOCs[index], email: e.target.value };
                                setFormData({ ...formData, pointsOfContact: newPOCs });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salesPerson">Sales Person</Label>
                  <Input
                    id="salesPerson"
                    value={formData.salesPerson}
                    onChange={(e) => setFormData({ ...formData, salesPerson: e.target.value })}
                    placeholder="Enter sales person name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Delivery preferences, billing info, packing constraints..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">{editingClient ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
