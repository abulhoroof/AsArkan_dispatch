import { Truck, Users, DollarSign, Map, Gauge, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KpiRibbonProps {
  totalLoads: number;
  assignedDrivers: number;
  totalRevenue: string;
  totalDriverPay?: string;
  totalMiles: number;
  averageRpm?: string;
  revenueChange?: number;
  availableDriversCount?: number;
}

export const KpiRibbon = ({
  totalLoads,
  assignedDrivers,
  totalRevenue,
  totalDriverPay,
  totalMiles,
  averageRpm,
  revenueChange,
  availableDriversCount = 0,
}: KpiRibbonProps) => {
  return (
    <div className="bg-card border-b border-border shadow-sm py-2 sm:py-3 px-3 sm:px-4">
      <div className="grid grid-cols-2 sm:flex sm:justify-between items-center gap-3 sm:gap-0">
        {/* Total Loads */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center cursor-help">
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Loads
                </span>
              </div>
              <span className="text-base sm:text-lg font-bold text-foreground">{totalLoads}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <p>Number of loads currently displayed based on active filters</p>
          </TooltipContent>
        </Tooltip>

        {/* Divider - hidden on mobile grid */}
        <div className="hidden sm:block h-10 w-px bg-border" />

        {/* Assigned Drivers */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center cursor-help">
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assigned Drivers
                </span>
              </div>
              <span className="text-base sm:text-lg font-bold text-foreground">{assignedDrivers}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <p>Drivers with loads for the selected date</p>
          </TooltipContent>
        </Tooltip>

        {/* Available Drivers */}
        {availableDriversCount > 0 && (
          <>
            <div className="hidden sm:block h-10 w-px bg-border" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center cursor-help">
                  <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Available
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">{availableDriversCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                <p>Drivers without loads in the current period - need attention</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <div className="hidden sm:block h-10 w-px bg-border" />

        {/* Total Revenue */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center cursor-help">
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Revenue
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-lg font-bold text-foreground">{totalRevenue}</span>
                {revenueChange !== undefined && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                  >
                    +{revenueChange}%
                  </Badge>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <p>Sum of all Load $ amounts for filtered loads</p>
          </TooltipContent>
        </Tooltip>

        {/* Driver Pay */}
        {totalDriverPay && (
          <>
            <div className="hidden sm:block h-10 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center cursor-help">
                  <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Driver Pay
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400">{totalDriverPay}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p>Total driver pay for filtered loads</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <div className="hidden sm:block h-10 w-px bg-border" />

        {/* Avg RPM */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center cursor-help">
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <Gauge className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Avg RPM
                </span>
              </div>
              <span className="text-base sm:text-lg font-bold text-blue-600">{averageRpm || '$0.00'}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p>Rate Per Mile = Total Revenue ÷ Total Miles</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
