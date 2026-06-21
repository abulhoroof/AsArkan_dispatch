import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Load } from "@/types/load";
import { driverNameSchema, phoneNumberSchema, validateInput, filterPhoneInput, filterIntegerInput } from "@/utils/validation";
import { LocationSearchInput } from "@/components/LocationSearchInput";
import { useSettings } from "@/contexts/SettingsContext";
import { FuelStatusBadge } from "@/components/FuelStatusBadge";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AddDriverSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddDriver: (driver: {
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    trailerType?: Load["TRAILER TYPE"];
    location?: string;
    fuelEnabled?: boolean;
  }) => void;
  isAdmin?: boolean;
}

export const AddDriverSheet = ({
  open,
  onOpenChange,
  onAddDriver,
  isAdmin = false,
}: AddDriverSheetProps) => {
  const { dropdownConfig } = useSettings();
  
  // Draft persistence - key scoped by user
  const [draftKey, setDraftKey] = useState('draft:add-driver');
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setDraftKey(`draft:add-driver:${user.id}`);
    });
  }, []);
  const { loadDraft, saveDraft, clearDraft } = useDraftPersistence<{
    name: string; phone: string; contractType: string;
    truckNumber: string; trailerNumber: string; trailerType: string | null;
    location: string; fuelEnabled: boolean;
  }>(draftKey);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contractType, setContractType] = useState<Load["CONTRACT TYPE"]>("LP STANDARD");
  const [truckNumber, setTruckNumber] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [trailerType, setTrailerType] = useState<string | null>("Flat Bed");
  const [location, setLocation] = useState("");
  const [fuelEnabled, setFuelEnabled] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  // Restore draft when sheet opens
  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      if (draft) {
        setName(draft.name || "");
        setPhone(draft.phone || "");
        setContractType((draft.contractType as Load["CONTRACT TYPE"]) || "LP STANDARD");
        setTruckNumber(draft.truckNumber || "");
        setTrailerNumber(draft.trailerNumber || "");
        setTrailerType(draft.trailerType ?? "Flat Bed");
        setLocation(draft.location || "");
        setFuelEnabled(draft.fuelEnabled ?? true);
        toast.info("Draft restored");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-save draft on field changes
  useEffect(() => {
    if (open && name) {
      saveDraft({ name, phone, contractType, truckNumber, trailerNumber, trailerType, location, fuelEnabled });
    }
  }, [open, name, phone, contractType, truckNumber, trailerNumber, trailerType, location, fuelEnabled, saveDraft]);

  const resetForm = () => {
    clearDraft();
    setName("");
    setPhone("");
    setContractType("LP STANDARD");
    setTruckNumber("");
    setTrailerNumber("");
    setTrailerType("Flat Bed");
    setLocation("");
    setFuelEnabled(true);
    setErrors({});
  };

  const handleSubmit = () => {
    const newErrors: { name?: string; phone?: string } = {};

    const nameValidation = validateInput(driverNameSchema, name);
    if (!nameValidation.success) {
      newErrors.name = nameValidation.error;
    }

    if (phone) {
      const phoneValidation = validateInput(phoneNumberSchema, phone);
      if (!phoneValidation.success) {
        newErrors.phone = phoneValidation.error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAddDriver({
      name: name.trim(),
      phone: phone.trim(),
      contractType,
      truckNumber: truckNumber ? parseInt(truckNumber, 10) : undefined,
      trailerNumber: trailerNumber.trim() || undefined,
      trailerType: (trailerType as Load["TRAILER TYPE"]) || undefined,
      location: location.trim() || undefined,
      fuelEnabled,
    });

    resetForm();
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const isValid = name.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[30vw] max-w-[30vw] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Add New Driver</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">Driver Name <span className="text-destructive">*</span></Label>
              <Input
                id="driver-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter driver name"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-phone">Phone Number</Label>
              <Input
                id="driver-phone"
                value={phone}
                onChange={(e) => {
                  setPhone(filterPhoneInput(e.target.value));
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="555-123-4567"
                inputMode="tel"
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select 
                value={contractType} 
                onValueChange={(v) => setContractType(v as Load["CONTRACT TYPE"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 z-[9999]" position="popper" sideOffset={4}>
                  {dropdownConfig.contractTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="truck-number">Truck Number</Label>
                <Input
                  id="truck-number"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(filterIntegerInput(e.target.value))}
                  placeholder="101"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trailer-number">Trailer Number</Label>
                <Input
                  id="trailer-number"
                  value={trailerNumber}
                  onChange={(e) => setTrailerNumber(e.target.value)}
                  placeholder="e.g. T-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Trailer Type</Label>
              <Select value={trailerType || ""} onValueChange={(v) => setTrailerType(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trailer type" />
                </SelectTrigger>
                <SelectContent>
                  {dropdownConfig.trailerTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <LocationSearchInput
                value={location}
                onChange={(value) => setLocation(value)}
                onSelect={(loc) => setLocation(loc)}
                placeholder="Search city or zip code..."
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>Fuel Authorization</Label>
                <div className="flex items-center gap-3 py-1">
                  <FuelStatusBadge
                    enabled={fuelEnabled}
                    showToggle
                    onToggle={setFuelEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    {fuelEnabled ? "Driver can use fuel card" : "Fuel card disabled"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Add Driver
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
