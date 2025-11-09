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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClientMonthwiseView } from "@/components/ClientMonthwiseView";
import { useQuery, useMutation } from "convex/react";
import { Building2, Loader2, Mail, Phone, Plus, Pencil, Trash2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Clients() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const clients = useQuery(api.clients.list);
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);
  const removeClient = useMutation(api.clients.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Id<"clients"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    organization: "",
    contact: "",
    email: "",
    type: "one_time" as "monthly" | "one_time",
    notes: "",
    salesPerson: "",
    pointsOfContact: [] as Array<{
      name: string;
      designation?: string;
      phone?: string;
      email?: string;
    }>,
    gradeAttendance: {
      grade1: undefined as number | undefined,
      grade2: undefined as number | undefined,
      grade3: undefined as number | undefined,
      grade4: undefined as number | undefined,
      grade5: undefined as number | undefined,
      grade6: undefined as number | undefined,
      grade7: undefined as number | undefined,
      grade8: undefined as number | undefined,
      grade9: undefined as number | undefined,
      grade10: undefined as number | undefined,
      grade11: undefined as number | undefined,
      grade12: undefined as number | undefined,
    },
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

  const handleOpenDialog = (clientId?: Id<"clients">) => {
    if (clientId && clients) {
      const client = clients.find((c) => c._id === clientId);
      if (client) {
        setFormData({
          name: client.name,
          organization: client.organization || "",
          contact: client.contact || "",
          email: client.email || "",
          type: client.type || "one_time",
          notes: client.notes || "",
          salesPerson: client.salesPerson || "",
          pointsOfContact: client.pointsOfContact || [],
          gradeAttendance: {
            grade1: client.gradeAttendance?.grade1 ?? undefined,
            grade2: client.gradeAttendance?.grade2 ?? undefined,
            grade3: client.gradeAttendance?.grade3 ?? undefined,
            grade4: client.gradeAttendance?.grade4 ?? undefined,
            grade5: client.gradeAttendance?.grade5 ?? undefined,
            grade6: client.gradeAttendance?.grade6 ?? undefined,
            grade7: client.gradeAttendance?.grade7 ?? undefined,
            grade8: client.gradeAttendance?.grade8 ?? undefined,
            grade9: client.gradeAttendance?.grade9 ?? undefined,
            grade10: client.gradeAttendance?.grade10 ?? undefined,
            grade11: client.gradeAttendance?.grade11 ?? undefined,
            grade12: client.gradeAttendance?.grade12 ?? undefined,
          },
        });
        setEditingClient(clientId);
      }
    } else {
      setFormData({
        name: "",
        organization: "",
        contact: "",
        email: "",
        type: "one_time",
        notes: "",
        salesPerson: "",
        pointsOfContact: [],
        gradeAttendance: {
          grade1: undefined,
          grade2: undefined,
          grade3: undefined,
          grade4: undefined,
          grade5: undefined,
          grade6: undefined,
          grade7: undefined,
          grade8: undefined,
          grade9: undefined,
          grade10: undefined,
          grade11: undefined,
          grade12: undefined,
        },
      });
      setEditingClient(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setFormData({
      name: "",
      organization: "",
      contact: "",
      email: "",
      type: "one_time",
      notes: "",
      salesPerson: "",
      pointsOfContact: [],
      gradeAttendance: {
        grade1: undefined,
        grade2: undefined,
        grade3: undefined,
        grade4: undefined,
        grade5: undefined,
        grade6: undefined,
        grade7: undefined,
        grade8: undefined,
        grade9: undefined,
        grade10: undefined,
        grade11: undefined,
        grade12: undefined,
      },
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

  const handleDelete = async (clientId: Id<"clients">) => {
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
      client.name.toLowerCase().includes(query) ||
      client.organization?.toLowerCase().includes(query) ||
      client.contact?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Client Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage your client database and contact information
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
              placeholder="Search by name, organization, phone, or email..."
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
                    <th className="text-left p-4 font-semibold">Organization</th>
                    <th className="text-left p-4 font-semibold">Contact Person</th>
                    <th className="text-left p-4 font-semibold">Phone</th>
                    <th className="text-left p-4 font-semibold">Email</th>
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
                              <span className="font-medium">{client.organization || client.name}</span>
                            </AccordionTrigger>
                          </td>
                          <td className="p-4">
                            {client.organization && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{client.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {client.contact && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{client.contact}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {client.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{client.email}</span>
                              </div>
                            )}
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
                          <td colSpan={canEdit ? 8 : 7} className="p-0">
                            <AccordionContent className="px-4 pb-4">
                              <ClientMonthwiseView clientId={client._id} />
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
                  <Label htmlFor="name">Contact Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization *</Label>
                  <Input
                    id="organization"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Points of Contact</Label>
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
                    <p className="text-sm text-muted-foreground">No points of contact added yet.</p>
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
                  <Label>Grade Attendance (Class Strength)</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-md">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                      <div key={grade} className="space-y-1">
                        <Label htmlFor={`grade${grade}`} className="text-xs">
                          Grade {grade}
                        </Label>
                        <Input
                          id={`grade${grade}`}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.gradeAttendance[`grade${grade}` as keyof typeof formData.gradeAttendance] || ""}
                          onChange={(e) => {
                            const value = e.target.value === "" ? undefined : parseInt(e.target.value);
                            setFormData({
                              ...formData,
                              gradeAttendance: {
                                ...formData.gradeAttendance,
                                [`grade${grade}`]: value,
                              },
                            });
                          }}
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
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