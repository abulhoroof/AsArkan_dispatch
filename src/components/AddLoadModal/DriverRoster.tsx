import { useState } from "react";
import { EnrichedDriver } from "@/types/enrichedDriver";
import { AddNewDriverCard } from "./AddNewDriverCard";
import { Load } from "@/types/load";
import { Check, ChevronDown, Lock, MapPin, Plus, Truck, User } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { ContractTypeBadge } from "@/components/ContractTypeBadge";
import { FuelStatusBadge } from "@/components/FuelStatusBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NewDriverData {
  name: string;
  phone: string;
  contractType: Load["CONTRACT TYPE"];
  truckNumber?: number;
  trailerNumber?: string;
  trailerType?: Load["TRAILER TYPE"];
  location?: string;
}

interface DriverRosterProps {
  drivers: EnrichedDriver[];
  selectedDriverId: string | null;
  onSelectDriver: (driver: EnrichedDriver) => void;
  onCreateDriver: (driver: NewDriverData) => Promise<void>;
  isAddingNew: boolean;
  onAddingNewChange: (adding: boolean) => void;
  isAdmin?: boolean;
  currentUserId?: string | null;
}

// Priority order for status-based sorting
const statusPriority: Record<string, number> = {
  Searching_for_load: 1,
  Empty_34hr_reset: 2,
  Covered: 3,
  "In transit": 4,
  "Broke Down": 5,
};

// Status display configuration
const statusConfig: Record<string, { label: string; color: string }> = {
  Searching_for_load: { label: "Available", color: "bg-green-500" },
  Empty_34hr_reset: { label: "34hr Reset", color: "bg-yellow-500" },
  Covered: { label: "Covered", color: "bg-blue-500" },
  "In transit": { label: "In Transit", color: "bg-purple-500" },
  "Broke Down": { label: "Broke Down", color: "bg-red-500" },
};

export const DriverRoster = ({
  drivers,
  selectedDriverId,
  onSelectDriver,
  onCreateDriver,
  isAddingNew,
  onAddingNewChange,
  isAdmin = false,
  currentUserId = null,
}: DriverRosterProps) => {
  // Check if current user can add loads for a driver
  const canAddLoadForDriver = (driver: EnrichedDriver) => {
    if (isAdmin) return true;
    if (!driver.assignedDispatcherId) return true; // Unassigned drivers
    return driver.assignedDispatcherId === currentUserId;
  };
  const [open, setOpen] = useState(false);

  // Sort drivers: newly created first, then by status priority
  const sortedDrivers = [...drivers].sort((a, b) => {
    const isNewA = a.driver_id.startsWith("new-");
    const isNewB = b.driver_id.startsWith("new-");

    if (isNewA && !isNewB) return -1;
    if (!isNewA && isNewB) return 1;

    if (isNewA && isNewB) {
      const timeA = parseInt(a.driver_id.replace("new-", ""));
      const timeB = parseInt(b.driver_id.replace("new-", ""));
      return timeB - timeA;
    }

    const priorityA = a.currentStatus
      ? statusPriority[a.currentStatus] || 99
      : 99;
    const priorityB = b.currentStatus
      ? statusPriority[b.currentStatus] || 99
      : 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.name.localeCompare(b.name);
  });

  const selectedDriver = sortedDrivers.find(
    (d) => d.driver_id === selectedDriverId
  );

  const getStatusInfo = (status: string | undefined) => {
    if (!status) return { label: "Unknown", color: "bg-muted-foreground" };
    return statusConfig[status] || { label: status, color: "bg-muted-foreground" };
  };

  // If adding new driver, show the form
  if (isAddingNew) {
    return (
      <div className="space-y-3">
        <AddNewDriverCard
          onCreateDriver={onCreateDriver}
          isExpanded={isAddingNew}
          onExpandChange={onAddingNewChange}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto py-3 px-4"
          >
            {selectedDriver ? (
              <div className="flex items-center gap-3 text-left">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{selectedDriver.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedDriver.truckNumber && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        Truck #{selectedDriver.truckNumber}
                      </span>
                    )}
                    {selectedDriver.lastDeliveryLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedDriver.lastDeliveryLocation.split(",")[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Select a driver...</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          portalled={false}
          className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            filter={(value, search) => {
              const driver = sortedDrivers.find(d => d.driver_id === value);
              if (!driver) return 0;
              return driver.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search drivers..." />
            <CommandList>
              <CommandEmpty>No driver found.</CommandEmpty>
              <CommandGroup>
                {sortedDrivers.map((driver) => {
                  const statusInfo = getStatusInfo(driver.currentStatus);
                  const canAddLoad = canAddLoadForDriver(driver);
                  
                  const itemContent = (
                    <CommandItem
                      key={driver.driver_id}
                      value={driver.driver_id}
                      disabled={!canAddLoad}
                      onSelect={() => {
                        if (canAddLoad) {
                          onSelectDriver(driver);
                          setOpen(false);
                        }
                      }}
                      onClick={() => {
                        if (canAddLoad) {
                          onSelectDriver(driver);
                          setOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 py-3",
                        canAddLoad ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {driver.name}
                          </span>
                          <ContractTypeBadge type={driver.contractType} />
                          {!canAddLoad && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {driver.truckNumber && (
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              #{driver.truckNumber}
                            </span>
                          )}
                          {driver.lastDeliveryLocation && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {driver.lastDeliveryLocation.split(",")[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            statusInfo.color
                          )}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {statusInfo.label}
                        </span>
                        {!driver.fuelEnabled && (
                          <FuelStatusBadge enabled={false} compact />
                        )}
                      </div>
                      {selectedDriverId === driver.driver_id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  );

                  // Wrap non-owned drivers with tooltip
                  if (!canAddLoad) {
                    return (
                      <TooltipProvider key={driver.driver_id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {itemContent}
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>This driver is assigned to another dispatcher</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  return itemContent;
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Add New Driver Button */}
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => onAddingNewChange(true)}
      >
        <Plus className="h-4 w-4" />
        Add New Driver
      </Button>
    </div>
  );
};
