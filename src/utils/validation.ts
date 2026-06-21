import { z } from "zod";
import { parse, isValid, isBefore } from "date-fns";
import { Load } from "@/types/load";

// Input filter functions for real-time character filtering
export const filterCurrencyInput = (value: string): string => {
  // Allow only digits and one decimal point, max 2 decimal places
  let filtered = value.replace(/[^0-9.]/g, "");
  const parts = filtered.split(".");
  if (parts.length > 2) {
    filtered = parts[0] + "." + parts.slice(1).join("");
  }
  if (parts.length === 2 && parts[1].length > 2) {
    filtered = parts[0] + "." + parts[1].slice(0, 2);
  }
  return filtered;
};

export const filterIntegerInput = (value: string): string => {
  // Allow only digits
  return value.replace(/[^0-9]/g, "");
};

export const filterNumberInput = (value: string, allowDecimal = false): string => {
  if (allowDecimal) {
    return filterCurrencyInput(value);
  }
  return filterIntegerInput(value);
};

export const filterPhoneInput = (value: string): string => {
  // Allow digits, parentheses, hyphens, plus, and spaces
  return value.replace(/[^0-9()\-+\s]/g, "");
};

// Phone number validation - accepts various formats
const phoneRegex = /^[\d\s()+-]{0,20}$/;

// Validation schemas
export const driverNameSchema = z
  .string()
  .trim()
  .min(1, "Driver name is required")
  .max(100, "Driver name must be less than 100 characters")
  .regex(/^[a-zA-Z\s.'-]+$/, "Driver name can only contain letters, spaces, and basic punctuation");

export const phoneNumberSchema = z
  .string()
  .trim()
  .max(20, "Phone number must be less than 20 characters")
  .regex(phoneRegex, "Phone number format is invalid")
  .optional()
  .or(z.literal(""));

export const truckNumberSchema = z
  .number()
  .int("Truck number must be a whole number")
  .positive("Truck number must be positive")
  .max(9999999, "Truck number must be less than 10,000,000")
  .optional();

export const trailerNumberSchema = z
  .string()
  .trim()
  .max(20, "Trailer number must be less than 20 characters")
  .regex(/^[a-zA-Z0-9\s-]*$/, "Trailer number can only contain letters, numbers, spaces, and hyphens")
  .optional()
  .or(z.literal(""));

export const currencySchema = z
  .string()
  .trim()
  .regex(/^\$?\d{1,10}(\.\d{0,2})?$/, "Currency must be a valid dollar amount (e.g., $1234.56)")
  .transform((val) => {
    const num = parseFloat(val.replace(/[^0-9.]/g, ""));
    return `$${num.toFixed(2)}`;
  });

export const milesSchema = z
  .number()
  .int("Miles must be a whole number")
  .min(0, "Miles cannot be negative")
  .max(999999, "Miles must be less than 1,000,000");

export const textFieldSchema = z
  .string()
  .trim()
  .max(500, "Text must be less than 500 characters");

export const loadNumberSchema = z
  .string()
  .trim()
  .max(50, "Load number must be less than 50 characters")
  .regex(/^[a-zA-Z0-9\s-]*$/, "Load number can only contain letters, numbers, spaces, and hyphens");

// Location format: "City, ST Zip" (e.g., "Newark, DE 19711")
export const locationSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z\s.'-]+,\s[A-Z]{2}\s\d{5}$/,
    "Location must be in format: City, ST Zip (e.g., Newark, DE 19711)"
  )
  .or(z.literal(""));

// Validate and sanitize input with error handling
export function validateInput<T>(schema: z.ZodSchema<T>, value: unknown): { success: boolean; data?: T; error?: string } {
  try {
    const result = schema.safeParse(value);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.errors[0]?.message || "Validation failed" };
  } catch (error) {
    return { success: false, error: "Validation error occurred" };
  }
}

// Parse date string in MM/dd/yy format
function parseLoadDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const parsed = parse(dateStr, "MM/dd/yy", new Date());
  return isValid(parsed) ? parsed : null;
}

// Validate pickup date against driver's previous delivery date
// Returns warning message if pickup date is before the chronologically previous load's delivery
export function validatePickupDateForDriver(
  driverId: string,
  currentLoadId: string,
  pickupDate: string,
  loads: Load[]
): { warning: string | null; previousDeliveryDate: string | null } {
  const pickupParsed = parseLoadDate(pickupDate);
  if (!pickupParsed) {
    return { warning: null, previousDeliveryDate: null };
  }

  // Get all non-archived loads for this driver
  const driverLoads = loads.filter(
    (load) => load.driver_id === driverId && !load.isArchived
  );

  if (driverLoads.length <= 1) {
    return { warning: null, previousDeliveryDate: null };
  }

  // Sort loads by pickup date to establish chronological order
  const sortedLoads = [...driverLoads].sort((a, b) => {
    const dateA = a["PICK UP DATE"] ? parseLoadDate(a["PICK UP DATE"]) : null;
    const dateB = b["PICK UP DATE"] ? parseLoadDate(b["PICK UP DATE"]) : null;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });

  // Find current load's position in the sorted list
  const currentIndex = sortedLoads.findIndex((load) => load.id === currentLoadId);
  if (currentIndex <= 0) {
    // First load or not found - no previous load to compare
    return { warning: null, previousDeliveryDate: null };
  }

  // Get the previous load's delivery date
  const previousLoad = sortedLoads[currentIndex - 1];
  const previousDeliveryDateStr = previousLoad["DELIVERY DATE"];
  if (!previousDeliveryDateStr) {
    return { warning: null, previousDeliveryDate: null };
  }

  const previousDeliveryParsed = parseLoadDate(previousDeliveryDateStr);
  if (!previousDeliveryParsed) {
    return { warning: null, previousDeliveryDate: null };
  }

  // Check if pickup date is before the previous load's delivery date (same day is OK)
  if (isBefore(pickupParsed, previousDeliveryParsed)) {
    return {
      warning: `Pickup date (${pickupDate}) is before the previous delivery date (${previousDeliveryDateStr})`,
      previousDeliveryDate: previousDeliveryDateStr,
    };
  }

  return { warning: null, previousDeliveryDate: previousDeliveryDateStr };
}
