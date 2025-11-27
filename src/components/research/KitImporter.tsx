import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Check, AlertCircle } from "lucide-react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface KitImporterProps {
  onImport: (kitData: any) => void;
}

export function KitImporter({ onImport }: KitImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  
  const parseKitAction = useAction(api.ai.parseKitFromSheet);

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const result = await parseKitAction({ rawText });
      if (result.success && result.data) {
        setParsedData(JSON.parse(result.data));
        toast.success("Data parsed successfully");
      } else {
        toast.error(result.error || "Failed to parse data");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = () => {
    if (parsedData) {
      onImport(parsedData);
      setIsOpen(false);
      setParsedData(null);
      setRawText("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Import from Sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI Kit Importer</DialogTitle>
          <DialogDescription>
            Copy and paste the kit details directly from your Google Sheet. The AI will extract items, quantities, and packing details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6 mt-4">
          {/* Input Section */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex-1 flex flex-col">
              <label className="text-sm font-medium mb-2">Paste Sheet Data</label>
              <Textarea 
                placeholder="Paste rows from Excel/Google Sheets here...&#10;Example:&#10;1  Cardboard tube  180mm  1  Pouch&#10;2  Motor  DC 3V  1  Packet A"
                className="flex-1 font-mono text-xs resize-none p-4"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || !rawText.trim()}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze Data
                </>
              )}
            </Button>
          </div>

          {/* Preview Section */}
          {parsedData && (
            <div className="flex-1 flex flex-col min-w-0 border rounded-md bg-muted/10">
              <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold">Preview</h3>
                <Badge variant="outline" className="bg-background">
                  {parsedData.components?.length || 0} Items Found
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Detected Name</div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      {parsedData.name || "Untitled Kit"}
                      {parsedData.category && (
                        <Badge variant="outline">{parsedData.category}</Badge>
                      )}
                    </div>
                  </div>
                  
                  {parsedData.description && (
                    <div className="grid gap-2">
                      <div className="text-sm font-medium text-muted-foreground">Description</div>
                      <div className="text-sm">{parsedData.description}</div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Components</div>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8">Item</TableHead>
                            <TableHead className="h-8 w-[80px]">Qty</TableHead>
                            <TableHead className="h-8 w-[100px]">Match</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.components?.map((comp: any, i: number) => (
                            <TableRow key={i} className="h-10">
                              <TableCell className="py-2">
                                <div className="font-medium text-sm">{comp.name}</div>
                                {comp.notes && <div className="text-xs text-muted-foreground">{comp.notes}</div>}
                              </TableCell>
                              <TableCell className="py-2 text-sm">{comp.quantity} {comp.unit}</TableCell>
                              <TableCell className="py-2">
                                {comp.inventoryItemId ? (
                                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 hover:bg-green-100">
                                    <Check className="h-3 w-3 mr-1" /> Matched
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                                    <AlertCircle className="h-3 w-3 mr-1" /> New
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {parsedData.packingRequirements && (
                    <div className="grid gap-2">
                      <div className="text-sm font-medium text-muted-foreground">Packing Plan</div>
                      <Card className="p-3 text-sm bg-muted/30">
                        {typeof parsedData.packingRequirements === 'string' ? (
                          parsedData.packingRequirements
                        ) : (
                          <div className="space-y-4">
                            {parsedData.packingRequirements.pouches?.length > 0 && (
                              <div>
                                <div className="font-semibold text-xs uppercase text-muted-foreground mb-2">Pouches (Main Sealed)</div>
                                <div className="space-y-2">
                                  {parsedData.packingRequirements.pouches.map((pouch: any, i: number) => (
                                    <div key={i} className="bg-background border rounded p-2">
                                      <div className="font-medium text-xs mb-1">{pouch.name}</div>
                                      <ul className="list-disc list-inside text-xs text-muted-foreground">
                                        {pouch.materials?.map((m: any, j: number) => (
                                          <li key={j}>{m.quantity}x {m.name}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {parsedData.packingRequirements.packets?.length > 0 && (
                              <div>
                                <div className="font-semibold text-xs uppercase text-muted-foreground mb-2">Packets (Internal)</div>
                                <div className="space-y-2">
                                  {parsedData.packingRequirements.packets.map((packet: any, i: number) => (
                                    <div key={i} className="bg-background border rounded p-2">
                                      <div className="font-medium text-xs mb-1">{packet.name}</div>
                                      <ul className="list-disc list-inside text-xs text-muted-foreground">
                                        {packet.materials?.map((m: any, j: number) => (
                                          <li key={j}>{m.quantity}x {m.name}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-background">
                <Button onClick={handleConfirm} className="w-full">
                  Use This Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}