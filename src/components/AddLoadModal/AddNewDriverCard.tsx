import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Load } from "@/types/load";
import { validateInput, driverNameSchema, phoneNumberSchema, truckNumberSchema, trailerNumberSchema, filterPhoneInput, filterIntegerInput } from "@/utils/validation";
import { useSettings } from "@/contexts/SettingsContext";
import { LocationSearchInput } from "@/components/LocationSearchInput";

interface NewDriverData {
  name: string;
  phone: string;
  contractType: Load["CONTRACT TYPE"];
  truckNumber?: number;
  trailerNumber?: string;
  trailerType?: Load["TRAILER TYPE"];
  location?: string;
}

interface AddNewDriverCardProps {
  onCreateDriver: (driver: NewDriverData) => Promise<void>;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  isAdmin?: boolean;
}

export const AddNewDriverCard = ({ onCreateDriver, isExpanded, onExpandChange, isAdmin = false }: AddNewDriverCardProps) => {
  const { dropdownConfig } = useSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contractType, setContractType] = useState<Load["CONTRACT TYPE"]>("LP STANDARD");
  const [truckNumber, setTruckNumber] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [trailerType, setTrailerType] = useState<string | null>("Flat Bed");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    const nameValidation = validateInput(driverNameSchema, name);
    if (!nameValidation.success) {
      newErrors.name = nameValidation.error || "Invalid name";
    }

    const phoneValidation = validateInput(phoneNumberSchema, phone);
    if (!phoneValidation.success) {
      newErrors.phone = phoneValidation.error || "Invalid phone";
    }

    if (truckNumber) {
      const truckValidation = validateInput(truckNumberSchema, parseInt(truckNumber));
      if (!truckValidation.success) {
        newErrors.truck = truckValidation.error || "Invalid truck number";
      }
    }

    if (trailerNumber) {
      const trailerValidation = validateInput(trailerNumberSchema, trailerNumber);
      if (!trailerValidation.success) {
        newErrors.trailer = trailerValidation.error || "Invalid trailer number";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onCreateDriver({
      name: nameValidation.data!,
      phone: phoneValidation.data || phone,
      contractType,
      truckNumber: truckNumber ? parseInt(truckNumber) : undefined,
      trailerNumber: trailerNumber || undefined,
      trailerType: (trailerType as Load["TRAILER TYPE"]) || undefined,
      location: location.trim() || undefined,
    });

    resetForm();
    onExpandChange(false);
  };

  const resetForm = () => {
    setName("");
    setPhone("");
    setContractType("LP STANDARD");
    setTruckNumber("");
    setTrailerNumber("");
    setTrailerType("Flat Bed");
    setLocation("");
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    onExpandChange(false);
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => onExpandChange(true)}
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed",
          "text-muted-foreground transition-all w-full min-h-[120px]",
          "hover:border-primary hover:text-primary hover:bg-primary/5"
        )}
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Add New Driver</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5 w-full col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">New Driver</span>
        <button
          type="button"
          onClick={handleCancel}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Driver Name */}
        <div>
          <Label htmlFor="new-driver-name" className="text-xs">Driver Name <span className="text-destructive">*</span></Label>
          <Input
            id="new-driver-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
            }}
            placeholder="Enter driver name"
            className={cn("h-8 text-sm", errors.name && "border-destructive")}
            autoFocus
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>

        {/* Driver Phone */}
        <div>
          <Label htmlFor="new-driver-phone" className="text-xs">Driver Phone</Label>
          <Input
            id="new-driver-phone"
            value={phone}
            onChange={(e) => {
              setPhone(filterPhoneInput(e.target.value));
              if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
            }}
            placeholder="555-123-4567"
            inputMode="tel"
            className={cn("h-8 text-sm", errors.phone && "border-destructive")}
          />
          {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
        </div>

        {/* Contract Type */}
        <div>
          <Label className="text-xs">Contract Type <span className="text-destructive">*</span></Label>
          <Select 
            value={contractType} 
            onValueChange={(v) => setContractType(v as Load["CONTRACT TYPE"])}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dropdownConfig.contractTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Truck Number */}
        <div>
          <Label htmlFor="new-driver-truck" className="text-xs">Truck #</Label>
          <Input
            id="new-driver-truck"
            value={truckNumber}
            onChange={(e) => {
              setTruckNumber(filterIntegerInput(e.target.value));
              if (errors.truck) setErrors(prev => ({ ...prev, truck: "" }));
            }}
            placeholder="1234"
            inputMode="numeric"
            className={cn("h-8 text-sm", errors.truck && "border-destructive")}
          />
          {errors.truck && <p className="text-xs text-destructive mt-1">{errors.truck}</p>}
        </div>

        {/* Trailer Number */}
        <div>
          <Label htmlFor="new-driver-trailer" className="text-xs">Trailer #</Label>
          <Input
            id="new-driver-trailer"
            value={trailerNumber}
            onChange={(e) => {
              setTrailerNumber(e.target.value);
              if (errors.trailer) setErrors(prev => ({ ...prev, trailer: "" }));
            }}
            placeholder="T-5678"
            className={cn("h-8 text-sm", errors.trailer && "border-destructive")}
          />
          {errors.trailer && <p className="text-xs text-destructive mt-1">{errors.trailer}</p>}
        </div>

        {/* Trailer Type */}
        <div>
          <Label className="text-xs">Trailer Type</Label>
          <Select value={trailerType || ""} onValueChange={(v) => setTrailerType(v || null)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {dropdownConfig.trailerTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div className="col-span-2">
          <Label className="text-xs">Location</Label>
          <LocationSearchInput
            value={location}
            onChange={(value) => setLocation(value)}
            onSelect={(loc) => setLocation(loc)}
            placeholder="Search city or zip code..."
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="mt-2"
      >
        <Check className="h-4 w-4 mr-1" />
        Create & Select
      </Button>
    </div>
  );
};
