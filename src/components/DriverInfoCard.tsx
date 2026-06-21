import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ContractTypeBadge } from "./ContractTypeBadge";
import { StatusBadge } from "./StatusBadge";
import { FuelStatusBadge } from "./FuelStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Load } from "@/types/load";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "./ui/button";
import { UserCheck, Phone, MessageSquare, MapPin, AlertTriangle, Plus } from "lucide-react";
import { validateInput, driverNameSchema, phoneNumberSchema, filterPhoneInput } from "@/utils/validation";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { EditableCell } from "./EditableCell";

interface DriverInfoCardProps {
  driverName: string;
  driverPhone: string;
  contractType: Load["CONTRACT TYPE"];
  truckNumber: number | null;
  trailerNumber: string | null;
  trailerType: Load["TRAILER TYPE"];
  status: Load["Status"];
  lastDeliveryLocation: string | null;
  loadCount: number;
  totalMiles: number;
  totalRevenue: number;
  totalDriverPay: number;
  avgRpm: number;
  dateWarnings: number;
  fuelEnabled?: boolean;
  onUpdateName: (value: string) => void;
  onUpdatePhone: (value: string) => void;
  onUpdateContractType: (value: Load["CONTRACT TYPE"]) => void;
  onUpdateTruck: (value: string) => void;
  onUpdateTrailer: (value: string) => void;
  onUpdateTrailerType: (value: Load["TRAILER TYPE"]) => void;
  onUpdateStatus: (value: Load["Status"]) => void;
  disabled?: boolean;
  isAdmin?: boolean;
  onAddNextLeg?: () => void;
}

export const DriverInfoCard = ({
  driverName,
  driverPhone,
  contractType,
  truckNumber,
  trailerNumber,
  trailerType,
  status,
  lastDeliveryLocation,
  loadCount,
  totalMiles,
  totalRevenue,
  totalDriverPay,
  avgRpm,
  dateWarnings,
  fuelEnabled = true,
  onUpdateName,
  onUpdatePhone,
  onUpdateContractType,
  onUpdateTruck,
  onUpdateTrailer,
  onUpdateTrailerType,
  onUpdateStatus,
  disabled = false,
  isAdmin = false,
  onAddNextLeg,
}: DriverInfoCardProps) => {
  const [editingField, setEditingField] = useState<"name" | "phone" | null>(null);
  const [nameValue, setNameValue] = useState(driverName);
  const [phoneValue, setPhoneValue] = useState(driverPhone);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const { dropdownConfig, driverProfiles } = useSettings();

  const handleSelectProfile = (profileId: string) => {
    const profile = driverProfiles.find(p => p.id === profileId);
    if (profile) {
      onUpdateName(profile.name);
      onUpdatePhone(profile.phone);
      onUpdateContractType(profile.contractType as Load["CONTRACT TYPE"]);
      if (profile.truckNumber) {
        onUpdateTruck(profile.truckNumber);
      }
      if (profile.trailerNumber) {
        onUpdateTrailer(profile.trailerNumber);
      }
      setNameValue(profile.name);
      setPhoneValue(profile.phone);
      setShowProfileSelector(false);
    }
  };

  const handleSaveName = () => {
    const validation = validateInput(driverNameSchema, nameValue);
    if (!validation.success) {
      toast({
        title: "Invalid Driver Name",
        description: validation.error,
        variant: "destructive",
      });
      setNameValue(driverName);
      setEditingField(null);
      return;
    }
    onUpdateName(validation.data);
    setEditingField(null);
  };

  const handleSavePhone = () => {
    const validation = validateInput(phoneNumberSchema, phoneValue);
    if (!validation.success) {
      toast({
        title: "Invalid Phone Number",
        description: validation.error,
        variant: "destructive",
      });
      setPhoneValue(driverPhone);
      setEditingField(null);
      return;
    }
    onUpdatePhone(validation.data || phoneValue);
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: "name" | "phone") => {
    if (e.key === "Enter") {
      if (field === "name") handleSaveName();
      else handleSavePhone();
    } else if (e.key === "Escape") {
      if (field === "name") setNameValue(driverName);
      else setPhoneValue(driverPhone);
      setEditingField(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden min-w-[280px]">
      {/* Profile Selector */}
      {driverProfiles.length > 0 && !disabled && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/30">
          {showProfileSelector ? (
            <Select value="" onValueChange={handleSelectProfile}>
              <SelectTrigger className="h-7 text-xs bg-background border-primary/20">
                <SelectValue placeholder="Select saved profile..." />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {driverProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3" />
                      <span>{profile.name}</span>
                      <span className="text-xs text-muted-foreground">({profile.contractType})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProfileSelector(true)}
              className="h-6 w-full text-xs justify-start px-1 hover:bg-primary/5"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Use saved profile
            </Button>
          )}
        </div>
      )}

      {/* Section 1: Header - Name, Contract Type, Status */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editingField === "name" ? (
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => handleKeyDown(e, "name")}
                className="h-7 px-2 text-sm font-semibold"
                autoFocus
                disabled={disabled}
              />
            ) : (
              <div
                onClick={() => !disabled && setEditingField("name")}
                className={`text-sm font-semibold truncate ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-primary transition-colors'}`}
                title={disabled ? "Archived - restore to edit" : "Click to edit"}
              >
                {driverName || "No Name"}
              </div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Select value={contractType} onValueChange={onUpdateContractType} disabled={disabled}>
                <SelectTrigger className={`h-6 border-none bg-transparent shadow-none p-0 w-fit ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                  <ContractTypeBadge type={contractType} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {dropdownConfig.contractTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <ContractTypeBadge type={option.value as Load["CONTRACT TYPE"]} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FuelStatusBadge enabled={fuelEnabled} compact />
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Select value={status || "Searching_for_load"} onValueChange={onUpdateStatus} disabled={disabled}>
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none p-0 w-fit">
                <StatusBadge status={status || "Searching_for_load"} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {dropdownConfig.status.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <StatusBadge status={option.value as Load["Status"]} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onAddNextLeg && !disabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNextLeg();
                }}
                className="h-7 text-xs gap-1 border-border hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/50 dark:hover:border-blue-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Next Leg
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Contact & Location */}
      <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {editingField === "phone" ? (
              <Input
                value={phoneValue}
                onChange={(e) => setPhoneValue(filterPhoneInput(e.target.value))}
                onBlur={handleSavePhone}
                onKeyDown={(e) => handleKeyDown(e, "phone")}
                className="h-6 px-2 text-xs flex-1"
                autoFocus
                placeholder="555-123-4567"
                inputMode="tel"
                disabled={disabled}
              />
            ) : (
              <span
                onClick={() => !disabled && setEditingField("phone")}
                className={`text-xs truncate ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-primary transition-colors'} ${driverPhone ? 'text-foreground' : 'text-muted-foreground'}`}
                title={disabled ? "Archived - restore to edit" : "Click to edit"}
              >
                {driverPhone || "Add phone"}
              </span>
            )}
            {driverPhone && !editingField && (
              <a
                href={`sms:${driverPhone}`}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">SMS</span>
              </a>
            )}
          </div>
          {lastDeliveryLocation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 max-w-[120px]">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate" title={lastDeliveryLocation}>
                {lastDeliveryLocation}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Equipment */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Truck</div>
            <EditableCell
              value={truckNumber}
              onSave={onUpdateTruck}
              type="number"
              disabled={disabled}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Trailer</div>
            <EditableCell
              value={trailerNumber}
              onSave={onUpdateTrailer}
              disabled={disabled}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Type</div>
            <Select
              value={trailerType || ""}
              onValueChange={(value) => onUpdateTrailerType(value as Load["TRAILER TYPE"])}
              disabled={disabled}
            >
              <SelectTrigger className="h-6 border-none bg-transparent shadow-none text-xs p-0">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {dropdownConfig.trailerTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section 4: Financial Metrics */}
      <div className="px-3 py-2 bg-muted/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span>{loadCount} load{loadCount !== 1 ? 's' : ''} • {totalMiles.toLocaleString()} mi</span>
          {dateWarnings > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-medium cursor-help">
                    <AlertTriangle className="h-3 w-3" />
                    {dateWarnings}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-destructive text-destructive-foreground border-destructive">
                  <p>{dateWarnings} date sequence {dateWarnings === 1 ? 'issue' : 'issues'} detected</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Gross Rev</div>
            <div className="text-sm font-semibold text-foreground">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Driver Pay</div>
            <div className={`text-sm font-semibold ${
              Math.abs(totalDriverPay - totalRevenue) < 0.01
                ? 'text-foreground'
                : totalDriverPay > totalRevenue 
                  ? 'text-destructive' 
                  : 'text-success'
            }`}>
              ${totalDriverPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">RPM</div>
            <div className={`text-sm font-semibold ${
              avgRpm >= 2.5 ? 'text-success' : avgRpm >= 1.8 ? 'text-warning' : 'text-destructive'
            }`}>
              ${avgRpm.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
