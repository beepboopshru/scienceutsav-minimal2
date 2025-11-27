import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
] as const;

const GRADES = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

export default function ClientForm() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const client = useQuery(api.clients.get, id ? { id: id as Id<"clients"> } : "skip");
  const kits = useQuery(api.kits.list);
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);

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
    gradePlanning: GRADES.map(grade => ({
      grade,
      studentStrength: 0,
      schedule: {} as Record<string, Id<"kits"> | undefined>
    }))
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        clientId: client.clientId || "",
        organization: client.organization || "",
        contact: client.contact || "",
        email: client.email || "",
        address: {
          line1: client.address?.line1 || "",
          line2: client.address?.line2 || "",
          line3: client.address?.line3 || "",
          state: client.address?.state || "",
          pincode: client.address?.pincode || "",
          country: client.address?.country || "",
        },
        type: client.type || "one_time",
        notes: client.notes || "",
        salesPerson: client.salesPerson || "",
        pointsOfContact: client.pointsOfContact || [],
        gradePlanning: GRADES.map(grade => {
          const existingPlan = client.gradePlanning?.find(p => p.grade === grade);
          return {
            grade,
            studentStrength: existingPlan?.studentStrength || 0,
            schedule: existingPlan?.schedule || {}
          };
        })
      });
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        gradePlanning: formData.gradePlanning.map(p => ({
          grade: p.grade,
          studentStrength: p.studentStrength,
          schedule: p.schedule
        }))
      };

      if (id) {
        await updateClient({
          id: id as Id<"clients">,
          ...payload,
        });
        toast.success("Client updated successfully");
      } else {
        await createClient(payload);
        toast.success("Client created successfully");
      }
      navigate("/clients");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save client");
    }
  };

  if (isLoading || (id && !client)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-[1600px] mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {id ? "Edit Client" : "New Client"}
            </h1>
            <p className="text-muted-foreground">
              {id ? "Update client details and curriculum plan" : "Create a new client and define their curriculum"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Basic Info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Client Details</CardTitle>
                <CardDescription>Basic information and contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      placeholder="Auto-generated"
                      disabled={!id}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Phone</Label>
                    <Input
                      id="contact"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Address Line 1 *"
                      value={formData.address.line1}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, line1: e.target.value }
                      })}
                      required
                    />
                    <Input
                      placeholder="Address Line 2"
                      value={formData.address.line2}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, line2: e.target.value }
                      })}
                    />
                    <Input
                      placeholder="Address Line 3"
                      value={formData.address.line3}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, line3: e.target.value }
                      })}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="State *"
                        value={formData.address.state}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, state: e.target.value }
                        })}
                        required
                      />
                      <Input
                        placeholder="Pincode *"
                        value={formData.address.pincode}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, pincode: e.target.value }
                        })}
                        required
                      />
                      <Input
                        placeholder="Country *"
                        value={formData.address.country}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, country: e.target.value }
                        })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Client Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "monthly" | "one_time") =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="one_time">One Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salesPerson">Sales Person</Label>
                    <Input
                      id="salesPerson"
                      value={formData.salesPerson}
                      onChange={(e) => setFormData({ ...formData, salesPerson: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* POCs */}
            <Card>
              <CardHeader>
                <CardTitle>Points of Contact</CardTitle>
                <CardDescription>Additional contacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.pointsOfContact.map((poc, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2 relative">
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
                    <Input
                      placeholder="Name *"
                      value={poc.name}
                      onChange={(e) => {
                        const newPOCs = [...formData.pointsOfContact];
                        newPOCs[index] = { ...newPOCs[index], name: e.target.value };
                        setFormData({ ...formData, pointsOfContact: newPOCs });
                      }}
                      required
                    />
                    <Input
                      placeholder="Designation"
                      value={poc.designation}
                      onChange={(e) => {
                        const newPOCs = [...formData.pointsOfContact];
                        newPOCs[index] = { ...newPOCs[index], designation: e.target.value };
                        setFormData({ ...formData, pointsOfContact: newPOCs });
                      }}
                    />
                    <Input
                      placeholder="Phone"
                      value={poc.phone}
                      onChange={(e) => {
                        const newPOCs = [...formData.pointsOfContact];
                        newPOCs[index] = { ...newPOCs[index], phone: e.target.value };
                        setFormData({ ...formData, pointsOfContact: newPOCs });
                      }}
                    />
                    <Input
                      placeholder="Email"
                      value={poc.email}
                      onChange={(e) => {
                        const newPOCs = [...formData.pointsOfContact];
                        newPOCs[index] = { ...newPOCs[index], email: e.target.value };
                        setFormData({ ...formData, pointsOfContact: newPOCs });
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
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
              </CardContent>
            </Card>
          </div>

          {/* Curriculum Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Curriculum Matrix</CardTitle>
              <CardDescription>Plan kits and student strength per grade for each month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] sticky left-0 bg-background z-10">Grade</TableHead>
                      <TableHead className="w-[100px] sticky left-[100px] bg-background z-10">Strength</TableHead>
                      {MONTHS.map(month => (
                        <TableHead key={month} className="min-w-[200px] capitalize">
                          {month}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.gradePlanning.map((plan, index) => (
                      <TableRow key={plan.grade}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">
                          Grade {plan.grade}
                        </TableCell>
                        <TableCell className="sticky left-[100px] bg-background z-10">
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={plan.studentStrength || ""}
                            onChange={(e) => {
                              const newPlanning = [...formData.gradePlanning];
                              newPlanning[index] = {
                                ...newPlanning[index],
                                studentStrength: parseInt(e.target.value) || 0
                              };
                              setFormData({ ...formData, gradePlanning: newPlanning });
                            }}
                          />
                        </TableCell>
                        {MONTHS.map(month => (
                          <TableCell key={month}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between font-normal",
                                    !plan.schedule[month] && "text-muted-foreground"
                                  )}
                                >
                                  {plan.schedule[month]
                                    ? kits?.find((k) => k._id === plan.schedule[month])?.name
                                    : "Select kit"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search kits..." />
                                  <CommandList>
                                    <CommandEmpty>No kit found.</CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem
                                        value="none"
                                        onSelect={() => {
                                          const newPlanning = [...formData.gradePlanning];
                                          const newSchedule = { ...newPlanning[index].schedule };
                                          delete newSchedule[month];
                                          newPlanning[index] = { ...newPlanning[index], schedule: newSchedule };
                                          setFormData({ ...formData, gradePlanning: newPlanning });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            !plan.schedule[month] ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        None
                                      </CommandItem>
                                      {kits?.map((kit) => (
                                        <CommandItem
                                          key={kit._id}
                                          value={kit.name}
                                          onSelect={() => {
                                            const newPlanning = [...formData.gradePlanning];
                                            newPlanning[index] = {
                                              ...newPlanning[index],
                                              schedule: {
                                                ...newPlanning[index].schedule,
                                                [month]: kit._id
                                              }
                                            };
                                            setFormData({ ...formData, gradePlanning: newPlanning });
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              plan.schedule[month] === kit._id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {kit.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/clients")}>
              Cancel
            </Button>
            <Button type="submit">
              {id ? "Update Client" : "Create Client"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
