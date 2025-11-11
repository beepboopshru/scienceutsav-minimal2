import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AssignmentFiltersProps {
  programs: Array<{ _id: string; name: string }>;
  kits: Array<{ _id: string; name: string; programId: string; category?: string }>;
  clients: Array<{ _id: string; name?: string; organization?: string; buyerName?: string }>;
  assignments: Array<any>;
  
  selectedPrograms: string[];
  selectedCategories: string[];
  selectedKits: string[];
  selectedClients: string[];
  selectedDispatchMonths: string[];
  selectedStatuses: string[];
  selectedProductionMonths: string[];
  
  onProgramsChange: (programs: string[]) => void;
  onCategoriesChange: (categories: string[]) => void;
  onKitsChange: (kits: string[]) => void;
  onClientsChange: (clients: string[]) => void;
  onDispatchMonthsChange: (months: string[]) => void;
  onStatusesChange: (statuses: string[]) => void;
  onProductionMonthsChange: (months: string[]) => void;
  onClearAll: () => void;
}

export function AssignmentFilters({
  programs,
  kits,
  clients,
  assignments,
  selectedPrograms,
  selectedCategories,
  selectedKits,
  selectedClients,
  selectedDispatchMonths,
  selectedStatuses,
  selectedProductionMonths,
  onProgramsChange,
  onCategoriesChange,
  onKitsChange,
  onClientsChange,
  onDispatchMonthsChange,
  onStatusesChange,
  onProductionMonthsChange,
  onClearAll,
}: AssignmentFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Get filtered kits based on selected programs
  const filteredKits = selectedPrograms.length > 0
    ? kits.filter((kit) => selectedPrograms.includes(kit.programId))
    : kits;

  // Get unique categories from filtered kits
  const availableCategories = Array.from(
    new Set(
      (selectedPrograms.length > 0 ? filteredKits : kits)
        .map((kit) => kit.category)
        .filter((cat): cat is string => Boolean(cat))
    )
  ).sort();

  // Get unique dispatch months
  const uniqueDispatchMonths = Array.from(
    new Set(
      assignments.map((a) => {
        const date = a.dispatchedAt || a._creationTime;
        return format(new Date(date), "yyyy-MM");
      })
    )
  ).sort().reverse();

  // Get unique production months
  const uniqueProductionMonths = Array.from(
    new Set(
      assignments
        .filter((a) => a.productionMonth)
        .map((a) => a.productionMonth!)
    )
  ).sort().reverse();

  const statuses = ["assigned", "packed", "dispatched"];

  const activeFilterCount = 
    selectedPrograms.length +
    selectedCategories.length +
    selectedKits.length +
    selectedClients.length +
    selectedDispatchMonths.length +
    selectedStatuses.length +
    selectedProductionMonths.length;

  // Helper to get client display name (supports both B2B and B2C clients)
  const getClientDisplayName = (client: any) => {
    return client.buyerName || client.organization || client.name || "Unknown";
  };

  return (
    <Card className="p-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                <span className="ml-2 font-semibold">Filters</span>
              </Button>
            </CollapsibleTrigger>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" onClick={onClearAll}>
              Clear All
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Program Filter */}
            <div className="space-y-2">
              <Label>Program</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedPrograms.length > 0
                      ? `${selectedPrograms.length} selected`
                      : "Select programs"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search programs..." />
                    <CommandList>
                      <CommandEmpty>No programs found.</CommandEmpty>
                      <CommandGroup>
                        {programs.map((program) => (
                          <CommandItem
                            key={program._id}
                            onSelect={() => {
                              const newSelection = selectedPrograms.includes(program._id)
                                ? selectedPrograms.filter((id) => id !== program._id)
                                : [...selectedPrograms, program._id];
                              onProgramsChange(newSelection);
                              // Clear dependent filters
                              if (!newSelection.includes(program._id)) {
                                onCategoriesChange([]);
                                onKitsChange([]);
                              }
                            }}
                          >
                            <Checkbox
                              checked={selectedPrograms.includes(program._id)}
                              className="mr-2"
                            />
                            {program.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedCategories.length > 0
                      ? `${selectedCategories.length} selected`
                      : "Select categories"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandList>
                      <CommandEmpty>No categories found.</CommandEmpty>
                      <CommandGroup>
                        {availableCategories.map((category) => {
                          if (!category) return null;
                          return (
                            <CommandItem
                              key={category}
                              onSelect={() => {
                                const newSelection = selectedCategories.includes(category)
                                  ? selectedCategories.filter((c) => c !== category)
                                  : [...selectedCategories, category];
                                onCategoriesChange(newSelection);
                              }}
                            >
                              <Checkbox
                                checked={selectedCategories.includes(category)}
                                className="mr-2"
                              />
                              {category}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Kit Filter */}
            <div className="space-y-2">
              <Label>Kit</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedKits.length > 0
                      ? `${selectedKits.length} selected`
                      : "Select kits"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search kits..." />
                    <CommandList>
                      <CommandEmpty>No kits found.</CommandEmpty>
                      <CommandGroup>
                        {filteredKits.map((kit) => (
                          <CommandItem
                            key={kit._id}
                            onSelect={() => {
                              const newSelection = selectedKits.includes(kit._id)
                                ? selectedKits.filter((id) => id !== kit._id)
                                : [...selectedKits, kit._id];
                              onKitsChange(newSelection);
                            }}
                          >
                            <Checkbox
                              checked={selectedKits.includes(kit._id)}
                              className="mr-2"
                            />
                            {kit.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Client Filter */}
            <div className="space-y-2">
              <Label>Client</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedClients.length > 0
                      ? `${selectedClients.length} selected`
                      : "Select clients"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search clients..." />
                    <CommandList>
                      <CommandEmpty>No clients found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client._id}
                            onSelect={() => {
                              const newSelection = selectedClients.includes(client._id)
                                ? selectedClients.filter((id) => id !== client._id)
                                : [...selectedClients, client._id];
                              onClientsChange(newSelection);
                            }}
                          >
                            <Checkbox
                              checked={selectedClients.includes(client._id)}
                              className="mr-2"
                            />
                            {getClientDisplayName(client)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Dispatch Month Filter */}
            <div className="space-y-2">
              <Label>Dispatch Month</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedDispatchMonths.length > 0
                      ? `${selectedDispatchMonths.length} selected`
                      : "Select months"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search months..." />
                    <CommandList>
                      <CommandEmpty>No months found.</CommandEmpty>
                      <CommandGroup>
                        {uniqueDispatchMonths.map((month) => (
                          <CommandItem
                            key={month}
                            onSelect={() => {
                              const newSelection = selectedDispatchMonths.includes(month)
                                ? selectedDispatchMonths.filter((m) => m !== month)
                                : [...selectedDispatchMonths, month];
                              onDispatchMonthsChange(newSelection);
                            }}
                          >
                            <Checkbox
                              checked={selectedDispatchMonths.includes(month)}
                              className="mr-2"
                            />
                            {format(new Date(month + "-01"), "MMMM yyyy")}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedStatuses.length > 0
                      ? `${selectedStatuses.length} selected`
                      : "Select statuses"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {statuses.map((status) => (
                          <CommandItem
                            key={status}
                            onSelect={() => {
                              const newSelection = selectedStatuses.includes(status)
                                ? selectedStatuses.filter((s) => s !== status)
                                : [...selectedStatuses, status];
                              onStatusesChange(newSelection);
                            }}
                          >
                            <Checkbox
                              checked={selectedStatuses.includes(status)}
                              className="mr-2"
                            />
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Production Month Filter */}
            <div className="space-y-2">
              <Label>Production Month</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedProductionMonths.length > 0
                      ? `${selectedProductionMonths.length} selected`
                      : "Select months"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search months..." />
                    <CommandList>
                      <CommandEmpty>No months found.</CommandEmpty>
                      <CommandGroup>
                        {uniqueProductionMonths.map((month) => (
                          <CommandItem
                            key={month}
                            onSelect={() => {
                              const newSelection = selectedProductionMonths.includes(month)
                                ? selectedProductionMonths.filter((m) => m !== month)
                                : [...selectedProductionMonths, month];
                              onProductionMonthsChange(newSelection);
                            }}
                          >
                            <Checkbox
                              checked={selectedProductionMonths.includes(month)}
                              className="mr-2"
                            />
                            {format(new Date(month + "-01"), "MMM yyyy")}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Results Count */}
            <div className="space-y-2">
              <Label>Results</Label>
              <div className="h-10 flex items-center text-sm text-muted-foreground">
                Showing {assignments.length} assignments
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}