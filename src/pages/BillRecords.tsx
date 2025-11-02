import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export default function BillRecords() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const vendorImports = useQuery(api.vendorImports.list);
  const vendors = useQuery(api.vendors.list);
  const inventory = useQuery(api.inventory.list);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user || !vendorImports || !vendors || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find((v) => v._id === vendorId);
    return vendor ? vendor.name : "Unknown Vendor";
  };

  const getItemName = (itemId: string) => {
    const item = inventory.find((i) => i._id === itemId);
    return item ? item.name : "Unknown Item";
  };

  const downloadBillAsHTML = (billImport: any) => {
    const vendor = vendors.find((v) => v._id === billImport.vendorId);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill ${billImport.billNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; }
          .total { font-weight: bold; font-size: 1.2em; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Purchase Bill</h1>
        <p><strong>Vendor:</strong> ${vendor?.name || "Unknown"}</p>
        <p><strong>Bill Number:</strong> ${billImport.billNumber}</p>
        <p><strong>Bill Date:</strong> ${billImport.billDate}</p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${billImport.items.map((item: any) => `
              <tr>
                <td>${getItemName(item.inventoryId)}</td>
                <td>${item.quantity}</td>
                <td>₹${item.unitPrice.toFixed(2)}</td>
                <td>₹${(item.quantity * item.unitPrice).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="total">Total Amount: ₹${billImport.totalAmount.toFixed(2)}</p>
      </body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill_${billImport.billNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
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
              <h1 className="text-3xl font-bold tracking-tight">Bill Records</h1>
              <p className="text-muted-foreground mt-2">
                View all vendor purchase bills and imports
              </p>
            </div>
            <Button onClick={() => navigate("/inventory")} variant="outline">
              Back to Inventory
            </Button>
          </div>

          <div className="space-y-4">
            {vendorImports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No bill records found</p>
                </CardContent>
              </Card>
            ) : (
              vendorImports.map((billImport) => (
                <Card key={billImport._id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Bill #{billImport.billNumber}
                        </CardTitle>
                        <CardDescription>
                          {getVendorName(billImport.vendorId)} • {billImport.billDate}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadBillAsHTML(billImport)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billImport.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{getItemName(item.inventoryId)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₹{item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell>₹{(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator />
                    <div className="flex justify-end">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="text-2xl font-bold">₹{billImport.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
