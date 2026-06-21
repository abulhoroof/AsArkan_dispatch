import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, RefreshCw, LogOut, User, Shield, Info, UserPlus, Users, Truck, DollarSign, Gauge, Map, AlertTriangle, FileWarning } from "lucide-react";
import { KpiRibbon } from "@/components/KpiRibbon";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationBell } from "@/components/NotificationBell";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { APP_VERSION } from "@/config/version";

import { useOrganization } from "@/hooks/useOrganization";

interface SpreadsheetHeaderProps {
  onAddRow: () => void;
  onOpenAddDialog: () => void;
  totalLoads: number;
  assignedDrivers: number;
  totalRevenue: string;
  totalDriverPay?: string;
  totalMiles: number;
  averageRpm?: string;
  onRefresh?: () => void;
  onSignOut?: () => void;
  isRefreshing?: boolean;
  currentTab?: "loads" | "trucks" | "settings" | "analytics" | "all-loads" | "transactions";
  onNavigate?: (path: string) => void;
  userEmail?: string;
  isAdmin?: boolean;
  showKPIs?: boolean;
  // Driver-specific KPIs for trucks tab
  pastDueCount?: number;
  availableTodayCount?: number;
  searchingCount?: number;
  onLoadCount?: number;
  // All Loads specific KPIs
  totalDispatchers?: number;
  pendingInvoiceAmount?: number;
  pendingInvoiceCount?: number;
  incompleteLoadsCount?: number;
  availableDriversCount?: number;
}

export const SpreadsheetHeader = ({
  onAddRow,
  onOpenAddDialog,
  totalLoads,
  assignedDrivers,
  totalRevenue,
  totalDriverPay,
  totalMiles,
  averageRpm,
  onRefresh,
  onSignOut,
  isRefreshing = false,
  currentTab = "loads",
  onNavigate,
  userEmail,
  isAdmin = false,
  showKPIs = true,
  pastDueCount = 0,
  availableTodayCount = 0,
  searchingCount = 0,
  onLoadCount = 0,
  totalDispatchers = 0,
  pendingInvoiceAmount = 0,
  pendingInvoiceCount = 0,
  incompleteLoadsCount = 0,
  availableDriversCount = 0,
}: SpreadsheetHeaderProps) => {
  const { organizationName } = useOrganization();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const handleTabChange = (value: string) => {
    if (onNavigate) {
      if (value === "settings") onNavigate("/settings");
      else if (value === "trucks") onNavigate("/trucks");
      else if (value === "analytics") onNavigate("/analytics");
      else if (value === "all-loads") onNavigate("/all-loads");
      else if (value === "transactions") onNavigate("/transactions");
      else onNavigate("/");
    }
  };

  return (
    <header className="bg-card border-b border-border px-3 sm:px-6 py-3 sm:py-4">
      {/* Top row: Logo + actions */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img src={logo} alt="AsArkan TMS Logo" className="h-8 w-8 sm:h-12 sm:w-12 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-lg sm:text-3xl font-bold text-foreground truncate">AsArkan TMS</h1>
              <span className="text-[10px] sm:text-xs text-muted-foreground/60 font-mono hidden sm:inline">v{APP_VERSION}</span>
            </div>
            <p className="text-xs sm:text-base text-primary font-medium mt-0.5 sm:mt-1 truncate">
              {organizationName || "Track and manage trucking loads"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
          {/* Tabs - hidden on mobile, shown on sm+ */}
          <div className="hidden sm:block">
            <Tabs value={currentTab === "settings" ? "" : currentTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="loads">Loads</TabsTrigger>
                <TabsTrigger value="trucks">Drivers</TabsTrigger>
                {isAdmin && <TabsTrigger value="transactions">Transactions</TabsTrigger>}
                {isAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex gap-1.5 sm:gap-3">
            {onRefresh && (
              <Button onClick={onRefresh} variant="outline" size="icon" disabled={isRefreshing} className="h-8 w-8 sm:h-9 sm:w-9">
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            
            {(currentTab === "loads" || currentTab === "trucks") && (
              <Button onClick={onOpenAddDialog} size="sm" className="bg-primary hover:bg-primary/90 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">{currentTab === "trucks" ? "Add Driver" : "Add Load"}</span>
                <span className="xs:hidden">Add</span>
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => setInviteDialogOpen(true)} variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
                <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline text-sm">Invite User</span>
              </Button>
            )}
            <NotificationBell />
            <ViewModeToggle compact className="hidden md:inline-flex" />
            <InviteUserDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />
            {onSignOut && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card z-50">
                  {userEmail && (
                    <div className="px-2 py-2 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">{userEmail}</p>
                      {isAdmin && (
                        <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary border-primary/20">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => onNavigate?.("/settings")} className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <div className="md:hidden px-2 py-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1.5">View mode</p>
                    <ViewModeToggle className="w-full justify-between" />
                  </div>
                  <DropdownMenuItem onClick={onSignOut} className="cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation tabs */}
      <div className="sm:hidden mb-3 -mx-3 px-3 overflow-x-auto">
        <Tabs value={currentTab === "settings" ? "" : currentTab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="loads" className="text-xs flex-1">Loads</TabsTrigger>
            <TabsTrigger value="trucks" className="text-xs flex-1">Drivers</TabsTrigger>
            {isAdmin && <TabsTrigger value="transactions" className="text-xs flex-1">Transactions</TabsTrigger>}
            {isAdmin && <TabsTrigger value="analytics" className="text-xs flex-1">Analytics</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>

      {showKPIs && currentTab !== "analytics" && (
        <TooltipProvider delayDuration={200}>
          {currentTab === "trucks" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2 sm:py-3 cursor-help">
                    <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                      Past Due
                      <Info className="h-3 w-3 opacity-50" />
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{pastDueCount}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p>Drivers with availability date in the past that need attention</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 sm:px-4 py-2 sm:py-3 cursor-help">
                    <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      Available Today
                      <Info className="h-3 w-3 opacity-50" />
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{availableTodayCount}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p>Drivers available for pickup today</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 sm:px-4 py-2 sm:py-3 cursor-help">
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                      Searching
                      <Info className="h-3 w-3 opacity-50" />
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{searchingCount}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p>Drivers actively searching for a load</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 sm:px-4 py-2 sm:py-3 cursor-help">
                    <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      On Load
                      <Info className="h-3 w-3 opacity-50" />
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{onLoadCount}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p>Drivers currently on an active load</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : currentTab === "all-loads" ? (
            <>
              {/* Primary KPI Cards for All Loads */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-revenue">{totalRevenue}</div>
                    <p className="text-xs text-muted-foreground">Gross revenue</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg RPM</CardTitle>
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${(() => {
                      const rpmValue = parseFloat((averageRpm || '0').replace(/[^0-9.]/g, ""));
                      if (rpmValue >= 3) return "text-green-500";
                      if (rpmValue >= 2) return "text-yellow-500";
                      return "text-red-500";
                    })()}`}>
                      {averageRpm || '$0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">Rate per mile</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Miles</CardTitle>
                    <Map className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalMiles.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Combined mileage</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400">Pending Invoice</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      ${pendingInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70">{pendingInvoiceCount} loads unbilled</p>
                  </CardContent>
                </Card>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="border-red-500/30 bg-red-500/5 cursor-help">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                          Incomplete
                          <Info className="h-3 w-3 opacity-50" />
                        </CardTitle>
                        <FileWarning className="h-4 w-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{incompleteLoadsCount}</div>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">Missing rate or BOL</p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p>Loads with $0 rate or missing Bill of Lading</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Secondary compact bar for All Loads */}
              <div className="flex flex-wrap items-center gap-4 px-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span><span className="font-semibold text-foreground">{totalDispatchers}</span> Dispatchers</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span><span className="font-semibold text-foreground">{assignedDrivers}</span> Drivers</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <span><span className="font-semibold text-foreground">{totalLoads}</span> Loads</span>
                </div>
              </div>
            </>
          ) : (
            <KpiRibbon
              totalLoads={totalLoads}
              assignedDrivers={assignedDrivers}
              totalRevenue={totalRevenue}
              totalDriverPay={totalDriverPay}
              totalMiles={totalMiles}
              averageRpm={averageRpm}
              availableDriversCount={availableDriversCount}
            />
          )}
        </TooltipProvider>
      )}
    </header>
  );
};
