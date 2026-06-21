import { EnrichedDriver } from "@/types/enrichedDriver";
import { ContractTypeBadge } from "@/components/ContractTypeBadge";
import { FuelStatusBadge } from "@/components/FuelStatusBadge";
import { cn } from "@/lib/utils";
import { Truck, MapPin } from "lucide-react";

interface DriverCardProps {
  driver: EnrichedDriver;
  isSelected: boolean;
  onSelect: () => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  "Covered": { color: "bg-green-500", label: "Covered" },
  "In transit": { color: "bg-blue-500", label: "In Transit" },
  "Searching_for_load": { color: "bg-orange-500", label: "Searching" },
  "Empty_34hr_reset": { color: "bg-muted-foreground", label: "On Reset" },
  "Broke Down": { color: "bg-destructive", label: "Broke Down" },
};

export const DriverCard = ({ driver, isSelected, onSelect }: DriverCardProps) => {
  const status = driver.currentStatus ? statusConfig[driver.currentStatus] : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border-2 text-left transition-all w-full min-h-[120px]",
        "hover:border-primary/50 hover:bg-accent/30",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card",
        !driver.fuelEnabled && "border-destructive/30 bg-destructive/5"
      )}
    >
      {/* Header: Name + Contract Type */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-foreground truncate flex-1">
          {driver.name}
        </span>
        <ContractTypeBadge type={driver.contractType} />
      </div>

      {/* Truck info */}
      {driver.truckNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Truck className="h-3 w-3" />
          <span>Truck #{driver.truckNumber}</span>
          {driver.trailerNumber && (
            <span className="ml-1">• {driver.trailerNumber}</span>
          )}
        </div>
      )}

      {/* Status indicator */}
      {status && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className={cn("h-2 w-2 rounded-full", status.color)} />
          <span className="text-muted-foreground">{status.label}</span>
        </div>
      )}

      {/* Fuel Status */}
      <div className="flex items-center gap-1.5">
        <FuelStatusBadge enabled={driver.fuelEnabled} compact />
      </div>

      {/* Last delivery location */}
      {driver.lastDeliveryLocation && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-auto">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">Last drop-off: {driver.lastDeliveryLocation}</span>
        </div>
      )}
    </button>
  );
};
