import { ContractProfilesMap, getContractProfile } from "@/config/contractProfiles";

/**
 * Compute driver pay from the org's contract profiles.
 * - PERCENTAGE: load_amount * (rate / 100)
 * - MILEAGE:    trip_miles * rate
 * Returns null if inputs are insufficient.
 */
export function computeDriverPay(
  contractType: string,
  loadAmount: number | null | undefined,
  tripMiles: number | null | undefined,
  contractProfiles?: ContractProfilesMap
): number | null {
  const profile = getContractProfile(contractType, contractProfiles);
  if (profile.defaultPayLogic === "MILEAGE") {
    if (tripMiles == null || tripMiles <= 0) return null;
    return Math.round(tripMiles * profile.defaultRate * 100) / 100;
  }
  if (loadAmount == null || loadAmount <= 0) return null;
  return Math.round(loadAmount * (profile.defaultRate / 100) * 100) / 100;
}