"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { parsePackingRequirements } from "../lib/kitPacking";

export const generateKitSheet = action({
  args: { kitId: v.id("kits") },
  handler: async (ctx, args): Promise<{ html: string; kitName: string }> => {
    // Fetch kit data
    const kit: any = await ctx.runQuery(api.kits.get, { id: args.kitId });
    if (!kit) throw new Error("Kit not found");

    // Fetch inventory for material notes fallback
    const inventory = await ctx.runQuery(api.inventory.list);

    // Fetch kit image URL if available
    let kitImageUrl = null;
    if (kit.kitImageFiles && kit.kitImageFiles.length > 0) {
      const firstImage = kit.kitImageFiles[0];
      if (firstImage.storageId) {
        kitImageUrl = await ctx.runQuery(api.kits.getFileUrl, { 
          storageId: firstImage.storageId 
        });
      }
    }

    // Fetch component images from laser files
    const componentImages: string[] = [];
    if (kit.componentFiles && kit.componentFiles.length > 0) {
      for (const file of kit.componentFiles) {
        if (file.storageId) {
          const url = await ctx.runQuery(api.kits.getFileUrl, { 
            storageId: file.storageId 
          });
          if (url) componentImages.push(url);
        }
      }
    }

    // Parse structured packing requirements
    const structure = kit.isStructured && kit.packingRequirements
      ? parsePackingRequirements(kit.packingRequirements)
      : { pouches: [], packets: [] };

    // Helper function to get material notes
    const getMaterialNotes = (materialName: string): string => {
      const invItem = inventory.find(
        (i: any) => i.name.toLowerCase() === materialName.toLowerCase()
      );
      return invItem?.notes || "-";
    };

    // Generate HTML
    const html: string = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kit Sheet - ${kit.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      padding: 20px; 
      font-size: 11px;
      line-height: 1.4;
    }
    .header { 
      text-align: center; 
      margin-bottom: 20px; 
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .header h1 { 
      font-size: 20px; 
      margin-bottom: 5px;
      color: #1a1a1a;
    }
    .header p { 
      font-size: 10px; 
      color: #666;
    }
    .kit-info { 
      background: #f5f5f5; 
      padding: 12px; 
      margin-bottom: 15px; 
      border-radius: 4px;
      border: 1px solid #ddd;
    }
    .kit-info h2 { 
      font-size: 16px; 
      margin-bottom: 8px;
      color: #333;
    }
    .kit-info p { 
      margin: 4px 0; 
      font-size: 10px;
    }
    .kit-info strong { 
      color: #555;
    }
    .kit-image { 
      text-align: center; 
      margin: 15px 0;
    }
    .kit-image img { 
      max-width: 300px; 
      max-height: 200px; 
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .section { 
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section h3 { 
      font-size: 13px; 
      margin-bottom: 8px; 
      padding: 6px 8px;
      background: #333;
      color: white;
      border-radius: 3px;
    }
    .subsection { 
      margin-bottom: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
    }
    .subsection h4 { 
      font-size: 11px; 
      padding: 6px 8px;
      background: #e8e8e8;
      border-bottom: 1px solid #ddd;
      font-weight: 600;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 5px;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 6px 8px; 
      text-align: left;
      font-size: 10px;
    }
    th { 
      background: #f8f8f8; 
      font-weight: 600;
      color: #333;
    }
    tr:nth-child(even) { 
      background: #fafafa;
    }
    .component-images { 
      margin-top: 20px;
      page-break-before: always;
    }
    .component-images h3 { 
      font-size: 13px; 
      margin-bottom: 10px;
    }
    .image-grid { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 10px;
    }
    .image-grid img { 
      width: 100%; 
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    @media print {
      body { padding: 10px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Science Utsav Management System</h1>
    <p>Kit Assembly & Packing Sheet</p>
  </div>

  <div class="kit-info">
    <h2>${kit.name}</h2>
    ${kit.serialNumber ? `<p><strong>Serial Number:</strong> ${kit.serialNumber}</p>` : ""}
    ${kit.category ? `<p><strong>Category:</strong> ${kit.category}</p>` : ""}
    ${kit.description ? `<p><strong>Description:</strong> ${kit.description}</p>` : ""}
    <p><strong>Stock Count:</strong> ${kit.stockCount}</p>
  </div>

  ${kitImageUrl ? `
  <div class="kit-image">
    <img src="${kitImageUrl}" alt="Kit Image" />
  </div>
  ` : ""}

  ${structure.pouches.length > 0 ? `
  <div class="section">
    <h3>Pouches</h3>
    ${structure.pouches.map((pouch) => `
      <div class="subsection">
        <h4>${pouch.name}</h4>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${pouch.materials.map((material) => `
              <tr>
                <td>${material.name}</td>
                <td>${material.quantity}</td>
                <td>${material.unit}</td>
                <td>${material.notes || getMaterialNotes(material.name)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("")}
  </div>
  ` : ""}

  ${structure.packets.length > 0 ? `
  <div class="section">
    <h3>Packets (Pre-sealed)</h3>
    ${structure.packets.map((packet) => `
      <div class="subsection">
        <h4>${packet.name}</h4>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${packet.materials.map((material) => `
              <tr>
                <td>${material.name}</td>
                <td>${material.quantity}</td>
                <td>${material.unit}</td>
                <td>${material.notes || getMaterialNotes(material.name)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("")}
  </div>
  ` : ""}

  ${kit.spareKits && kit.spareKits.length > 0 ? `
  <div class="section">
    <h3>Spare Kits</h3>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Unit</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${kit.spareKits.map((spare: any) => `
          <tr>
            <td>${spare.name}</td>
            <td>${spare.quantity}</td>
            <td>${spare.unit}</td>
            <td>${spare.notes || getMaterialNotes(spare.name)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${kit.bulkMaterials && kit.bulkMaterials.length > 0 ? `
  <div class="section">
    <h3>Bulk Materials</h3>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Unit</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${kit.bulkMaterials.map((bulk: any) => `
          <tr>
            <td>${bulk.name}</td>
            <td>${bulk.quantity}</td>
            <td>${bulk.unit}</td>
            <td>${bulk.notes || getMaterialNotes(bulk.name)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${kit.miscellaneous && kit.miscellaneous.length > 0 ? `
  <div class="section">
    <h3>Miscellaneous</h3>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Unit</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${kit.miscellaneous.map((misc: any) => `
          <tr>
            <td>${misc.name}</td>
            <td>${misc.quantity}</td>
            <td>${misc.unit}</td>
            <td>${misc.notes || getMaterialNotes(misc.name)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${componentImages.length > 0 ? `
  <div class="component-images">
    <h3>Component Images</h3>
    <div class="image-grid">
      ${componentImages.map((url) => `<img src="${url}" alt="Component" />`).join("")}
    </div>
  </div>
  ` : ""}

  ${kit.notes ? `
  <div class="section">
    <h3>Assembly Notes</h3>
    <p style="padding: 8px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; white-space: pre-wrap;">${kit.notes}</p>
  </div>
  ` : ""}
</body>
</html>
    `;

    return { html, kitName: kit.name };
  },
});
