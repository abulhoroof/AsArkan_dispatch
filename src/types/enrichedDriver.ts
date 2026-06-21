import { Load } from "./load";

export interface EnrichedDriver {
  driver_id: string;
  name: string;
  phone: string;
  contractType: Load["CONTRACT TYPE"];
  truckNumber: number | null;
  trailerNumber: string | null;
  currentStatus: Load["Status"] | null;
  lastDeliveryLocation: string | null;
  lastDeliveryDate: string | null;
  fuelEnabled: boolean;
  // Driver ownership - only assigned dispatcher or admin can add loads
  assignedDispatcherId?: string | null;
  // Sunset transfer fields - for drivers completing loads for another dispatcher
  hasExternalActiveLoad?: boolean;
  externalLoadOwner?: string | null;
  estimatedAvailableDate?: string | null;
  externalLoadLocation?: string | null;
  // Manual override for the driver's current starting location (city/state or ZIP).
  // When set, takes precedence over lastDeliveryLocation for DH miles calculations.
  currentLocationOverride?: string | null;
  currentLocationOverrideSetAt?: string | null;
}
