import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

// Types for the data structures used in Procurement.tsx
interface Material {
  name: string;
  category: string;
  subcategory?: string;
  required: number;
  available: number;
  shortage: number;
  unit: string;
  kits?: string[];
  programs?: string[];
}

interface GroupedData {
  name?: string; // For Kit
  month?: string; // For Month
  clientName?: string; // For Client
  totalQuantity?: number; // For Kit
  totalAssignments?: number; // For Month
  totalKits?: number; // For Client
  materials: Material[];
}

const groupMaterialsBySubcategory = (materials: Material[]) => {
  const groups: Record<string, Material[]> = {};
  materials.forEach(m => {
    const sub = m.subcategory || "Uncategorized";
    if (!groups[sub]) groups[sub] = [];
    groups[sub].push(m);
  });
  return groups;
};

export const exportProcurementPDF = (
  type: "kit" | "month" | "client" | "summary",
  data: GroupedData[] | Material[],
  filename: string
) => {
  const doc = new jsPDF();
  const title = type === "kit" ? "Kit Wise Procurement" :
                type === "month" ? "Month Wise Procurement" :
                type === "client" ? "Client Wise Procurement" :
                "Material Procurement Summary";
  
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  let finalY = 40;

  if (type === "summary") {
    const materials = data as Material[];
    const grouped = groupMaterialsBySubcategory(materials);
    
    Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).forEach(([subcat, items]) => {
      // Check if we need a new page
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text(subcat, 14, finalY);
      doc.setTextColor(0);
      finalY += 5;

      const tableData = items.map(item => [
        item.name,
        item.category,
        `${item.required} ${item.unit}`,
        `${item.available} ${item.unit}`,
        item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock",
        item.kits ? (item.kits.join(", ").substring(0, 30) + (item.kits.join(", ").length > 30 ? "..." : "")) : ""
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [["Material", "Category", "Required", "Available", "Shortage", "Used In"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
        didParseCell: (data) => {
          if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 15;
    });
  } else {
    const groups = data as GroupedData[];
    
    groups.forEach((group) => {
      // Group Header
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(16);
      const groupName = group.name || group.clientName || (group.month ? new Date(group.month + "-01").toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : "Unknown");
      const subInfo = group.totalQuantity ? `Total Assigned: ${group.totalQuantity}` :
                      group.totalAssignments ? `Assignments: ${group.totalAssignments}` :
                      group.totalKits ? `Total Kits: ${group.totalKits}` : "";
      
      doc.text(`${groupName} (${subInfo})`, 14, finalY);
      finalY += 10;

      const groupedMaterials = groupMaterialsBySubcategory(group.materials);

      Object.entries(groupedMaterials).sort((a, b) => a[0].localeCompare(b[0])).forEach(([subcat, items]) => {
         if (finalY > 250) {
            doc.addPage();
            finalY = 20;
          }
          
          doc.setFontSize(12);
          doc.setTextColor(100);
          doc.text(subcat, 14, finalY);
          doc.setTextColor(0);
          finalY += 5;

          const tableData = items.map(item => [
            item.name,
            item.category,
            `${item.required} ${item.unit}`,
            `${item.available} ${item.unit}`,
            item.shortage > 0 ? `${item.shortage} ${item.unit}` : "In Stock"
          ]);

          autoTable(doc, {
            startY: finalY,
            head: [["Material", "Category", "Required", "Available", "Shortage"]],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [71, 85, 105] },
            didParseCell: (data) => {
              if (data.column.index === 4 && data.cell.text[0] !== "In Stock") {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = "bold";
              }
            },
          });

          // @ts-ignore
          finalY = doc.lastAutoTable.finalY + 10;
      });
      
      finalY += 10;
      doc.line(14, finalY - 5, 196, finalY - 5); // Separator line
    });
  }

  doc.save(filename);
  toast.success(`Exported ${title}`);
};
