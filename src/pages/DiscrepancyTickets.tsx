import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Plus, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function DiscrepancyTickets() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const tickets = useQuery(api.discrepancyTickets.list);
  const clients = useQuery(api.clients.list);
  const createTicket = useMutation(api.discrepancyTickets.create);
  const updateStatus = useMutation(api.discrepancyTickets.updateStatus);
  const deleteTicket = useMutation(api.discrepancyTickets.deleteTicket);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | "">("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [discrepancy, setDiscrepancy] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
    if (!isLoading && isAuthenticated && user && user.role && !["admin", "operations", "manager"].includes(user.role)) {
      toast.error("Access denied: Operations role required");
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleCreateTicket = async () => {
    if (!selectedClientId || !discrepancy.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await createTicket({
        clientId: selectedClientId as Id<"clients">,
        priority,
        discrepancy: discrepancy.trim(),
      });
      toast.success("Discrepancy ticket created");
      setCreateDialogOpen(false);
      setSelectedClientId("");
      setPriority("medium");
      setDiscrepancy("");
    } catch (error) {
      toast.error("Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (ticketId: Id<"discrepancyTickets">, newStatus: "open" | "in_progress" | "resolved" | "closed") => {
    try {
      await updateStatus({ ticketId, status: newStatus });
      toast.success("Ticket status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteTicket = async (ticketId: Id<"discrepancyTickets">) => {
    try {
      await deleteTicket({ ticketId });
      toast.success("Ticket deleted");
    } catch (error) {
      toast.error("Failed to delete ticket");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "destructive";
      case "in_progress":
        return "default";
      case "resolved":
        return "secondary";
      case "closed":
        return "outline";
      default:
        return "outline";
    }
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
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Discrepancy Tickets</h1>
              <p className="text-muted-foreground mt-2">
                Track and manage client discrepancies
              </p>
            </div>
            {user.role === "admin" && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Discrepancy Ticket</DialogTitle>
                    <DialogDescription>
                      Report a client discrepancy for tracking and resolution
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select value={selectedClientId as string} onValueChange={(v) => setSelectedClientId(v as Id<"clients">)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((client) => (
                            <SelectItem key={client._id} value={client._id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
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
                      <Label>Discrepancy Details</Label>
                      <Textarea
                        value={discrepancy}
                        onChange={(e) => setDiscrepancy(e.target.value)}
                        placeholder="Describe the discrepancy..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTicket} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Ticket"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-4">
            {!tickets || tickets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No discrepancy tickets found</p>
                </CardContent>
              </Card>
            ) : (
              tickets.map((ticket) => (
                <motion.div
                  key={ticket._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {ticket.client?.name || "Unknown Client"}
                          </CardTitle>
                          <CardDescription>
                            Created by {ticket.creator?.name || ticket.creator?.email || "Unknown"} on{" "}
                            {new Date(ticket._creationTime).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          {user.role === "admin" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTicket(ticket._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Discrepancy:</p>
                        <p className="text-sm whitespace-pre-wrap">{ticket.discrepancy}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Status:</Label>
                        <Select
                          value={ticket.status}
                          onValueChange={(v: any) => handleStatusChange(ticket._id, v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant={getStatusColor(ticket.status)}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
