// Pure utility functions for settlement invoice calculations

import { PayLogicType } from '@/config/contractProfiles';

/**
 * Calculate net pay based on pay logic type
 * 
 * For PERCENTAGE: NetPay = grossAmount × (rate / 100)
 *   - rate is the driver's share percentage (e.g., 88 means driver gets 88%)
 * 
 * For MILEAGE: NetPay = milesDriven × rate
 *   - rate is the payment per mile (e.g., 0.65 means $0.65/mile)
 */
export function calculateNetPay(
  payLogic: PayLogicType,
  rate: number,
  grossAmount?: number,
  milesDriven?: number
): number {
  if (payLogic === 'PERCENTAGE' && grossAmount !== undefined && grossAmount > 0) {
    return grossAmount * (rate / 100);
  }
  
  if (payLogic === 'MILEAGE' && milesDriven !== undefined && milesDriven > 0) {
    return milesDriven * rate;
  }
  
  return 0;
}

/**
 * Format the rate for display based on pay logic
 * @returns formatted string like "88% Share" or "$0.65/mi"
 */
export function formatRate(payLogic: PayLogicType, rate: number): string {
  if (payLogic === 'PERCENTAGE') {
    return `${rate}% Share`;
  }
  return `$${rate.toFixed(2)}/mi`;
}

/**
 * Format a currency value
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Validate rate based on pay logic
 * PERCENTAGE: 0-100
 * MILEAGE: 0-10 (reasonable CPM range)
 */
export function validateRate(payLogic: PayLogicType, rate: number): { valid: boolean; message?: string } {
  if (rate < 0) {
    return { valid: false, message: 'Rate cannot be negative' };
  }
  
  if (payLogic === 'PERCENTAGE') {
    if (rate > 100) {
      return { valid: false, message: 'Percentage cannot exceed 100%' };
    }
  } else if (payLogic === 'MILEAGE') {
    if (rate > 10) {
      return { valid: false, message: 'Rate per mile seems too high (max $10/mi)' };
    }
  }
  
  return { valid: true };
}

/**
 * Validate gross amount (non-negative)
 */
export function validateGrossAmount(amount: number): { valid: boolean; message?: string } {
  if (amount < 0) {
    return { valid: false, message: 'Gross amount cannot be negative' };
  }
  return { valid: true };
}

/**
 * Validate miles driven (non-negative integer)
 */
export function validateMiles(miles: number): { valid: boolean; message?: string } {
  if (miles < 0) {
    return { valid: false, message: 'Miles cannot be negative' };
  }
  return { valid: true };
}

/**
 * Generate a unique ID for line items
 */
export function generateLineItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a settlement invoice number based on driver ID and period start date
 * Format: RL-MMDD-XXXX (where XXXX is last 4 chars of driver ID)
 */
export function generateInvoiceNumber(driverId: string | null, periodStart: Date, organizationId?: string | null): string {
  if (!driverId) return 'RL-0000-0000';
  
  const month = String(periodStart.getMonth() + 1).padStart(2, '0');
  const day = String(periodStart.getDate()).padStart(2, '0');
  const orgPrefix = organizationId?.slice(0, 3).toUpperCase() || 'XXX';
  const driverSuffix = driverId.slice(-4).toUpperCase();
  
  return `RL-${month}${day}-${orgPrefix}-${driverSuffix}`;
}
