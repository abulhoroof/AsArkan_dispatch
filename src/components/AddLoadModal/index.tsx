import { useState, useMemo, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DriverRoster } from "./DriverRoster";
import { LoadFormSection } from "./LoadFormSection";
import { EnrichedDriver } from "@/types/enrichedDriver";
import { Load } from "@/types/load";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, parse } from "date-fns";
import { parseDate } from "@/utils/date";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { toast as sonnerToast } from "sonner";

interface AddLoadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrichedDrivers: EnrichedDriver[];
  driverStatuses: Record<string, Load["Status"]>;
  preSelectedDriverId?: string | null;
  prefilledPickupLocation?: string;
  prefilledPickupDate?: string;
  onAddLoad: (data: {
    driver_id?: string;
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    origin?: string;
    destination?: string;
    pickUpDate?: string;
    deliveryDate?: string;
    loadNumber?: string;
    rate?: number;
    dhMiles?: number;
    tripMiles?: number;
    tarpStatus?: Load["TARP STATUS"];
    extraStops?: number;
  }) => void;
  onCreateDriver: (data: {
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    trailerType?: Load["TRAILER TYPE"];
    location?: string;
  }) => Promise<EnrichedDriver>;
}

export const AddLoadModal = ({
  open,
  onOpenChange,
  enrichedDrivers,
  driverStatuses,
  preSelectedDriverId = null,
  prefilledPickupLocation,
  prefilledPickupDate,
  onAddLoad,
  onCreateDriver,
}: AddLoadModalProps) => {
  const { isAdmin } = useUserRole();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isAddingNewDriver, setIsAddingNewDriver] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Draft persistence - key scoped by user
  const [draftKey, setDraftKey] = useState('draft:add-load');

  // Form state
  const [pickupLocation, setPickupLocation] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [calculatedDH, setCalculatedDH] = useState<number | null>(null);
  const [tripMiles, setTripMiles] = useState<number | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [loadNumber, setLoadNumber] = useState("");
  const [loadAmount, setLoadAmount] = useState<number | null>(null);
  const [tarpStatus, setTarpStatus] = useState<Load["TARP STATUS"]>("Untarped");
  const [extraStops, setExtraStops] = useState<number | null>(null);
  
  const [rosterKey, setRosterKey] = useState(0);
  const prevOpen = useRef(false);
  const mountedWithOpen = useRef(open);
  
  // Fetch current user ID & set draft key
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      if (user) setDraftKey(`draft:add-load:${user.id}`);
    };
    fetchUserId();
  }, []);

  const { loadDraft, saveDraft, clearDraft } = useDraftPersistence<{
    pickupLocation: string; deliveryLocation: string;
    pickupDate: string; deliveryDate: string;
    loadNumber: string; loadAmount: number | null;
    tarpStatus: string; extraStops: number | null;
  }>(draftKey);

  // Collapsible section states
  const [driverSectionOpen, setDriverSectionOpen] = useState(true);
  const [routeSectionOpen, setRouteSectionOpen] = useState(true);
  
  // Fuel warning dialog state
  const [showFuelWarning, setShowFuelWarning] = useState(false);

  // Set default pickup date when modal opens, restore draft, and handle pre-selected driver
  useEffect(() => {
    if (open && (!prevOpen.current || mountedWithOpen.current)) {
      mountedWithOpen.current = false;
      setDriverSectionOpen(true);
      setRouteSectionOpen(true);

      // Restore draft first (props will override below)
      const draft = loadDraft();
      let draftRestored = false;
      if (draft && !preSelectedDriverId) {
        setPickupLocation(draft.pickupLocation || "");
        setDeliveryLocation(draft.deliveryLocation || "");
        setPickupDate(draft.pickupDate || "");
        setDeliveryDate(draft.deliveryDate || "");
        setLoadNumber(draft.loadNumber || "");
        setLoadAmount(draft.loadAmount ?? null);
        setTarpStatus((draft.tarpStatus as Load["TARP STATUS"]) || "Untarped");
        setExtraStops(draft.extraStops ?? null);
        draftRestored = true;
      }
      
      // Handle pre-selected driver (from empty driver row or contextual buttons)
      if (preSelectedDriverId) {
        const driver = enrichedDrivers.find(d => d.driver_id === preSelectedDriverId);
        if (driver) {
          setSelectedDriverId(preSelectedDriverId);
          setIsAddingNewDriver(false);
          
          // Use prefilled pickup location if provided, else try driver's last delivery
          if (prefilledPickupLocation) {
            setPickupLocation(prefilledPickupLocation);
          } else if (driver.lastDeliveryLocation) {
            setPickupLocation(driver.lastDeliveryLocation);
          }
        } else {
          console.warn('Pre-selected driver not found in current org, ignoring');
          setSelectedDriverId(null);
        }
        
        // Use prefilled pickup date if provided, else default to today
        if (prefilledPickupDate) {
          setPickupDate(prefilledPickupDate);
        } else if (!draftRestored || !draft?.pickupDate) {
          const now = new Date();
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const dd = String(now.getDate()).padStart(2, "0");
          const yy = String(now.getFullYear()).slice(-2);
          setPickupDate(`${mm}/${dd}/${yy}`);
        }
      } else if (!draftRestored) {
        // No pre-selection and no draft - default to today
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const yy = String(now.getFullYear()).slice(-2);
        setPickupDate(`${mm}/${dd}/${yy}`);
      }

      if (draftRestored) {
        sonnerToast.info("Draft restored");
      }
    }
    prevOpen.current = open;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preSelectedDriverId, prefilledPickupLocation, prefilledPickupDate, enrichedDrivers]);

  // Auto-save draft on field changes (skip driver-related fields)
  useEffect(() => {
    if (open && (pickupLocation || deliveryLocation || loadNumber || loadAmount)) {
      saveDraft({ pickupLocation, deliveryLocation, pickupDate, deliveryDate, loadNumber, loadAmount, tarpStatus, extraStops });
    }
  }, [open, pickupLocation, deliveryLocation, pickupDate, deliveryDate, loadNumber, loadAmount, tarpStatus, extraStops, saveDraft]);

  // Combine enriched drivers with status
  const driversWithStatus = useMemo(() => {
    return enrichedDrivers.map((driver) => ({
      ...driver,
      currentStatus: driverStatuses[driver.driver_id] || driver.currentStatus,
    }));
  }, [enrichedDrivers, driverStatuses]);

  const selectedDriver = useMemo(() => {
    return driversWithStatus.find((d) => d.driver_id === selectedDriverId) || null;
  }, [selectedDriverId, driversWithStatus]);

  const handleSelectDriver = (driver: EnrichedDriver) => {
    setSelectedDriverId(driver.driver_id);
    setIsAddingNewDriver(false);
  };

  const handleCreateDriver = async (driver: {
    name: string;
    phone: string;
    contractType: Load["CONTRACT TYPE"];
    truckNumber?: number;
    trailerNumber?: string;
    trailerType?: Load["TRAILER TYPE"];
    location?: string;
  }) => {
    const created = await onCreateDriver(driver);
    setSelectedDriverId(created.driver_id);
    setIsAddingNewDriver(false);
  };

  const handleClearDriver = () => {
    setSelectedDriverId(null);
  };

  const handleSubmit = () => {
    if (!selectedDriver) return;

    // Pre-booking validation: If driver has external active load, pickup must be after their delivery
    if (selectedDriver.hasExternalActiveLoad && selectedDriver.estimatedAvailableDate && pickupDate) {
      const externalDeliveryDate = parseDate(selectedDriver.estimatedAvailableDate);
      const newPickupDate = parseDate(pickupDate);
      
      if (externalDeliveryDate && newPickupDate && newPickupDate <= externalDeliveryDate) {
        const displayDate = format(externalDeliveryDate, "MM/dd/yy");
        toast({
          title: "Invalid pickup date",
          description: `Pickup date must be after ${displayDate}. This driver is completing a load for ${selectedDriver.externalLoadOwner || 'another dispatcher'}.`,
          variant: "destructive",
        });
        return;
      }
    }

    onAddLoad({
      driver_id: selectedDriverId || undefined,
      name: selectedDriver.name,
      phone: selectedDriver.phone,
      contractType: selectedDriver.contractType,
      truckNumber: selectedDriver.truckNumber || undefined,
      trailerNumber: selectedDriver.trailerNumber || undefined,
      origin: pickupLocation || undefined,
      destination: deliveryLocation || undefined,
      pickUpDate: pickupDate || undefined,
      deliveryDate: deliveryDate || undefined,
      loadNumber: loadNumber || undefined,
      rate: loadAmount ?? undefined,
      dhMiles: calculatedDH ?? undefined,
      tripMiles: tripMiles ?? undefined,
      tarpStatus: tarpStatus || undefined,
      extraStops: extraStops ?? undefined,
    });

    // Auto-clear the manual current-location override now that the load was created.
    // The override is a one-shot correction; once the new load exists, the next
    // "starting location" should follow the normal lifecycle (this load's delivery).
    if (selectedDriver.currentLocationOverride && selectedDriverId) {
      supabase
        .from('drivers')
        .update({
          current_location_override: null,
          current_location_override_set_at: null,
        })
        .eq('id', selectedDriverId)
        .then(({ error }) => {
          if (error) console.error('Failed to clear override after load create:', error);
        });
    }

    // Check if driver has fuel disabled - show warning dialog
    if (selectedDriver.fuelEnabled === false) {
      setShowFuelWarning(true);
    } else {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleFuelWarningConfirm = () => {
    setShowFuelWarning(false);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    clearDraft();
    setSelectedDriverId(null);
    setIsAddingNewDriver(false);
    setPickupLocation("");
    setDeliveryLocation("");
    setCalculatedDH(null);
    setTripMiles(null);
    setPickupDate("");
    setDeliveryDate("");
    setLoadNumber("");
    setLoadAmount(null);
    setTarpStatus("Untarped");
    setExtraStops(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const isValid = 
    selectedDriver !== null && 
    pickupLocation.trim().length > 0 && 
    deliveryLocation.trim().length > 0 && 
    pickupDate.trim().length > 0 &&
    deliveryDate.trim().length > 0 &&
    loadNumber.trim().length > 0 &&
    loadAmount !== null && loadAmount > 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Create New Load</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* External Load Warning Banner */}
          {selectedDriver?.hasExternalActiveLoad && (
            <Alert className="mx-6 mt-4 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>{selectedDriver.name}</strong> is completing a load for <strong>{selectedDriver.externalLoadOwner || 'another dispatcher'}</strong>.
                {selectedDriver.estimatedAvailableDate && (
                  <> Available after <strong>{selectedDriver.estimatedAvailableDate}</strong>.</>
                )}
                {' '}Pickup date must be after their current delivery.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Section 1: Assign Driver */}
          <Collapsible open={driverSectionOpen} onOpenChange={setDriverSectionOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-6 py-4 hover:bg-muted/50 transition-colors border-b">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </span>
                <span className="font-medium text-foreground">Assign Driver</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  driverSectionOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 py-4">
                <DriverRoster
                  key={rosterKey}
                  drivers={driversWithStatus}
                  selectedDriverId={selectedDriverId}
                  onSelectDriver={handleSelectDriver}
                  onCreateDriver={handleCreateDriver}
                  isAddingNew={isAddingNewDriver}
                  onAddingNewChange={setIsAddingNewDriver}
                  isAdmin={isAdmin}
                  currentUserId={currentUserId}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 2: Route & Freight Details */}
          <Collapsible open={routeSectionOpen} onOpenChange={setRouteSectionOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-6 py-4 hover:bg-muted/50 transition-colors border-b">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </span>
                <span className="font-medium text-foreground">Route & Freight Details</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  routeSectionOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 py-4">
                <LoadFormSection
                  selectedDriver={selectedDriver}
                  onClearDriver={handleClearDriver}
                  pickupLocation={pickupLocation}
                  onPickupLocationChange={setPickupLocation}
                  calculatedDH={calculatedDH}
                  onDHCalculated={setCalculatedDH}
                  deliveryLocation={deliveryLocation}
                  onDeliveryLocationChange={setDeliveryLocation}
                  tripMiles={tripMiles}
                  onTripMilesChange={setTripMiles}
                  pickupDate={pickupDate}
                  onPickupDateChange={setPickupDate}
                  deliveryDate={deliveryDate}
                  onDeliveryDateChange={setDeliveryDate}
                  loadNumber={loadNumber}
                  onLoadNumberChange={setLoadNumber}
                  loadAmount={loadAmount}
                  onLoadAmountChange={setLoadAmount}
                  tarpStatus={tarpStatus}
                  onTarpStatusChange={setTarpStatus}
                  extraStops={extraStops}
                  onExtraStopsChange={setExtraStops}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <SheetFooter className="px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Create Load
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Fuel Disabled Warning Dialog */}
      <AlertDialog open={showFuelWarning} onOpenChange={() => {}}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Fuel Disabled
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This driver's relay fuel is disabled! Please notify proper parties.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={handleFuelWarningConfirm}>
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};
