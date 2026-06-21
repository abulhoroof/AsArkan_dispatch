import { Monitor, Smartphone, MonitorSmartphone } from "lucide-react";
import { useViewMode, type ViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const OPTIONS: { value: ViewMode; label: string; Icon: typeof Monitor }[] = [
  { value: "auto", label: "Auto", Icon: MonitorSmartphone },
  { value: "desktop", label: "Desktop", Icon: Monitor },
  { value: "mobile", label: "Mobile", Icon: Smartphone },
];

interface ViewModeToggleProps {
  className?: string;
  /** Compact icon-only mode for tight headers. */
  compact?: boolean;
}

export function ViewModeToggle({ className, compact = false }: ViewModeToggleProps) {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <TooltipProvider>
      <div
        role="radiogroup"
        aria-label="View mode"
        className={cn(
          "inline-flex items-center rounded-md border border-border bg-muted p-0.5",
          className,
        )}
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = viewMode === value;
          return (
            <Tooltip key={value} delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${label} view`}
                  onClick={() => setViewMode(value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {!compact && <span className="hidden sm:inline">{label}</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{label} view</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}