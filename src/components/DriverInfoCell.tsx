import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ContractTypeBadge } from "./ContractTypeBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Load } from "@/types/load";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "./ui/button";
import { UserCheck } from "lucide-react";
import { validateInput, driverNameSchema, phoneNumberSchema, filterPhoneInput } from "@/utils/validation";
import { toast } from "@/hooks/use-toast";

interface DriverInfoCellProps {
  driverName: string;
  driverPhone: string;
  contractType: Load["CONTRACT TYPE"];
  onUpdateName: (value: string) => void;
  onUpdatePhone: (value: string) => void;
  onUpdateContractType: (value: Load["CONTRACT TYPE"]) => void;
  onUpdateTruck?: (value: string) => void;
  onUpdateTrailer?: (value: string) => void;
  disabled?: boolean;
}

export const DriverInfoCell = ({
  driverName,
  driverPhone,
  contractType,
  onUpdateName,
  onUpdatePhone,
  onUpdateContractType,
  onUpdateTruck,
  onUpdateTrailer,
  disabled = false,
}: DriverInfoCellProps) => {
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
      if (onUpdateTruck && profile.truckNumber) {
        onUpdateTruck(profile.truckNumber);
      }
      if (onUpdateTrailer && profile.trailerNumber) {
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
    <div className="space-y-0.5 py-1">
      {/* Profile Selector */}
      {driverProfiles.length > 0 && !disabled && (
        <div className="px-2 pb-0.5 border-b border-border/30">
          {showProfileSelector ? (
            <Select value="" onValueChange={handleSelectProfile}>
              <SelectTrigger className="h-7 text-xs bg-primary/5 border-primary/20">
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
              className="h-6 w-full text-xs justify-start px-2 hover:bg-primary/5"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Use saved profile
            </Button>
          )}
        </div>
      )}

      {editingField === "name" ? (
        <Input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleSaveName}
          onKeyDown={(e) => handleKeyDown(e, "name")}
          className="h-7 px-2 text-sm"
          autoFocus
          disabled={disabled}
        />
      ) : (
        <div
          onClick={() => !disabled && setEditingField("name")}
          className={`px-2 py-0.5 rounded transition-colors font-medium ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
          title={disabled ? "Archived - restore to edit" : undefined}
        >
          {driverName || "-"}
        </div>
      )}
      
      {editingField === "phone" ? (
        <Input
          value={phoneValue}
          onChange={(e) => setPhoneValue(filterPhoneInput(e.target.value))}
          onBlur={handleSavePhone}
          onKeyDown={(e) => handleKeyDown(e, "phone")}
          className="h-7 px-2 text-sm"
          autoFocus
          placeholder="555-123-4567"
          inputMode="tel"
          disabled={disabled}
        />
      ) : (
        <div
          onClick={() => !disabled && setEditingField("phone")}
          className={`px-2 py-0.5 rounded transition-colors text-xs text-muted-foreground ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
          title={disabled ? "Archived - restore to edit" : undefined}
        >
          {driverPhone || "Add phone"}
        </div>
      )}
      
      <div className="px-2">
        <Select value={contractType} onValueChange={onUpdateContractType} disabled={disabled}>
          <SelectTrigger className={`h-7 border-none bg-transparent shadow-none p-0 w-fit ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent/5'}`}>
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
      </div>
    </div>
  );
};
