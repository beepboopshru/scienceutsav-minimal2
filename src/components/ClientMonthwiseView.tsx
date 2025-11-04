import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "convex/react";
import { Calendar } from "lucide-react";
import { useMemo, useState } from "react";

interface ClientMonthwiseViewProps {
  clientId: Id<"clients">;
}

export function ClientMonthwiseView({ clientId }: ClientMonthwiseViewProps) {
  const assignments = useQuery(api.assignments.getByClient, { clientId });
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const monthlyData = useMemo(() => {
    if (!assignments) return { months: [], data: {} };

    // Filter only dispatched assignments
    const dispatchedAssignments = assignments.filter(
      (a) => a.dispatchedAt && a.dispatchedAt > 0
    );

    if (dispatchedAssignments.length === 0) {
      return { months: [], data: {} };
    }

    // Group by month
    const grouped: Record<string, typeof dispatchedAssignments> = {};
    dispatchedAssignments.forEach((assignment) => {
      const date = new Date(assignment.dispatchedAt!);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(assignment);
    });

    // Sort months (newest first)
    const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return { months, data: grouped };
  }, [assignments]);

  // Set initial month
  if (selectedMonth === "" && monthlyData.months.length > 0) {
    setSelectedMonth(monthlyData.months[0]);
  }

  if (!assignments) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (monthlyData.months.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No dispatched assignments for this client yet.
      </div>
    );
  }

  const currentMonthAssignments = selectedMonth ? monthlyData.data[selectedMonth] : [];

  // Group by grade
  const gradeGroups = useMemo(() => {
    const groups: Record<string, typeof currentMonthAssignments> = {};
    currentMonthAssignments.forEach((assignment) => {
      const grade = assignment.grade || "unspecified";
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(assignment);
    });

    // Sort grades (1-10, then unspecified)
    const sortedGrades = Object.keys(groups).sort((a, b) => {
      if (a === "unspecified") return 1;
      if (b === "unspecified") return -1;
      return parseInt(a) - parseInt(b);
    });

    return sortedGrades.map((grade) => ({ grade, assignments: groups[grade] }));
  }, [currentMonthAssignments]);

  // Calculate total quantity for selected month
  const totalQuantity = currentMonthAssignments.reduce((sum, a) => sum + a.quantity, 0);

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthlyData.months.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonth(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary">Total: {totalQuantity} kits</Badge>
      </div>

      <div className="space-y-4">
        {gradeGroups.map(({ grade, assignments: gradeAssignments }) => (
          <div key={grade} className="space-y-2">
            <h4 className="font-semibold text-sm">
              {grade === "unspecified" ? "Unspecified Grade" : `Grade ${grade}`}
            </h4>
            <div className="space-y-2 pl-4">
              {gradeAssignments.map((assignment) => {
                // Check if there are multiple dispatch dates for this kit
                const kitAssignments = gradeAssignments.filter(
                  (a) => a.kitId === assignment.kitId
                );
                const uniqueDates = new Set(
                  kitAssignments.map((a) => a.dispatchedAt).filter(Boolean)
                );
                const hasMixedDates = uniqueDates.size > 1;

                return (
                  <div
                    key={assignment._id}
                    className="flex items-center justify-between text-sm border-l-2 border-muted pl-3 py-1"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{assignment.kit?.name || "Unknown Kit"}</span>
                      <span className="text-muted-foreground ml-2">× {assignment.quantity}</span>
                    </div>
                    <div>
                      {assignment.dispatchedAt ? (
                        hasMixedDates ? (
                          <Badge variant="outline">Dispatched: Mixed</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            Dispatch Date: {formatDate(assignment.dispatchedAt)}
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary">Not set</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
