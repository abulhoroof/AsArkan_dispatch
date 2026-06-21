// Contract Profile Configuration for Smart Math Engine
// These are the default profiles that can be overridden per organization

export type PayLogicType = 'PERCENTAGE' | 'MILEAGE';

export interface ContractProfile {
  contractType: string;
  defaultPayLogic: PayLogicType;
  defaultRate: number; // For PERCENTAGE: driver's share (e.g., 88 = 88%), For MILEAGE: $/mile (e.g., 0.65)
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  loadId?: string;
  loadNumber?: string;
  deliveryDate?: string;  // Delivery date for display in settlement table
  
  // Logic state
  payLogic: PayLogicType;
  rate: number;
  isOverridden: boolean;
  
  // Inputs (only one is active based on payLogic)
  grossAmount?: number;
  milesDriven?: number;
  
  // Computed
  netPay: number;
  
  // Display metadata (for transparency in settlement UI)
  appliedRate?: string;  // e.g., "88%", "$0.65/mi"
}

export type ContractProfilesMap = Record<string, ContractProfile>;

// Default contract profile mappings
// These serve as fallbacks when no organization-specific settings exist
export const DEFAULT_CONTRACT_PROFILES: ContractProfilesMap = {
  'LP GOLD': { contractType: 'LP GOLD', defaultPayLogic: 'PERCENTAGE', defaultRate: 88 },
  'LP PLATINUM': { contractType: 'LP PLATINUM', defaultPayLogic: 'PERCENTAGE', defaultRate: 90 },
  'LP STANDARD': { contractType: 'LP STANDARD', defaultPayLogic: 'PERCENTAGE', defaultRate: 85 },
  'LP G.NEW': { contractType: 'LP G.NEW', defaultPayLogic: 'PERCENTAGE', defaultRate: 88 },
  'LP P.NEW': { contractType: 'LP P.NEW', defaultPayLogic: 'PERCENTAGE', defaultRate: 90 },
  'CD GOLD': { contractType: 'CD GOLD', defaultPayLogic: 'PERCENTAGE', defaultRate: 92 },
  'CD PLATINUM': { contractType: 'CD PLATINUM', defaultPayLogic: 'PERCENTAGE', defaultRate: 94 },
  'CD C.P.M.': { contractType: 'CD C.P.M.', defaultPayLogic: 'MILEAGE', defaultRate: 0.65 },
  'OWNER OP.': { contractType: 'OWNER OP.', defaultPayLogic: 'PERCENTAGE', defaultRate: 88 },
  'D.F.O': { contractType: 'D.F.O', defaultPayLogic: 'MILEAGE', defaultRate: 0.55 },
  'TRAINING': { contractType: 'TRAINING', defaultPayLogic: 'MILEAGE', defaultRate: 0.45 },
  'RENT': { contractType: 'RENT', defaultPayLogic: 'PERCENTAGE', defaultRate: 80 },
};

/**
 * Get a contract profile by contract type
 * Falls back to a default PERCENTAGE profile if not found
 */
export function getContractProfile(
  contractType: string,
  customProfiles?: ContractProfilesMap
): ContractProfile {
  // Org-saved profiles are the single source of truth.
  // If the contract type isn't configured for this org, fall back to
  // PERCENTAGE @ 100% so driver_pay = load_amount (no auto-calc).
  const profile = customProfiles?.[contractType];
  if (profile) return profile;
  return {
    contractType,
    defaultPayLogic: 'PERCENTAGE',
    defaultRate: 100,
  };
}

/**
 * Check if a contract type uses mileage-based pay
 */
export function isMileageBasedContract(contractType: string, customProfiles?: ContractProfilesMap): boolean {
  const profile = getContractProfile(contractType, customProfiles);
  return profile.defaultPayLogic === 'MILEAGE';
}
