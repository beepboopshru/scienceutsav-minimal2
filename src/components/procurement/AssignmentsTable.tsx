import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AssignmentsTableProps {
  assignments: any[];
}

export function AssignmentsTable({ assignments }: AssignmentsTableProps) {
  return (
    <div className="mb-6 border rounded-md overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b text-sm font-medium">Assignment Details</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Batch</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Kit</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Dispatch</TableHead>
            <TableHead>Prod. Month</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-xs">
                {a.batch?.batchId || a.batchId || "-"}
              </TableCell>
              <TableCell className="text-xs">{a.program?.name || "-"}</TableCell>
              <TableCell className="text-xs">{a.kit?.name || "-"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">
                  {a.kit?.category || "-"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {a.client?.name || a.client?.buyerName || "-"}
              </TableCell>
              <TableCell className="text-right text-xs">{a.quantity}</TableCell>
              <TableCell className="text-xs">
                {a.dispatchedAt ? new Date(a.dispatchedAt).toLocaleDateString() : "-"}
              </TableCell>
              <TableCell className="text-xs">{a.productionMonth || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
