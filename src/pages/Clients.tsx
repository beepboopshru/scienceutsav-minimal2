import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
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
import { Building2, Loader2, Mail, Phone, Plus, Pencil, Trash2, Search, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Clients() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const clients = useQuery(api.clients.list);
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);
  const removeClient = useMutation(api.clients.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Id<"clients"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewPocDialogOpen, setViewPocDialogOpen] = useState(false);
  const [viewAttendanceDialogOpen, setViewAttendanceDialogOpen] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    clientId: "",
    organization: "",
    contact: "",
    email: "",
    address: {
      line1: "",
      line2: "",
      line3: "",
      state: "",
      pincode: "",
      country: "",
    },
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

  const canEdit = hasPermission("clients", "edit");

  const handleOpenDialog = (clientId?: Id<"clients">) => {
    if (clientId) {
      navigate(`/clients/${clientId}/edit`);
    } else {
      navigate("/clients/new");
    }
  };

  const handleCloseDialog = () => {
    // Deprecated
  };

  const handleSubmit = async (e: React.FormEvent) => {
    // Deprecated
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    try {
      const result = await removeClient({ id: id as any });
      if (result && 'requestCreated' in result && result.requestCreated) {
        toast.success("Deletion request submitted for admin approval");
      } else {
        toast.success("Client deleted");
      }
    } catch (err) {
      toast.error("Failed to delete client");
    }
  };

  const filteredClients = clients?.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.organization?.toLowerCase().includes(query) ||
      client.contact?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.clientId?.toLowerCase().includes(query)
    );
  });

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">B2B Client Management</h1>
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
                                <span className="font-medium">{client.organization || client.name}</span>
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
                                    setSelectedClientForView(client);
                                    setViewAttendanceDialogOpen(true);
                                  }}
                                  title="View Grade Attendance"
                                >
                                  <Calendar className="h-4 w-4" />
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
                          <td colSpan={canEdit ? 6 : 5} className="p-0">
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

        {/* View POC Dialog */}
        <Dialog open={viewPocDialogOpen} onOpenChange={setViewPocDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Points of Contact</DialogTitle>
              <DialogDescription>
                {selectedClientForView?.organization || selectedClientForView?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Organization Details */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <h4 className="font-semibold text-sm">Organization Details</h4>
                {selectedClientForView?.contact && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClientForView.contact}</span>
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
                    <div className="flex flex-col">
                      <span>{selectedClientForView.address.line1}</span>
                      {selectedClientForView.address.line2 && (
                        <span>{selectedClientForView.address.line2}</span>
                      )}
                      {selectedClientForView.address.line3 && (
                        <span>{selectedClientForView.address.line3}</span>
                      )}
                      <span>
                        {selectedClientForView.address.state}, {selectedClientForView.address.pincode}
                      </span>
                      <span>{selectedClientForView.address.country}</span>
                    </div>
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
                  No points of contact added for this client.
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

        {/* View Attendance Dialog */}
        <Dialog open={viewAttendanceDialogOpen} onOpenChange={setViewAttendanceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Grade Attendance (Class Strength)</DialogTitle>
              <DialogDescription>
                {selectedClientForView?.organization || selectedClientForView?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedClientForView?.gradeAttendance ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => {
                    const gradeKey = `grade${grade}` as keyof typeof selectedClientForView.gradeAttendance;
                    const attendance = selectedClientForView.gradeAttendance?.[gradeKey];
                    return (
                      <div key={grade} className="p-4 border rounded-lg">
                        <div className="text-sm font-semibold text-muted-foreground mb-1">
                          Grade {grade}
                        </div>
                        <div className="text-2xl font-bold">
                          {attendance !== undefined && attendance !== null ? attendance : "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance data available for this client.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewAttendanceDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <Label htmlFor="organization">Organization *</Label>
                  <Input
                    id="organization"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
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
                  <Label htmlFor="email">Organization Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="organization@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact">Organization Phone</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="address-line1" className="text-xs text-muted-foreground">
                        Address Line 1 *
                      </Label>
                      <Input
                        id="address-line1"
                        value={formData.address.line1}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, line1: e.target.value },
                          })
                        }
                        placeholder="Street address, P.O. box"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address-line2" className="text-xs text-muted-foreground">
                        Address Line 2
                      </Label>
                      <Input
                        id="address-line2"
                        value={formData.address.line2}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, line2: e.target.value },
                          })
                        }
                        placeholder="Apartment, suite, unit, building, floor, etc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="address-line3" className="text-xs text-muted-foreground">
                        Address Line 3
                      </Label>
                      <Input
                        id="address-line3"
                        value={formData.address.line3}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, line3: e.target.value },
                          })
                        }
                        placeholder="Additional address information"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="state" className="text-xs text-muted-foreground">
                          State *
                        </Label>
                        <Input
                          id="state"
                          value={formData.address.state}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, state: e.target.value },
                            })
                          }
                          placeholder="State"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="pincode" className="text-xs text-muted-foreground">
                          Pincode *
                        </Label>
                        <Input
                          id="pincode"
                          value={formData.address.pincode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, pincode: e.target.value },
                            })
                          }
                          placeholder="Pincode"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="country" className="text-xs text-muted-foreground">
                        Country *
                      </Label>
                      <Input
                        id="country"
                        value={formData.address.country}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, country: e.target.value },
                          })
                        }
                        placeholder="Country"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Client Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "monthly" | "one_time") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select client type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="one_time">One Time</SelectItem>
                    </SelectContent>
                  </Select>
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