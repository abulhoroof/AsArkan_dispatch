import React from "react";
import { differenceInDays, startOfDay } from "date-fns";
import { parseDate, formatDateForDisplay } from "@/utils/date";
import { Load } from "@/types/load";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractTypeBadge } from "./ContractTypeBadge";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Truck, Plus, Clock, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { IncomingDriver } from "@/hooks/useSunsetState";

interface DriverEntry {
  driver_id: string;
  name: string;
  phone: string;
  contractType: string;
  truckNumber: number | null;
  trailerNumber: string | null;
  lastDeliveryLocation: string | null;
  lastDeliveryDate: string | null;
  fuelEnabled: boolean;
}

interface AvailableFleetTableProps {
  emptyDrivers: DriverEntry[];
  onAddLoadForDriver?: (driverId: string) => void;
  isAdmin?: boolean;
  driverAssignments?: Record<string, string | null>;
  dispatchers?: { id: string; name: string; email: string }[];
  fleetRef?: React.RefObject<HTMLDivElement>;
  incomingDrivers?: IncomingDriver[];
}

export const AvailableFleetTable = ({
  emptyDrivers,
  onAddLoadForDriver,
  isAdmin = false,
  driverAssignments = {},
  dispatchers = [],
  fleetRef,
  incomingDrivers = [],
}: AvailableFleetTableProps) => {
  if (emptyDrivers.length === 0) return null;

  // Helper to calculate urgency label based on last delivery date
  const getUrgencyLabel = (driver: DriverEntry) => {
    if (!driver.lastDeliveryDate) {
      return { text: "Ready", isUrgent: false };
    }
    
    const lastDate = parseDate(driver.lastDeliveryDate);
    if (!lastDate || isNaN(lastDate.getTime())) {
      return { text: "Ready", isUrgent: false };
    }
    
    const daysSince = differenceInDays(startOfDay(new Date()), startOfDay(lastDate));
    
    if (daysSince <= 0) {
      return { text: "Empty since Today", isUrgent: false };
    } else if (daysSince === 1) {
      return { text: "Empty since Yesterday", isUrgent: false };
    } else {
      return { text: `Empty ${daysSince} Days`, isUrgent: daysSince >= 3 };
    }
  };

  // Helper to format trailer type for display
  const formatTrailerType = (type: string | null): string => {
    if (!type) return "";
    const mapping: Record<string, string> = {
      "Flat Bed": "Flat",
      "Drop Deck": "Step",
      "Double Drop": "RGN",
    };
    return mapping[type] || type;
  };

  return (
    <div ref={fleetRef} className="mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h3 className="text-lg font-semibold">Available Fleet</h3>
        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {emptyDrivers.length} driver{emptyDrivers.length !== 1 ? 's' : ''}
        </Badge>
        <span className="text-xs text-muted-foreground ml-2">
          Drivers without loads in the selected period
        </span>
      </div>

      {/* Zone B Table */}
      <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="bg-amber-100/50 dark:bg-amber-900/30 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 border-b-2 border-amber-200/50 dark:border-amber-800/50">
                <TableHead className="min-w-[220px]">Driver & Equipment</TableHead>
                <TableHead className="min-w-[180px]">Current Position</TableHead>
                <TableHead className="min-w-[140px]">Downtime</TableHead>
                {isAdmin && <TableHead className="min-w-[100px]">Assigned To</TableHead>}
                <TableHead className="min-w-[120px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {emptyDrivers.map((driver) => {
                const urgency = getUrgencyLabel(driver);
                const lastDropOff = driver.lastDeliveryLocation || "N/A";
                
                // Check if this driver is an "incoming driver" (finishing load for someone else)
                const incomingInfo = incomingDrivers.find(d => d.driverId === driver.driver_id);
                const hasExternalLoad = !!incomingInfo;
                
                // Format equipment info
                const truckInfo = driver.truckNumber ? `#${driver.truckNumber}` : "";
                const trailerInfo = formatTrailerType(driver.trailerNumber);
                const equipmentParts = [truckInfo, trailerInfo].filter(Boolean);
                const equipmentStr = equipmentParts.length > 0 ? `(${equipmentParts.join(", ")})` : "";

                // Get dispatcher assignment for admin view
                const assignedId = driverAssignments[driver.driver_id];
                const assignedDispatcher = assignedId ? dispatchers.find(d => d.id === assignedId) : null;

                const handleAddLoadClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (onAddLoadForDriver) {
                    onAddLoadForDriver(driver.driver_id);
                  }
                };

                return (
                  <TableRow 
                    key={driver.driver_id}
                    className="h-14 border-b border-amber-200/30 dark:border-amber-800/30 hover:bg-amber-100/40 dark:hover:bg-amber-900/30"
                  >
                    {/* Driver & Equipment */}
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{driver.name}</span>
                          <ContractTypeBadge type={driver.contractType as Load["CONTRACT TYPE"]} />
                          {hasExternalLoad && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 cursor-help"
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Finishing load
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="text-xs">
                                    Completing load for {incomingInfo?.oldDispatcherName || 'another dispatcher'}.
                                    {incomingInfo?.estimatedAvailableDate && (
                                      <> Available after {incomingInfo.estimatedAvailableDate}.</>
                                    )}
                                    {incomingInfo?.currentLocation && (
                                      <> Location: {incomingInfo.currentLocation}</>
                                    )}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {equipmentStr && (
                          <span className="text-xs text-muted-foreground">{equipmentStr}</span>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Current Position - shows incoming driver's destination */}
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-0.5">
                        {hasExternalLoad && incomingInfo?.currentLocation ? (
                          <>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                              <MapPin className="h-3 w-3" />
                              <span>Delivering to:</span>
                            </div>
                            <span className="truncate max-w-[160px] font-medium">
                              {incomingInfo.currentLocation}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground/70">Last drop-off:</span>
                            <span className="truncate max-w-[160px]">{lastDropOff}</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Downtime / Availability */}
                    <TableCell>
                      {hasExternalLoad ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                            <Calendar className="h-3 w-3" />
                            <span>Available:</span>
                          </div>
                          <span className="font-medium text-sm text-slate-600 dark:text-slate-300">
                            {incomingInfo?.estimatedAvailableDate 
                              ? formatDateForDisplay(parseDate(incomingInfo.estimatedAvailableDate) || new Date())
                              : 'TBD'}
                          </span>
                        </div>
                      ) : (
                        <span className={cn(
                          "font-medium text-sm",
                          urgency.isUrgent 
                            ? "text-red-600 dark:text-red-400 font-semibold" 
                            : "text-amber-600 dark:text-amber-400"
                        )}>
                          {urgency.text}
                        </span>
                      )}
                    </TableCell>
                    
                    {/* Assigned To (Admin only) */}
                    {isAdmin && (
                      <TableCell className="text-xs text-muted-foreground">
                        {assignedDispatcher?.name || assignedDispatcher?.email?.split('@')[0] || '—'}
                      </TableCell>
                    )}
                    
                    {/* Action */}
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="default"
                        className="h-8 text-xs gap-1"
                        onClick={handleAddLoadClick}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Load
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
