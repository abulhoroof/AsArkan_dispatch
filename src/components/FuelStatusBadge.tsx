import { Fuel, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface FuelStatusBadgeProps {
  enabled: boolean;
  showToggle?: boolean;
  onToggle?: (enabled: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const FuelStatusBadge = ({
  enabled,
  showToggle = false,
  onToggle,
  disabled = false,
  compact = false,
}: FuelStatusBadgeProps) => {
  if (showToggle && onToggle) {
    return (
      <div 
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
          className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-destructive/70"
        />
        {!compact && (
          <Fuel className={cn(
            "h-4 w-4",
            enabled ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          )} />
        )}
      </div>
    );
  }

  // Icon-only badge (read-only)
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded",
        compact ? "p-0.5" : "p-1",
        enabled
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-destructive"
      )}
      title={enabled ? "Fuel enabled" : "No fuel"}
    >
      {enabled ? (
        <Fuel className={compact ? "h-3 w-3" : "h-4 w-4"} />
      ) : (
        <AlertTriangle className={compact ? "h-3 w-3" : "h-4 w-4"} />
      )}
    </span>
  );
};
