import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ImportCurriculumDialogProps {
  onImport: (assignments: any[], client: any, month: string, year: string) => void;
}

export function ImportCurriculumDialog({ onImport }: ImportCurriculumDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const clients = useQuery(api.clients.list);
  const kits = useQuery(api.kits.list);

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];

  const handleImport = () => {
    if (!selectedClientId || !selectedMonth) {
      toast.error("Please select a client and a month");
      return;
    }

    const client = clients?.find((c) => c._id === selectedClientId);
    if (!client) return;

    if (!client.gradePlanning || client.gradePlanning.length === 0) {
      toast.error("This client has no curriculum planning defined.");
      return;
    }

    const newAssignments: any[] = [];

    client.gradePlanning.forEach((gradePlan: any) => {
      const kitId = gradePlan.schedule?.[selectedMonth as keyof typeof gradePlan.schedule];
      
      if (kitId) {
        const kit = kits?.find((k) => k._id === kitId);
        if (kit) {
          newAssignments.push({
            kitId: kit._id,
            programId: kit.programId,
            kitName: kit.name,
            quantity: gradePlan.studentStrength || 1, // Default to 1 if 0 or undefined, but user asked for studentStrength
            grade: gradePlan.grade,
            notes: `Imported from ${selectedMonth} curriculum`,
          });
        }
      }
    });

    if (newAssignments.length === 0) {
      toast.error(`No kits found scheduled for ${selectedMonth} in the curriculum.`);
      return;
    }

    onImport(newAssignments, client, selectedMonth, selectedYear);
    setOpen(false);
    toast.success(`Found ${newAssignments.length} assignments from curriculum.`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Import from Curriculum
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Assignments from Curriculum</DialogTitle>
          <DialogDescription>
            Select a client and month to auto-populate assignments based on their grade planning.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="client" className="text-right">
              Client
            </Label>
            <div className="col-span-3">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.organization || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="month" className="text-right">
              Month
            </Label>
            <div className="col-span-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month.charAt(0).toUpperCase() + month.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="year" className="text-right">
              Year
            </Label>
            <div className="col-span-3">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((offset) => {
                    const year = (new Date().getFullYear() + offset).toString();
                    return (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleImport} disabled={!selectedClientId || !selectedMonth}>
            Import Assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}