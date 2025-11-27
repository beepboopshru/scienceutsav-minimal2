import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const MaterialTable = ({ materials }: { materials: any[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Material</TableHead>
        <TableHead>Category</TableHead>
        <TableHead>Required</TableHead>
        <TableHead>Available</TableHead>
        <TableHead>Shortage</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {materials.map((mat: any, idx: number) => (
        <TableRow key={idx}>
          <TableCell className="font-medium">{mat.name}</TableCell>
          <TableCell><Badge variant="outline" className="text-xs">{mat.category}</Badge></TableCell>
          <TableCell>{mat.required} {mat.unit}</TableCell>
          <TableCell>{mat.available} {mat.unit}</TableCell>
          <TableCell>
            {mat.shortage > 0 ? (
              <Badge variant="destructive" className="text-xs">{mat.shortage} {mat.unit}</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">In Stock</Badge>
            )}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
