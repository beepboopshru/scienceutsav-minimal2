import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, Contact, Edit, Trash2 } from "lucide-react";
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

export default function VendorContacts() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const vendors = useQuery(api.vendors.list);
  const inventory = useQuery(api.inventory.list);
  
  const createVendor = useMutation(api.vendors.create);
  const updateVendor = useMutation(api.vendors.update);
  const removeVendor = useMutation(api.vendors.remove);

  const [searchTerm, setSearchTerm] = useState("");
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [editVendorOpen, setEditVendorOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const [vendorForm, setVendorForm] = useState({
    name: "",
    organization: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    gstn: "",
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

  if (isLoading || !user || !vendors) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddVendor = async () => {
    try {
      await createVendor(vendorForm);
      toast.success("Vendor added successfully");
      setAddVendorOpen(false);
      setVendorForm({
        name: "",
        organization: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        gstn: "",
        notes: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to add vendor");
    }
  };

  const handleEditVendor = async () => {
    if (!selectedVendor) return;
    try {
      await updateVendor({ id: selectedVendor._id, ...vendorForm });
      toast.success("Vendor updated successfully");
      setEditVendorOpen(false);
      setSelectedVendor(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update vendor");
    }
  };

  const openEditDialog = (vendor: any) => {
    setSelectedVendor(vendor);
    setVendorForm({
      name: vendor.name,
      organization: vendor.organization || "",
      contactPerson: vendor.contactPerson || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      gstn: vendor.gstn || "",
      notes: vendor.notes || "",
    });
    setEditVendorOpen(true);
  };

  const handleDeleteVendor = async (vendorId: Id<"vendors">) => {
    if (!confirm("Delete this vendor? This action cannot be undone.")) return;
    try {
      await removeVendor({ id: vendorId });
      toast.success("Vendor deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete vendor");
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
              <h1 className="text-3xl font-bold tracking-tight">Vendor Contacts</h1>
              <p className="text-muted-foreground mt-2">
                Manage supplier relationships and procurement records
              </p>
            </div>
            <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vendor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Vendor Contact</DialogTitle>
                  <DialogDescription>Create a new vendor record</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vendor Name *</Label>
                      <Input
                        value={vendorForm.name}
                        onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                        placeholder="ABC Suppliers"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Organization</Label>
                      <Input
                        value={vendorForm.organization}
                        onChange={(e) => setVendorForm({ ...vendorForm, organization: e.target.value })}
                        placeholder="ABC Pvt Ltd"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input
                        value={vendorForm.contactPerson}
                        onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={vendorForm.phone}
                        onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={vendorForm.email}
                        onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                        placeholder="contact@abcsuppliers.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>GSTN</Label>
                      <Input
                        value={vendorForm.gstn}
                        onChange={(e) => setVendorForm({ ...vendorForm, gstn: e.target.value })}
                        placeholder="22AAAAA0000A1Z5"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={vendorForm.address}
                      onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                      placeholder="Street, City, State, PIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={vendorForm.notes}
                      onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                      placeholder="Payment terms, quality notes, etc."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddVendorOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddVendor}>Add Vendor</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Search Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, organization, or contact person..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {filteredVendors.map((vendor) => (
              <Card key={vendor._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{vendor.name}</CardTitle>
                      {vendor.organization && (
                        <CardDescription>{vendor.organization}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(vendor)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteVendor(vendor._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vendor.contactPerson && (
                    <div className="flex items-center gap-2 text-sm">
                      <Contact className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.contactPerson}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Phone: </span>
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.email && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Email: </span>
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.gstn && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">GSTN: </span>
                      <Badge variant="outline">{vendor.gstn}</Badge>
                    </div>
                  )}
                  {vendor.address && (
                    <>
                      <Separator />
                      <div className="text-sm text-muted-foreground">
                        {vendor.address}
                      </div>
                    </>
                  )}
                  {vendor.notes && (
                    <>
                      <Separator />
                      <div className="text-sm">
                        <span className="font-medium">Notes: </span>
                        <span className="text-muted-foreground">{vendor.notes}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredVendors.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Contact className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "No vendors found matching your search" : "No vendors added yet"}
                </p>
              </CardContent>
            </Card>
          )}

          <Dialog open={editVendorOpen} onOpenChange={setEditVendorOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Vendor Contact</DialogTitle>
                <DialogDescription>Update vendor information</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vendor Name *</Label>
                    <Input
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input
                      value={vendorForm.organization}
                      onChange={(e) => setVendorForm({ ...vendorForm, organization: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={vendorForm.contactPerson}
                      onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GSTN</Label>
                    <Input
                      value={vendorForm.gstn}
                      onChange={(e) => setVendorForm({ ...vendorForm, gstn: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={vendorForm.address}
                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={vendorForm.notes}
                    onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditVendorOpen(false)}>Cancel</Button>
                <Button onClick={handleEditVendor}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </Layout>
  );
}
