import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, Wrench, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function Services() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const services = useQuery(api.services.list);
  
  const createService = useMutation(api.services.create);
  const updateService = useMutation(api.services.update);
  const removeService = useMutation(api.services.remove);

  const [searchTerm, setSearchTerm] = useState("");
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [editServiceOpen, setEditServiceOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  const [serviceForm, setServiceForm] = useState({
    name: "",
    serviceType: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !services) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddService = async () => {
    try {
      await createService(serviceForm);
      toast.success("Service provider added successfully");
      setAddServiceOpen(false);
      setServiceForm({
        name: "",
        serviceType: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to add service provider");
    }
  };

  const handleEditService = async () => {
    if (!selectedService) return;
    try {
      await updateService({ id: selectedService._id, ...serviceForm });
      toast.success("Service provider updated successfully");
      setEditServiceOpen(false);
      setSelectedService(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update service provider");
    }
  };

  const openEditDialog = (service: any) => {
    setSelectedService(service);
    setServiceForm({
      name: service.name,
      serviceType: service.serviceType,
      contactPerson: service.contactPerson || "",
      email: service.email || "",
      phone: service.phone || "",
      address: service.address || "",
      notes: service.notes || "",
    });
    setEditServiceOpen(true);
  };

  const handleDeleteService = async (serviceId: Id<"services">) => {
    if (!confirm("Delete this service provider? This action cannot be undone.")) return;
    try {
      await removeService({ id: serviceId });
      toast.success("Service provider deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete service provider");
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Service Providers</h1>
              <p className="text-muted-foreground mt-2">
                Manage external service providers for specialized processing
              </p>
            </div>
            <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Service Provider</DialogTitle>
                  <DialogDescription>Create a new service provider record</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Service Provider Name *</Label>
                      <Input
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                        placeholder="XYZ Laser Services"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Service Type *</Label>
                      <Input
                        value={serviceForm.serviceType}
                        onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                        placeholder="Laser Cutting, 3D Printing, etc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input
                        value={serviceForm.contactPerson}
                        onChange={(e) => setServiceForm({ ...serviceForm, contactPerson: e.target.value })}
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={serviceForm.phone}
                        onChange={(e) => setServiceForm({ ...serviceForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={serviceForm.email}
                      onChange={(e) => setServiceForm({ ...serviceForm, email: e.target.value })}
                      placeholder="contact@xyzlaser.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={serviceForm.address}
                      onChange={(e) => setServiceForm({ ...serviceForm, address: e.target.value })}
                      placeholder="Street, City, State, PIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={serviceForm.notes}
                      onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
                      placeholder="Turnaround time, quality notes, specializations, etc."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddServiceOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddService}>Add Service</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Search Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, service type, or contact person..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {filteredServices.map((service) => (
              <Card key={service._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription>
                        <Badge variant="secondary" className="mt-1">
                          {service.serviceType}
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(service)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteService(service._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {service.contactPerson && (
                    <div className="flex items-center gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>{service.contactPerson}</span>
                    </div>
                  )}
                  {service.phone && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Phone: </span>
                      <span>{service.phone}</span>
                    </div>
                  )}
                  {service.email && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Email: </span>
                      <span>{service.email}</span>
                    </div>
                  )}
                  {service.address && (
                    <>
                      <Separator />
                      <div className="text-sm text-muted-foreground">
                        {service.address}
                      </div>
                    </>
                  )}
                  {service.notes && (
                    <>
                      <Separator />
                      <div className="text-sm">
                        <span className="font-medium">Notes: </span>
                        <span className="text-muted-foreground">{service.notes}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredServices.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "No service providers found matching your search" : "No service providers added yet"}
                </p>
              </CardContent>
            </Card>
          )}

          <Dialog open={editServiceOpen} onOpenChange={setEditServiceOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Service Provider</DialogTitle>
                <DialogDescription>Update service provider information</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service Provider Name *</Label>
                    <Input
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Type *</Label>
                    <Input
                      value={serviceForm.serviceType}
                      onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={serviceForm.contactPerson}
                      onChange={(e) => setServiceForm({ ...serviceForm, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={serviceForm.phone}
                      onChange={(e) => setServiceForm({ ...serviceForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={serviceForm.email}
                    onChange={(e) => setServiceForm({ ...serviceForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={serviceForm.address}
                    onChange={(e) => setServiceForm({ ...serviceForm, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={serviceForm.notes}
                    onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditServiceOpen(false)}>Cancel</Button>
                <Button onClick={handleEditService}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </Layout>
  );
}
