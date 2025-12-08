import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ProcurementMaterial, ProcurementAssignment } from "./procurementUtils";
import { format } from "date-fns";

// Group materials by category
const groupByCategory = (materials: ProcurementMaterial[]) => {
  const groups: Record<string, ProcurementMaterial[]> = {};
  materials.forEach((m) => {
    const cat = m.category || "Uncategorized";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m);
  });
  return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
};

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

export const exportProcurementPDF = (
  activeTab: string,
  materials: ProcurementMaterial[],
  assignments: ProcurementAssignment[],
  kits: any[],
  clients: any[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Title
  doc.setFontSize(18);
  doc.text("Procurement Report", 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 28);
  doc.text(`View: ${activeTab.replace("-", " ").toUpperCase()}`, 14, 34);

  let yPos = 45;

  // Helper to add a table for a list of materials
  const addMaterialTable = (mats: ProcurementMaterial[], startY: number) => {
    const grouped = groupByCategory(mats);
    let currentY = startY;

    grouped.forEach(([category, items]) => {
      // Check if we need a new page for the category header
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        currentY = 20;
      }

      // Category Header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(14, currentY - 5, pageWidth - 28, 8, "F");
      doc.text(category, 16, currentY);
      currentY += 5;

      // Table
      autoTable(doc, {
        startY: currentY,
        head: [["Material", "Shortage", "Purchasing Qty", "Vendor", "Est. Cost"]],
        body: items.map((m) => [
          m.name,
          m.shortage.toString(),
          m.purchasingQty.toString(),
          m.vendorName || "-",
          formatCurrency(m.estCost),
        ]),
        theme: "grid",
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Update currentY for the next table
          currentY = (data.cursor?.y || currentY) + 10;
        },
      });
      
      // Update Y for next loop (autoTable updates it internally but we need to track it)
      // The didDrawPage hook updates currentY, but we need to make sure we sync up
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    return currentY;
  };

  if (activeTab === "summary") {
    addMaterialTable(materials, yPos);
  } else if (activeTab === "kit-wise") {
    // Group by Kit
    // We iterate through kits that have active assignments
    const activeKitIds = new Set(assignments.map(a => a.kitId));
    const activeKits = kits.filter(k => activeKitIds.has(k._id));

    activeKits.forEach(kit => {
      // Find materials used in this kit that have a shortage
      const kitMaterials = materials.filter(m => m.kits.some(k => k.id === kit._id));
      
      if (kitMaterials.length > 0) {
        if (yPos > doc.internal.pageSize.height - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Kit: ${kit.name}`, 14, yPos);
        yPos += 10;

        yPos = addMaterialTable(kitMaterials, yPos);
        yPos += 10;
      }
    });
  } else if (activeTab === "month-wise") {
    // Group by Month
    const months = Array.from(new Set(assignments.map(a => a.productionMonth || "Unknown"))).sort();
    
    months.forEach(month => {
      const monthAssignments = assignments.filter(a => (a.productionMonth || "Unknown") === month);
      const monthKitIds = new Set(monthAssignments.map(a => a.kitId));
      
      // Materials needed for these kits
      const monthMaterials = materials.filter(m => m.kits.some(k => monthKitIds.has(k.id)));

      if (monthMaterials.length > 0) {
        if (yPos > doc.internal.pageSize.height - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Production Month: ${month}`, 14, yPos);
        yPos += 10;

        yPos = addMaterialTable(monthMaterials, yPos);
        yPos += 10;
      }
    });
  } else if (activeTab === "client-wise") {
    // Group by Client
    const clientIds = Array.from(new Set(assignments.map(a => a.clientId)));
    
    clientIds.forEach(clientId => {
      const client = clients.find(c => c._id === clientId);
      const clientName = client ? (client.name || client.organization || client.buyerName) : "Unknown Client";
      
      const clientAssignments = assignments.filter(a => a.clientId === clientId);
      const clientKitIds = new Set(clientAssignments.map(a => a.kitId));
      
      const clientMaterials = materials.filter(m => m.kits.some(k => clientKitIds.has(k.id)));

      if (clientMaterials.length > 0) {
        if (yPos > doc.internal.pageSize.height - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Client: ${clientName}`, 14, yPos);
        yPos += 10;

        yPos = addMaterialTable(clientMaterials, yPos);
        yPos += 10;
      }
    });
  } else if (activeTab === "assignment-wise") {
    // Group by Assignment
    assignments.forEach(assignment => {
      const kit = kits.find(k => k._id === assignment.kitId);
      const client = clients.find(c => c._id === assignment.clientId);
      const clientName = client ? (client.name || client.organization || client.buyerName) : "Unknown Client";
      
      // Materials for this specific assignment (approximate by kit usage)
      // Note: This is an approximation as materials are aggregated. 
      // We show materials that are part of this kit and have a global shortage.
      const assignmentMaterials = materials.filter(m => m.kits.some(k => k.id === assignment.kitId));

      if (assignmentMaterials.length > 0) {
        if (yPos > doc.internal.pageSize.height - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Assignment: ${kit?.name || "Unknown Kit"} - ${clientName} (${assignment.quantity})`, 14, yPos);
        yPos += 10;

        yPos = addMaterialTable(assignmentMaterials, yPos);
        yPos += 10;
      }
    });
  }

  doc.save(`procurement-${activeTab}-${new Date().toISOString().split('T')[0]}.pdf`);
};