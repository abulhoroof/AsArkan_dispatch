import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface DHDistanceCellProps {
  distance: number | null | undefined;
  isCalculating?: boolean;
}

export const DHDistanceCell = ({ distance, isCalculating }: DHDistanceCellProps) => {
  if (isCalculating) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">...</span>
      </div>
    );
  }

  if (distance === null || distance === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const getDistanceColor = (miles: number) => {
    if (miles < 100) return "text-emerald-600 dark:text-emerald-400";
    if (miles <= 250) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getDistanceIndicator = (miles: number) => {
    if (miles < 100) return "🟢";
    if (miles <= 250) return "🟡";
    return "🔴";
  };

  return (
    <span className={cn("font-medium", getDistanceColor(distance))}>
      {getDistanceIndicator(distance)} {Math.round(distance)} mi
    </span>
  );
};
